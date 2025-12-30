/*
  AC verification for chatId SoT (server-side resolution)

  Verifies:
  - If chatId is missing, server creates a new Chat for (userId, characterId)
  - If chatId belongs to same user+character, it is reused
  - If chatId belongs to same user but different character, a new chat is created

  How to run:
    npm run build
    node scripts/verify_chatid_sot_ac.js

  Notes:
  - Requires DATABASE_URL configured (Prisma PostgreSQL).
*/

const assert = require('assert')
const path = require('path')
const fs = require('fs')

// Load local env if present (packages/backend/.env)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
} catch {}

function requireFromDist(relPathFromDist) {
  const distPath = path.join(__dirname, '..', 'dist', ...relPathFromDist.split('/'))
  if (!fs.existsSync(distPath)) {
    throw new Error(`Missing build output: ${distPath}. Run "npm run build" in packages/backend first.`)
  }
  return require(distPath)
}

process.exitCode = 0
let hadFailure = false

function test(name, fn) {
  try {
    const ret = fn()
    if (ret && typeof ret.then === 'function') {
      return ret
        .then(() => process.stdout.write(`PASS  ${name}\n`))
        .catch((err) => {
          process.stderr.write(`FAIL  ${name}\n`)
          process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
          process.exitCode = 1
          hadFailure = true
        })
    }

    process.stdout.write(`PASS  ${name}\n`)
  } catch (err) {
    process.stderr.write(`FAIL  ${name}\n`)
    process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
    process.exitCode = 1
    hadFailure = true
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    process.stdout.write('SKIP  DATABASE_URL is not set; chatId SoT AC requires a DB connection.\n')
    process.exit(0)
  }

  const { prisma } = requireFromDist('config/database.js')
  const { resolveOrCreateChatId } = requireFromDist('services/chat/ChatSessionService.js')

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const email = `sot_ac_${suffix}@example.com`
  const username = `sot_ac_${suffix}`

  const createdChatIds = []
  let user
  let characterA
  let characterB

  try {
    user = await prisma.user.create({
      data: {
        email,
        username,
        password: 'ac_test_password',
      },
      select: { id: true },
    })

    characterA = await prisma.character.create({
      data: {
        name: `SOT_AC_CHAR_A_${suffix}`,
        systemPrompt: 'SOT AC character A system prompt',
        description: 'ac',
        personality: 'ac',
        tags: [],
        isActive: true,
      },
      select: { id: true },
    })

    characterB = await prisma.character.create({
      data: {
        name: `SOT_AC_CHAR_B_${suffix}`,
        systemPrompt: 'SOT AC character B system prompt',
        description: 'ac',
        personality: 'ac',
        tags: [],
        isActive: true,
      },
      select: { id: true },
    })

    await test('SoT: missing chatId creates a new chat', async () => {
      const res = await resolveOrCreateChatId({
        prisma,
        userId: user.id,
        characterId: characterA.id,
        chatId: undefined,
      })

      assert.ok(res.chatId, 'expected chatId to be created')
      createdChatIds.push(res.chatId)

      const found = await prisma.chat.findFirst({ where: { id: res.chatId }, select: { id: true, userId: true, characterId: true } })
      assert.ok(found, 'created chat must exist')
      assert.strictEqual(found.userId, user.id)
      assert.strictEqual(found.characterId, characterA.id)
    })

    await test('SoT: valid chatId for same user+character is reused', async () => {
      const base = await prisma.chat.create({
        data: { userId: user.id, characterId: characterA.id },
        select: { id: true },
      })
      createdChatIds.push(base.id)

      const res = await resolveOrCreateChatId({
        prisma,
        userId: user.id,
        characterId: characterA.id,
        chatId: base.id,
      })

      assert.strictEqual(res.chatId, base.id)
    })

    await test('SoT: chatId for same user but different character creates a new chat', async () => {
      const wrong = await prisma.chat.create({
        data: { userId: user.id, characterId: characterB.id },
        select: { id: true },
      })
      createdChatIds.push(wrong.id)

      const res = await resolveOrCreateChatId({
        prisma,
        userId: user.id,
        characterId: characterA.id,
        chatId: wrong.id,
      })

      assert.ok(res.chatId, 'expected a new chatId')
      assert.notStrictEqual(res.chatId, wrong.id, 'must not reuse a chat from another character')
      createdChatIds.push(res.chatId)

      const found = await prisma.chat.findFirst({ where: { id: res.chatId }, select: { id: true, userId: true, characterId: true } })
      assert.ok(found, 'created chat must exist')
      assert.strictEqual(found.userId, user.id)
      assert.strictEqual(found.characterId, characterA.id)
    })
  } finally {
    // Cleanup in reverse dependency order.
    for (const chatId of createdChatIds.reverse()) {
      try {
        await prisma.chat.delete({ where: { id: chatId } })
      } catch {}
    }

    if (characterA?.id) {
      try { await prisma.character.delete({ where: { id: characterA.id } }) } catch {}
    }
    if (characterB?.id) {
      try { await prisma.character.delete({ where: { id: characterB.id } }) } catch {}
    }
    if (user?.id) {
      try { await prisma.user.delete({ where: { id: user.id } }) } catch {}
    }

    try {
      await prisma.$disconnect()
    } catch {}
  }

  if (!hadFailure) {
    process.stdout.write('\nAll chatId SoT AC checks passed.\n')
  }

  process.exit(hadFailure ? 1 : 0)
}

run().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
  process.exit(1)
})
