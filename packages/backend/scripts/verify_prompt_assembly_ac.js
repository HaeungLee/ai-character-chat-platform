/*
  AC verification for Prompt Assembly v1
  - Uses compiled dist output to avoid needing ts-jest/ts-node in test runtime.

  How to run:
    npm run build
    node scripts/verify_prompt_assembly_ac.js
*/

const assert = require('assert')
const path = require('path')
const fs = require('fs')

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
    fn()
    process.stdout.write(`PASS  ${name}\n`)
  } catch (err) {
    process.stderr.write(`FAIL  ${name}\n`)
    process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
    process.exitCode = 1
  }
}

function contains(haystack, needle, message) {
  assert.ok(
    haystack.includes(needle),
    message || `Expected to include substring: ${JSON.stringify(needle)}`
  )
}

function notContains(haystack, needle, message) {
  assert.ok(
    !haystack.includes(needle),
    message || `Expected NOT to include substring: ${JSON.stringify(needle)}`
  )
}

const { assembleSystemPrompt } = requireFromDist('services/prompt/PromptAssembly.js')

test('Lorebook: triggers only matched keys, sorted by priority, limited by maxLorebookEntries', () => {
  const lorebookEntries = [
    { id: 'a', keys: ['dragon', '용'], content: '드래곤은 신성한 존재다.', priority: 5 },
    { id: 'b', keys: ['용'], content: '이 세계의 용은 말한다.', priority: 10 },
    { id: 'c', keys: ['unmatched'], content: '매칭되면 안 됨', priority: 999 },
  ]

  const result = assembleSystemPrompt({
    baseSystemPrompt: 'You are a character.',
    userMessage: '용에 대해 알려줘',
    lorebookEntries,
    exampleDialoguesJson: null,
    options: { maxLorebookEntries: 1, outputLanguage: 'ko' },
  })

  assert.strictEqual(result.usedLorebookEntries.length, 1)
  assert.strictEqual(result.usedLorebookEntries[0].id, 'b')

  contains(result.assembledSystemPrompt, '[LOREBOOK]')
  contains(result.assembledSystemPrompt, '이 세계의 용은 말한다.')
  notContains(result.assembledSystemPrompt, '매칭되면 안 됨')
})

test('Lorebook: when no key matches, lorebook block is omitted', () => {
  const lorebookEntries = [
    { id: 'a', keys: ['용'], content: 'should not appear', priority: 1 },
  ]

  const result = assembleSystemPrompt({
    baseSystemPrompt: 'You are a character.',
    userMessage: 'completely unrelated text',
    lorebookEntries,
    exampleDialoguesJson: null,
    options: { outputLanguage: 'ko' },
  })

  assert.strictEqual(result.usedLorebookEntries.length, 0)
  notContains(result.assembledSystemPrompt, '[LOREBOOK]')
  notContains(result.assembledSystemPrompt, 'should not appear')
})

test('Examples: parses JSON and injects [EXAMPLES] (clamped by maxExamplesChars)', () => {
  const examples = [
    { user: '안녕', assistant: '안녕하세요. 반가워요.' },
    { role: 'user', content: '너의 말투를 보여줘' },
    { role: 'assistant', content: '좋아요. 이렇게 말해요.' },
  ]

  const result = assembleSystemPrompt({
    baseSystemPrompt: 'You are a character.',
    userMessage: '테스트',
    lorebookEntries: [],
    exampleDialoguesJson: JSON.stringify(examples),
    options: { maxExamplesChars: 80, outputLanguage: 'ko' },
  })

  assert.ok(result.usedExamples.length >= 2)
  contains(result.assembledSystemPrompt, '[EXAMPLES]')
  // Because we clamp, the exact last line may be truncated; just ensure prefix exists.
  contains(result.assembledSystemPrompt, 'User: 안녕')
})

test('Hard rules: included by default and respects outputLanguage', () => {
  const ko = assembleSystemPrompt({
    baseSystemPrompt: 'You are a character.',
    userMessage: '테스트',
    lorebookEntries: [],
    exampleDialoguesJson: null,
    options: { outputLanguage: 'ko' },
  })

  contains(ko.assembledSystemPrompt, '[HARD_RULES]')
  contains(ko.assembledSystemPrompt, '모든 응답은 한국어로 작성하세요.')

  const en = assembleSystemPrompt({
    baseSystemPrompt: 'You are a character.',
    userMessage: 'test',
    lorebookEntries: [],
    exampleDialoguesJson: null,
    options: { outputLanguage: 'en' },
  })

  contains(en.assembledSystemPrompt, '[HARD_RULES]')
  contains(en.assembledSystemPrompt, 'Write all responses in English.')
})

if (!process.exitCode) {
  process.stdout.write('\nAll Prompt Assembly AC checks passed.\n')
}
