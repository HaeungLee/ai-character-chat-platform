/*
  List active characters (id + name) from Postgres via Prisma.

  Usage:
    npm run build
    node scripts/list_characters.js

  Notes:
    - Reads packages/backend/.env if available.
    - Uses compiled dist output.
*/

const path = require('path')
const fs = require('fs')

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
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const take = Number.isFinite(Number(args.take)) ? Math.max(1, Math.min(200, Number(args.take))) : 50

  const { prisma } = requireFromDist('config/database.js')

  try {
    const characters = await prisma.character.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      take,
      select: { id: true, name: true, isActive: true, updatedAt: true },
    })

    if (!characters.length) {
      process.stdout.write('No active characters found.\n')
      return
    }

    process.stdout.write(`Active characters (showing ${characters.length}):\n`)
    for (const c of characters) {
      process.stdout.write(`- ${c.id}  ${c.name}\n`)
    }
  } finally {
    await prisma.$disconnect().catch(() => {})
  }

  process.exit(0)
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`)
  process.exit(1)
})
