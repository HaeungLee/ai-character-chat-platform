const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const suffix = Date.now().toString();

  const user = await prisma.user.create({
    data: {
      email: `u${suffix}@t.dev`,
      username: `u${suffix}`,
      password: 'x',
    },
  });

  const character = await prisma.character.create({
    data: {
      name: `c${suffix}`,
      systemPrompt: 'x',
    },
  });

  const config = await prisma.characterMemoryConfig.create({
    data: {
      userId: user.id,
      characterId: character.id,
    },
  });

  await prisma.semanticMemory.create({
    data: {
      configId: config.id,
      category: 'RELATIONSHIP',
      key: 'state',
      value: 'v1',
    },
  });

  try {
    await prisma.semanticMemory.create({
      data: {
        configId: config.id,
        category: 'RELATIONSHIP',
        key: 'state',
        value: 'v2',
      },
    });

    console.log('ERROR: duplicate semantic memory insert succeeded');
    process.exitCode = 2;
  } catch (error) {
    // Prisma error codes: P2002 unique constraint
    console.log('OK: duplicate semantic memory insert blocked');
    console.log(String(error.code || error.message));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
