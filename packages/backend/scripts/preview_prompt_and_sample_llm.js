/*
  Preview prompt assembly/RAG injection and (optionally) run a real OpenRouter completion.

  Why this exists:
  - Lets you verify lorebook trigger + examples injection on real DB character.
  - Lets you sample actual LLM output while keeping request rate low to avoid 429.

  Usage:
    npm run build
    node scripts/preview_prompt_and_sample_llm.js --characterId <id> --message "용 이야기 해줘" \
      --model meta-llama/llama-3.2-3b-instruct:free --repeat 1 --delayMs 900

  Optional:
    --noCall            Only prints prompts (no LLM call)
    --userId <userId>   If provided, will try RAG injection (uses memoryIntegration)
    --chatId <chatId>   If provided with userId, will also run afterMessageProcess after LLM

  Env:
    OPENROUTER_API_KEY required for --call
*/

const assert = require('assert')
const path = require('path')
const fs = require('fs')

// Load backend .env if present
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
} catch {
  // ignore
}

function requireFromDist(relPathFromDist) {
  const distPath = path.join(__dirname, '..', 'dist', ...relPathFromDist.split('/'))
  if (!fs.existsSync(distPath)) {
    throw new Error(`Missing build output: ${distPath}. Run "npm run build" first.`)
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(distPath)
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      args._.push(a)
      continue
    }

    const key = a.slice(2)
    if (key === 'noCall') {
      args.noCall = true
      continue
    }

    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    i++
  }
  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pickNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isRateLimitError(err) {
  const status = err?.status || err?.statusCode || err?.response?.status
  if (status === 429) return true
  const msg = String(err?.message || err || '')
  return msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')
}

async function withRetry429(fn, options) {
  const maxRetries = options?.maxRetries ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 900

  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= maxRetries || !isRateLimitError(err)) {
        throw err
      }

      const backoff = baseDelayMs * Math.pow(2, attempt)
      const jitter = Math.floor(Math.random() * 200)
      const waitMs = backoff + jitter
      process.stderr.write(`\n429 detected. Backing off for ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...\n`)
      await sleep(waitMs)
      attempt++
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const characterId = args.characterId
  const message = args.message
  const model = args.model || process.env.OPENROUTER_DEFAULT_MODEL || 'meta-llama/llama-3.2-3b-instruct:free'
  const repeat = pickNumber(args.repeat, 1)
  const delayMs = pickNumber(args.delayMs, 900)
  const noCall = !!args.noCall
  const userId = args.userId
  const chatId = args.chatId

  if (!characterId || !message) {
    process.stderr.write('Usage: node scripts/preview_prompt_and_sample_llm.js --characterId <id> --message "..." [--model ...]\n')
    process.exit(2)
  }

  const { prisma } = requireFromDist('config/database.js')
  const { assembleSystemPrompt } = requireFromDist('services/prompt/PromptAssembly.js')
  const { memoryIntegration } = requireFromDist('services/memory/index.js')
  const { OpenRouterService } = requireFromDist('services/ai/OpenRouterService.js')

  try {
    const dbCharacter = await prisma.character.findFirst({
      where: { id: characterId, isActive: true },
      include: {
        lorebookEntries: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
          select: { id: true, keys: true, content: true, priority: true },
        },
      },
    })

    if (!dbCharacter) {
      throw new Error(`Character not found: ${characterId}`)
    }

    const lorebookEntries = (dbCharacter.lorebookEntries || []).map((e) => ({
      id: e.id,
      keys: e.keys,
      content: e.content,
      priority: e.priority,
    }))

    const assembled = assembleSystemPrompt({
      baseSystemPrompt: dbCharacter.systemPrompt,
      userMessage: message,
      lorebookEntries,
      exampleDialoguesJson: dbCharacter.exampleDialogues,
      options: {
        includeHardRules: true,
        outputLanguage: 'ko',
      },
    })

    let finalSystemPrompt = assembled.assembledSystemPrompt
    let rag = { totalTokens: 0 }
    if (userId) {
      try {
        const ragResult = await memoryIntegration.beforeMessageProcess(
          userId,
          dbCharacter.id,
          dbCharacter.name,
          message,
          assembled.assembledSystemPrompt
        )
        finalSystemPrompt = ragResult.systemPrompt
        rag = { totalTokens: ragResult.ragContext?.totalTokens || 0 }
      } catch (e) {
        process.stderr.write(`RAG injection failed (ignored): ${e instanceof Error ? e.message : String(e)}\n`)
      }
    }

    process.stdout.write('=== Prompt Preview ===\n')
    process.stdout.write(`character: ${dbCharacter.name} (${dbCharacter.id})\n`)
    process.stdout.write(`message: ${message}\n`)
    process.stdout.write(`triggeredLorebook: ${assembled.usedLorebookEntries.length} [${assembled.usedLorebookEntries.map((e) => e.id).join(', ')}]\n`)
    process.stdout.write(`usedExamples: ${assembled.usedExamples.length}\n`)
    process.stdout.write(`ragTokens: ${rag.totalTokens}\n\n`)

    process.stdout.write('--- Assembled System Prompt (pre-RAG) ---\n')
    process.stdout.write(assembled.assembledSystemPrompt)
    process.stdout.write('\n\n')

    if (finalSystemPrompt !== assembled.assembledSystemPrompt) {
      process.stdout.write('--- Final System Prompt (post-RAG) ---\n')
      process.stdout.write(finalSystemPrompt)
      process.stdout.write('\n\n')
    }

    if (noCall) {
      process.stdout.write('Skipping LLM call (--noCall).\n')
      return
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    assert.ok(apiKey, 'OPENROUTER_API_KEY is required for LLM call')

    const openrouter = new OpenRouterService({
      apiKey,
      siteUrl: process.env.OPENROUTER_SITE_URL,
      siteName: process.env.OPENROUTER_SITE_NAME,
      defaultModel: process.env.OPENROUTER_DEFAULT_MODEL,
    })

    for (let i = 0; i < repeat; i++) {
      if (i > 0) {
        await sleep(delayMs)
      }

      process.stdout.write(`=== LLM Sample ${i + 1}/${repeat} (model=${model}) ===\n`)

      const responseText = await withRetry429(
        async () => {
          // We intentionally call generateChatResponse directly so that the system prompt is exactly our assembled prompt.
          const messages = [
            { role: 'system', content: finalSystemPrompt },
            { role: 'user', content: message },
          ]
          return await openrouter.generateChatResponse(messages, { model, temperature: 0.7, maxTokens: 700 })
        },
        { maxRetries: 3, baseDelayMs: Math.max(500, delayMs) }
      )

      process.stdout.write(responseText)
      process.stdout.write('\n\n')

      // Optional: run memory after-process once we have the final response.
      if (userId && chatId) {
        void memoryIntegration
          .afterMessageProcess(
            {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
              chatId,
              userId,
              characterId: dbCharacter.id,
              role: 'assistant',
              content: responseText,
              tokens: Math.ceil(responseText.length / 3),
              metadata: { source: 'script' },
            },
            dbCharacter.name
          )
          .catch(() => {})
      }
    }
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
  process.exit(1)
})
