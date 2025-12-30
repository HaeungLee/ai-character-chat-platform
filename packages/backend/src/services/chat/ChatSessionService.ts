import type { PrismaClient } from '@prisma/client'

export async function resolveOrCreateChatId(params: {
  prisma: PrismaClient
  userId?: string
  characterId: string
  chatId?: unknown
}): Promise<{ chatId?: string }> {
  const { prisma, userId, characterId, chatId } = params

  // If unauthenticated, we cannot create/validate a user chat session.
  if (!userId) return { chatId: typeof chatId === 'string' && chatId ? chatId : undefined }

  const requestedChatId = typeof chatId === 'string' ? chatId.trim() : ''

  if (requestedChatId) {
    const existing = await prisma.chat.findFirst({
      where: { id: requestedChatId, userId },
      select: { id: true, characterId: true },
    })

    if (existing && existing.characterId === characterId) {
      return { chatId: existing.id }
    }
  }

  const created = await prisma.chat.create({
    data: {
      userId,
      characterId,
    },
    select: { id: true },
  })

  return { chatId: created.id }
}
