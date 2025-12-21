import { Response } from 'express'
import { prisma } from '../config/database'
import { AuthenticatedRequest } from '../middleware/auth'

export class ChatController {
  // Ensure (get latest or create) a chat session for the current user and character.
  ensureChatForCharacter = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      const { characterId } = req.body as { characterId?: string }

      if (!userId) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' })
      }

      if (!characterId) {
        return res.status(400).json({ success: false, error: 'characterId는 필수입니다.' })
      }

      const character = await prisma.character.findUnique({
        where: { id: characterId },
        select: { id: true, name: true },
      })

      if (!character) {
        return res.status(404).json({ success: false, error: '캐릭터를 찾을 수 없습니다.' })
      }

      const existing = await prisma.chat.findFirst({
        where: { userId, characterId },
        orderBy: { lastActivity: 'desc' },
        select: {
          id: true,
          title: true,
          characterId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          lastActivity: true,
          messageCount: true,
        },
      })

      if (existing) {
        return res.json({ success: true, data: { chat: existing, created: false } })
      }

      const createdChat = await prisma.chat.create({
        data: {
          userId,
          characterId,
          title: `${character.name}`,
          lastActivity: new Date(),
        },
        select: {
          id: true,
          title: true,
          characterId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          lastActivity: true,
          messageCount: true,
        },
      })

      return res.json({ success: true, data: { chat: createdChat, created: true } })
    } catch (error) {
      return res.status(500).json({ success: false, error: '채팅 세션 생성/조회 중 오류가 발생했습니다.' })
    }
  }

  listChats = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' })
      }

      const characterId = typeof req.query.characterId === 'string' ? req.query.characterId : undefined

      const chats = await prisma.chat.findMany({
        where: {
          userId,
          ...(characterId ? { characterId } : {}),
        },
        orderBy: { lastActivity: 'desc' },
        select: {
          id: true,
          title: true,
          characterId: true,
          messageCount: true,
          totalTokens: true,
          createdAt: true,
          updatedAt: true,
          lastActivity: true,
        },
      })

      return res.json({ success: true, data: chats })
    } catch (error) {
      return res.status(500).json({ success: false, error: '채팅 목록 조회 중 오류가 발생했습니다.' })
    }
  }

  getChatMessages = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' })
      }

      const chatId = req.params.chatId
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100

      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userId },
        select: { id: true },
      })

      if (!chat) {
        return res.status(404).json({ success: false, error: '채팅을 찾을 수 없습니다.' })
      }

      const messages = await prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          metadata: true,
        },
      })

      return res.json({ success: true, data: messages })
    } catch (error) {
      return res.status(500).json({ success: false, error: '메시지 조회 중 오류가 발생했습니다.' })
    }
  }

  upsertMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' })
      }

      const chatId = req.params.chatId
      const { id, role, content, createdAt, metadata } = req.body as {
        id?: string
        role?: 'USER' | 'ASSISTANT' | 'SYSTEM'
        content?: string
        createdAt?: string
        metadata?: unknown
      }

      if (!id) {
        return res.status(400).json({ success: false, error: 'message id는 필수입니다.' })
      }

      if (!role || !['USER', 'ASSISTANT', 'SYSTEM'].includes(role)) {
        return res.status(400).json({ success: false, error: 'role이 올바르지 않습니다.' })
      }

      if (typeof content !== 'string') {
        return res.status(400).json({ success: false, error: 'content는 문자열이어야 합니다.' })
      }

      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userId },
        select: { id: true },
      })

      if (!chat) {
        return res.status(404).json({ success: false, error: '채팅을 찾을 수 없습니다.' })
      }

      const createdAtDate = createdAt ? new Date(createdAt) : new Date()

      const existed = await prisma.message.findUnique({
        where: { id },
        select: { id: true },
      })

      const message = await prisma.message.upsert({
        where: { id },
        create: {
          id,
          chatId,
          role,
          content,
          createdAt: createdAtDate,
          metadata: (metadata ?? null) as any,
        },
        update: {
          role,
          content,
          metadata: (metadata ?? null) as any,
        },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          metadata: true,
        },
      })

      await prisma.chat.update({
        where: { id: chatId },
        data: {
          lastActivity: new Date(),
          ...(existed ? {} : { messageCount: { increment: 1 } }),
        },
      }).catch(() => {})

      return res.json({ success: true, data: message })
    } catch (error) {
      return res.status(500).json({ success: false, error: '메시지 저장 중 오류가 발생했습니다.' })
    }
  }

  updateMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' })
      }

      const { chatId, messageId } = req.params
      const { content } = req.body as { content?: string }

      if (typeof content !== 'string') {
        return res.status(400).json({ success: false, error: 'content는 문자열이어야 합니다.' })
      }

      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          chatId,
          chat: { userId },
        },
        select: { id: true },
      })

      if (!message) {
        return res.status(404).json({ success: false, error: '메시지를 찾을 수 없습니다.' })
      }

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { content },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
          metadata: true,
        },
      })

      await prisma.chat.update({
        where: { id: chatId },
        data: { lastActivity: new Date() },
      }).catch(() => {})

      return res.json({ success: true, data: updated })
    } catch (error) {
      return res.status(500).json({ success: false, error: '메시지 수정 중 오류가 발생했습니다.' })
    }
  }

  truncateAfter = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' })
      }

      const chatId = req.params.chatId
      const { afterMessageId } = req.body as { afterMessageId?: string }

      if (!afterMessageId) {
        return res.status(400).json({ success: false, error: 'afterMessageId는 필수입니다.' })
      }

      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userId },
        select: { id: true },
      })

      if (!chat) {
        return res.status(404).json({ success: false, error: '채팅을 찾을 수 없습니다.' })
      }

      const pivot = await prisma.message.findFirst({
        where: { id: afterMessageId, chatId },
        select: { id: true, createdAt: true },
      })

      if (!pivot) {
        return res.status(404).json({ success: false, error: '기준 메시지를 찾을 수 없습니다.' })
      }

      await prisma.message.deleteMany({
        where: {
          chatId,
          createdAt: { gt: pivot.createdAt },
        },
      })

      const count = await prisma.message.count({ where: { chatId } })
      await prisma.chat.update({
        where: { id: chatId },
        data: { messageCount: count, lastActivity: new Date() },
      })

      return res.json({ success: true, data: { chatId, messageCount: count } })
    } catch (error) {
      return res.status(500).json({ success: false, error: '대화 정리(truncate) 중 오류가 발생했습니다.' })
    }
  }
}
