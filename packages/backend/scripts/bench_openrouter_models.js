/*
  Bench OpenRouter models for Korean chatbot suitability.

  What it does:
  - Loads a real character from Postgres (Prisma)
  - Builds the same system prompt used by our prompt assembly (and optional RAG injection)
  - Calls OpenRouter chat completion for each candidate model
  - Runs automated quality gates (Korean-only / repetition / meta leak)
  - Prints a ranked summary table

  Usage:
    npm run build
    node scripts/bench_openrouter_models.js --characterId <id> --message "용 이야기 해줘" \
      --models meta-llama/llama-3.3-70b-instruct:free,google/gemini-2.0-flash-exp:free \
      --repeat 2 --delayMs 1200 --checkKorean --foreignMaxCount 0 --koreanMinRatio 0.9

  Optional:
    --noRag                 Do not run memoryIntegration.beforeMessageProcess
    --userId <userId>       If provided and --noRag not set, will try RAG injection
    --checkRepetition       Enable repeated-line detection (defaults to on when --checkKorean)
    --checkNoMeta           Fail if response contains meta/prompt leakage keywords
    --minPassRate 0.8       Print only models with passRate >= threshold
    --topN 5                Print top N after filtering

  Notes:
  - This is a heuristic bench, not a full eval.
  - We intentionally run sequentially to reduce 429.
*/

const assert = require('assert')
const path = require('path')
const fs = require('fs')

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
} catch {
  // ignore
}

function requireFromDist(relPathFromDist) {
  const distPath = path.join(__dirname, '..', 'dist', ...relPathFromDist.split('/'))
  if (!fs.existsSync(distPath)) {
    throw new Error(`Missing build output: ${distPath}. Run "npm run build" first.`)
  }
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
    if (key === 'help' || key === 'h') {
      args.help = true
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

function printUsage() {
  process.stderr.write(
    [
      'Usage:',
      '  node scripts/bench_openrouter_models.js --characterId <id> --message "..." --models <comma-separated> [options]',
      '',
      'Options:',
      '  --repeat N               Samples per model (default: 2)',
      '  --delayMs MS             Delay between calls (default: 1200)',
      '  --userId <userId>         Enable RAG injection using memoryIntegration.beforeMessageProcess',
      '  --noRag                  Skip RAG injection even if userId is set',
      '',
      'Checks:',
      '  --checkKorean            Fail if response contains non-Korean scripts (strict by default)',
      '  --koreanMinRatio 0.90    Hangul ratio among letter-like scripts',
      '  --foreignMaxCount 0      Allow up to N foreign-script characters',
      '  --checkRepetition        Fail on repeated identical non-empty lines (default: on if --checkKorean)',
      '  --maxRepeatedLine 3      Fail if any identical line repeats >= N times',
      '  --checkNoMeta            Fail if response contains prompt/meta leakage keywords',
      '',
      'Output:',
      '  --minPassRate 0.8        Only show models with passRate >= threshold',
      '  --topN 5                 Show top N models after filtering',
      '  --failFast               Stop sampling a model after the first failed sample',
      '',
    ].join('\n')
  )
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
  const baseDelayMs = options?.baseDelayMs ?? 1200

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

function analyzeLanguage(text) {
  const reHangul = /\p{Script=Hangul}/u
  const reHan = /\p{Script=Han}/u
  const reHira = /\p{Script=Hiragana}/u
  const reKata = /\p{Script=Katakana}/u
  const reLatin = /[A-Za-z]/

  let hangul = 0
  let han = 0
  let hira = 0
  let kata = 0
  let latin = 0

  for (const ch of text) {
    if (reHangul.test(ch)) hangul++
    else if (reLatin.test(ch)) latin++
    else if (reHan.test(ch)) han++
    else if (reHira.test(ch)) hira++
    else if (reKata.test(ch)) kata++
  }

  const foreign = latin + han + hira + kata
  const letterLike = hangul + foreign
  const hangulRatio = letterLike > 0 ? hangul / letterLike : 1

  return { hangul, latin, han, hira, kata, foreign, letterLike, hangulRatio }
}

function analyzeRepetitionByLine(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const counts = new Map()
  for (const line of lines) {
    counts.set(line, (counts.get(line) || 0) + 1)
  }

  let maxCount = 0
  let maxLine = ''
  for (const [line, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count
      maxLine = line
    }
  }

  return { maxCount, maxLine, uniqueLines: counts.size, totalLines: lines.length }
}

function containsMetaLeak(text) {
  const keywords = [
    '시스템',
    '개발자',
    '프롬프트',
    '정책',
    '메모리',
    'HARD_RULES',
    'SYSTEM',
    'DEVELOPER',
    'PROMPT',
    'POLICY',
  ]
  return keywords.some((k) => text.includes(k))
}

function runAutoChecks(text, options) {
  const results = []
  let ok = true

  if (options.checkKorean) {
    const lang = analyzeLanguage(text)
    const passedRatio = lang.hangulRatio >= options.koreanMinRatio
    const passedForeignCount = lang.foreign <= options.foreignMaxCount
    const passed = passedRatio && passedForeignCount
    results.push({
      name: 'korean_only',
      passed,
      detail: `hangulRatio=${lang.hangulRatio.toFixed(3)} foreign=${lang.foreign} (latin=${lang.latin}, han=${lang.han}, hira=${lang.hira}, kata=${lang.kata})`,
    })
    if (!passed) ok = false
  }

  if (options.checkRepetition) {
    const rep = analyzeRepetitionByLine(text)
    const passed = rep.maxCount < options.maxRepeatedLine
    results.push({
      name: 'no_repeated_lines',
      passed,
      detail: `maxLineRepeat=${rep.maxCount} uniqueLines=${rep.uniqueLines} totalLines=${rep.totalLines}`,
    })
    if (!passed) ok = false
  }

  if (options.checkNoMeta) {
    const passed = !containsMetaLeak(text)
    results.push({ name: 'no_meta_leak', passed, detail: passed ? 'ok' : 'meta keyword detected' })
    if (!passed) ok = false
  }

  return { ok, results }
}

function formatMs(n) {
  if (!Number.isFinite(n)) return '-'
  return `${Math.round(n)}ms`
}

function padRight(s, width) {
  const str = String(s)
  if (str.length >= width) return str
  return str + ' '.repeat(width - str.length)
}

function pickModels(modelsArg) {
  if (!modelsArg) return []
  return String(modelsArg)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return 0
  }

  const characterId = args.characterId
  const message = args.message
  const models = pickModels(args.models)

  const repeat = pickNumber(args.repeat, 2)
  const delayMs = pickNumber(args.delayMs, 1200)
  const userId = args.userId
  const noRag = !!args.noRag

  const checkKorean = !!args.checkKorean
  const koreanMinRatio = pickNumber(args.koreanMinRatio, 0.9)
  const foreignMaxCount = pickNumber(args.foreignMaxCount, 0)
  const checkRepetition = args.checkRepetition === undefined ? checkKorean : !!args.checkRepetition
  const maxRepeatedLine = pickNumber(args.maxRepeatedLine, 3)
  const checkNoMeta = !!args.checkNoMeta

  const failFast = !!args.failFast

  const minPassRate = pickNumber(args.minPassRate, 0)
  const topN = pickNumber(args.topN, 0)

  if (!characterId || !message || models.length === 0) {
    printUsage()
    return 2
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  assert.ok(apiKey, 'OPENROUTER_API_KEY is required')

  const { prisma } = requireFromDist('config/database.js')
  const { assembleSystemPrompt } = requireFromDist('services/prompt/PromptAssembly.js')
  const { memoryIntegration } = requireFromDist('services/memory/index.js')
  const { OpenRouterService } = requireFromDist('services/ai/OpenRouterService.js')

  const openrouter = new OpenRouterService({
    apiKey,
    siteUrl: process.env.OPENROUTER_SITE_URL,
    siteName: process.env.OPENROUTER_SITE_NAME,
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL,
  })

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
    if (!noRag && userId) {
      try {
        const ragResult = await memoryIntegration.beforeMessageProcess(
          userId,
          dbCharacter.id,
          dbCharacter.name,
          message,
          assembled.assembledSystemPrompt
        )
        finalSystemPrompt = ragResult.systemPrompt
      } catch (e) {
        process.stderr.write(`RAG injection failed (ignored): ${e instanceof Error ? e.message : String(e)}\n`)
      }
    }

    process.stdout.write('=== Model Bench ===\n')
    process.stdout.write(`character: ${dbCharacter.name} (${dbCharacter.id})\n`)
    process.stdout.write(`message: ${message}\n`)
    process.stdout.write(`models: ${models.length}\n`)
    process.stdout.write(`repeatPerModel: ${repeat}\n`)
    process.stdout.write(`delayMs: ${delayMs}\n`)
    process.stdout.write(`checks: ${[checkKorean ? 'korean' : null, checkRepetition ? 'repeat' : null, checkNoMeta ? 'noMeta' : null].filter(Boolean).join(', ') || 'none'}\n`)
    process.stdout.write('\n')

    const results = []

    for (const model of models) {
      let pass = 0
      let fail = 0
      let totalLatencyMs = 0
      let totalPromptTokens = 0
      let totalCompletionTokens = 0
      let totalTokens = 0
      let totalChars = 0
      let failNotes = []

      process.stdout.write(`--- ${model} ---\n`)

      for (let i = 0; i < repeat; i++) {
        if (i > 0) await sleep(delayMs)

        const start = Date.now()
        let text

        try {
          openrouter.clearLastUsage()
          text = await withRetry429(
            async () => {
              const messages = [
                { role: 'system', content: finalSystemPrompt },
                { role: 'user', content: message },
              ]
              return await openrouter.generateChatResponse(messages, { model, temperature: 0.7, maxTokens: 700 })
            },
            { maxRetries: 3, baseDelayMs: Math.max(600, delayMs) }
          )
        } catch (e) {
          fail++
          const msg = e instanceof Error ? e.message : String(e)
          failNotes.push(`call_error:${msg}`)
          process.stdout.write(`sample ${i + 1}/${repeat}: ERROR ${msg}\n`)
          continue
        }

        const latencyMs = Date.now() - start
        totalLatencyMs += latencyMs
        totalChars += text.length

        const usage = openrouter.lastUsage
        if (usage) {
          totalPromptTokens += usage.promptTokens
          totalCompletionTokens += usage.completionTokens
          totalTokens += usage.totalTokens
        }

        const check = runAutoChecks(text, {
          checkKorean,
          koreanMinRatio,
          foreignMaxCount,
          checkRepetition,
          maxRepeatedLine,
          checkNoMeta,
        })

        if (check.ok) {
          pass++
          process.stdout.write(`sample ${i + 1}/${repeat}: PASS (${formatMs(latencyMs)})\n`)
        } else {
          fail++
          const brief = check.results
            .filter((r) => !r.passed)
            .map((r) => `${r.name}`)
            .join(',')
          failNotes.push(brief || 'check_failed')
          process.stdout.write(`sample ${i + 1}/${repeat}: FAIL ${brief} (${formatMs(latencyMs)})\n`)

          if (failFast) {
            process.stdout.write('Stopping early (--failFast) for this model.\n')
            break
          }
        }
      }

      const total = pass + fail
      const passRate = total > 0 ? pass / total : 0
      const avgLatencyMs = total > 0 ? totalLatencyMs / total : NaN
      const avgPromptTokens = total > 0 ? totalPromptTokens / total : NaN
      const avgCompletionTokens = total > 0 ? totalCompletionTokens / total : NaN
      const avgTotalTokens = total > 0 ? totalTokens / total : NaN
      const avgChars = total > 0 ? totalChars / total : NaN

      results.push({
        model,
        pass,
        fail,
        total,
        passRate,
        avgLatencyMs,
        avgPromptTokens,
        avgCompletionTokens,
        avgTotalTokens,
        avgChars,
        failNotes: failNotes.slice(0, 5),
      })

      process.stdout.write('\n')
    }

    const filtered = results
      .filter((r) => r.passRate >= minPassRate)
      .sort((a, b) => {
        if (b.passRate !== a.passRate) return b.passRate - a.passRate
        if (a.avgLatencyMs !== b.avgLatencyMs) return a.avgLatencyMs - b.avgLatencyMs
        return b.avgTotalTokens - a.avgTotalTokens
      })

    const finalList = topN > 0 ? filtered.slice(0, topN) : filtered
    const excludedByMinPassRate = results
      .filter((r) => r.passRate < minPassRate)
      .sort((a, b) => a.passRate - b.passRate)

    const excludedByTopN = topN > 0 ? filtered.slice(topN) : []

    process.stdout.write('=== Summary (ranked) ===\n')
    const header = [
      padRight('passRate', 8),
      padRight('pass/fail', 9),
      padRight('avgLat', 8),
      padRight('avgTok', 8),
      padRight('avgChars', 9),
      'model',
    ].join('  ')
    process.stdout.write(header + '\n')

    for (const r of finalList) {
      const line = [
        padRight((r.passRate * 100).toFixed(0) + '%', 8),
        padRight(`${r.pass}/${r.fail}`, 9),
        padRight(formatMs(r.avgLatencyMs), 8),
        padRight(Number.isFinite(r.avgTotalTokens) ? String(Math.round(r.avgTotalTokens)) : '-', 8),
        padRight(Number.isFinite(r.avgChars) ? String(Math.round(r.avgChars)) : '-', 9),
        r.model,
      ].join('  ')
      process.stdout.write(line + '\n')
    }

    if (minPassRate > 0) {
      process.stdout.write(`\nfiltered by minPassRate=${minPassRate}\n`)
    }
    if (topN > 0) {
      process.stdout.write(`topN=${topN}\n`)
    }

    if (excludedByMinPassRate.length > 0) {
      process.stdout.write('\n=== Excluded (minPassRate) ===\n')
      for (const r of excludedByMinPassRate) {
        const note = r.failNotes && r.failNotes.length > 0 ? r.failNotes[0] : ''
        process.stdout.write(`${(r.passRate * 100).toFixed(0)}%  ${r.pass}/${r.fail}  ${r.model}${note ? `  (${note})` : ''}\n`)
      }
    }

    if (excludedByTopN.length > 0) {
      process.stdout.write('\n=== Excluded (topN cutoff) ===\n')
      for (const r of excludedByTopN) {
        const note = r.failNotes && r.failNotes.length > 0 ? r.failNotes[0] : ''
        process.stdout.write(`${(r.passRate * 100).toFixed(0)}%  ${r.pass}/${r.fail}  ${r.model}${note ? `  (${note})` : ''}\n`)
      }
    }

    process.stdout.write('\nOK\n')
    return 0
  } finally {
    // prisma is in dist/config/database.js singleton; still safe to disconnect here.
    const { prisma } = requireFromDist('config/database.js')
    await prisma.$disconnect().catch(() => {})
  }
}

main()
  .then((code) => process.exit(Number.isFinite(code) ? code : 0))
  .catch((err) => {
    process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
    process.exit(1)
  })
