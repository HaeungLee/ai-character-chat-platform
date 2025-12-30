/*
  AC verification for unified Character Chat Turn Pipeline (REST/SSE)
  - Ensures REST/SSE share prompt assembly path (lorebook trigger present in systemPrompt)
  - Ensures SSE does NOT run memory afterMessageProcess until the final response is complete.

  How to run:
    npm run build
    node scripts/verify_character_chat_turn_ac.js
*/

const assert = require('assert')
const path = require('path')
const fs = require('fs')

process.exitCode = 0
let hadFailure = false

function requireFromDist(relPathFromDist) {
  const distPath = path.join(__dirname, '..', 'dist', ...relPathFromDist.split('/'))
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Missing build output: ${distPath}. Run \"npm run build\" in packages/backend first.`
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(distPath)
}

function test(name, fn) {
  try {
    const ret = fn()
    if (ret && typeof ret.then === 'function') {
      return ret
        .then(() => process.stdout.write(`PASS  ${name}\n`))
        .catch((err) => {
          process.stderr.write(`FAIL  ${name}\n`)
          process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
          hadFailure = true
          process.exitCode = 1
        })
    }

    process.stdout.write(`PASS  ${name}\n`)
  } catch (err) {
    process.stderr.write(`FAIL  ${name}\n`)
    process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
    hadFailure = true
    process.exitCode = 1
  }
}

async function run() {
  const { runCharacterChatTurnRest, runCharacterChatTurnSse } = requireFromDist(
    'services/chat/CharacterChatTurnPipeline.js'
  )

  const memoryModule = requireFromDist('services/memory/index.js')
  const memoryIntegration = memoryModule.memoryIntegration

  const originalAfter = memoryIntegration.afterMessageProcess
  const originalBefore = memoryIntegration.beforeMessageProcess

  const calls = []
  memoryIntegration.afterMessageProcess = async (msg, characterName) => {
    calls.push({ t: Date.now(), msg, characterName })
    return { ok: true }
  }

  // Ensure we don't accidentally hit real memory/RAG.
  memoryIntegration.beforeMessageProcess = async (userId, characterId, characterName, userMessage, systemPrompt) => {
    return {
      systemPrompt: `${systemPrompt}\n---\n[RAG_DISABLED_IN_TEST]`,
      ragContext: { formattedContext: '', totalTokens: 0 },
    }
  }

  const fakeAiService = {
    generateCharacterResponse: async (_character, _userMessage, _history, _options) => {
      return 'FINAL_RESPONSE_REST'
    },
    generateCharacterResponseStream: async function* (_character, _userMessage, _history, _options) {
      yield 'A'
      yield 'B'
      yield 'C'
    },
  }

  const character = {
    id: 'char_1',
    name: '테스트캐릭터',
    systemPrompt: '기본 프롬프트',
    lorebookEntries: [
      { id: 'l1', keys: ['용'], content: '용은 불을 뿜는다.', priority: 10 },
      { id: 'l2', keys: ['고양이'], content: '고양이는 귀엽다.', priority: 5 },
    ],
    exampleDialogues: JSON.stringify([{ user: '안녕', assistant: '안녕하세요.' }]),
  }

  await test('REST: builds systemPrompt with triggered lorebook and saves memory after final response', async () => {
    calls.length = 0

    const result = await runCharacterChatTurnRest({
      aiService: fakeAiService,
      userId: 'user_1',
      chatId: 'chat_1',
      character,
      userMessage: '용 이야기 해줘',
      conversationHistory: [],
      aiOptions: { provider: 'openrouter' },
      outputLanguage: 'ko',
    })

    assert.strictEqual(result.response, 'FINAL_RESPONSE_REST')
    assert.ok(result.systemPrompt.includes('[LOREBOOK]'), 'systemPrompt should include lorebook block')
    assert.ok(result.systemPrompt.includes('용은 불을 뿜는다.'), 'systemPrompt should include triggered lorebook content')
    assert.ok(!result.systemPrompt.includes('고양이는 귀엽다.'), 'untriggered lorebook content must be omitted')

    assert.strictEqual(calls.length, 2, 'afterMessageProcess should be called twice (user + assistant)')
    assert.strictEqual(calls[0].msg.role, 'user')
    assert.strictEqual(calls[0].msg.content, '용 이야기 해줘')
    assert.strictEqual(calls[1].msg.role, 'assistant')
    assert.strictEqual(calls[1].msg.content, 'FINAL_RESPONSE_REST')
  })

  await test('SSE: yields chunks, and saves memory only after streaming is complete (done)', async () => {
    calls.length = 0

    const stream = runCharacterChatTurnSse({
      aiService: fakeAiService,
      userId: 'user_1',
      chatId: 'chat_1',
      character,
      userMessage: '용 이야기 해줘',
      conversationHistory: [],
      aiOptions: { provider: 'openrouter' },
      outputLanguage: 'ko',
    })

    const events = []
    for await (const evt of stream) {
      events.push(evt)

      // Critical AC: No memory side-effects during chunk streaming.
      if (evt.type === 'chunk') {
        assert.strictEqual(
          calls.length,
          0,
          'afterMessageProcess must not run before streaming completes'
        )
      }
    }

    const chunkText = events
      .filter((e) => e.type === 'chunk')
      .map((e) => e.content)
      .join('')

    assert.strictEqual(chunkText, 'ABC')

    const done = events.find((e) => e.type === 'done')
    assert.ok(done, 'should emit done event')
    assert.strictEqual(done.fullResponse, 'ABC')

    assert.strictEqual(calls.length, 2, 'afterMessageProcess should run twice after stream')
    assert.strictEqual(calls[0].msg.role, 'user')
    assert.strictEqual(calls[1].msg.role, 'assistant')
    assert.strictEqual(calls[1].msg.content, 'ABC', 'assistant memory content must be full final response')
  })

  // Restore
  memoryIntegration.afterMessageProcess = originalAfter
  memoryIntegration.beforeMessageProcess = originalBefore

  if (!process.exitCode) {
    process.stdout.write('\nAll Character Chat Turn AC checks passed.\n')
  }

  process.exit(hadFailure ? 1 : 0)
}

run().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
  process.exit(1)
})
