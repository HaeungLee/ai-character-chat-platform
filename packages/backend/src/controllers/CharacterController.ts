import { Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthenticatedRequest } from '../middleware/auth'
import { logger } from '../utils/logger'

function toIsPublic(category: string | null | undefined): boolean {
  // 스키마에 isPublic이 없어서 category로 간단히 표현
  return (category ?? 'public') !== 'private'
}

export class CharacterController {
  constructor(private prisma: PrismaClient) {}

  // 캐릭터 목록 조회
  listCharacters = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const characters = await this.prisma.character.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          avatar: true,
          description: true,
          personality: true,
          systemPrompt: true,
          tags: true,
          usageCount: true,
          category: true,
          background: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      res.json({
        success: true,
        data: characters.map((c) => ({
          id: c.id,
          name: c.name,
          avatar: c.avatar,
          description: c.description,
          personality: c.personality ?? '',
          systemPrompt: c.systemPrompt,
          tags: c.tags,
          isPublic: toIsPublic(c.category),
          greeting: c.background ?? null, // 임시 저장소: background 필드를 greeting으로 사용
          chatCount: c.usageCount,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      })
    } catch (error) {
      logger.error('캐릭터 목록 조회 실패:', error)
      res.status(500).json({ success: false, error: '캐릭터 목록 조회에 실패했습니다.' })
    }
  }

  // 캐릭터 상세 조회
  getCharacter = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params

      const character = await this.prisma.character.findFirst({
        where: { id, isActive: true },
        include: {
          lorebookEntries: {
            where: { isActive: true },
            orderBy: { priority: 'desc' },
            select: { id: true, keys: true, content: true, priority: true },
          },
        },
      })

      if (!character) {
        return res.status(404).json({ success: false, error: '캐릭터를 찾을 수 없습니다.' })
      }

      res.json({
        success: true,
        data: {
          id: character.id,
          name: character.name,
          avatar: character.avatar,
          description: character.description,
          personality: character.personality ?? '',
          systemPrompt: character.systemPrompt,
          tags: character.tags,
          isPublic: toIsPublic(character.category),
          greeting: character.background ?? null,
          exampleDialogues: character.exampleDialogues,
          lorebookEntries: character.lorebookEntries,
          createdAt: character.createdAt,
          updatedAt: character.updatedAt,
        },
      })
    } catch (error) {
      logger.error('캐릭터 상세 조회 실패:', error)
      res.status(500).json({ success: false, error: '캐릭터 조회에 실패했습니다.' })
    }
  }

  // 캐릭터 생성
  createCharacter = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, personality, systemPrompt, description, tags, isPublic, avatar, greeting, lorebook, examples } =
        req.body ?? {}

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ success: false, error: 'name은 최소 2자 이상이어야 합니다.' })
      }

      if (!systemPrompt || typeof systemPrompt !== 'string' || systemPrompt.trim().length < 5) {
        return res.status(400).json({ success: false, error: 'systemPrompt는 필수입니다.' })
      }

      const safeTags: string[] = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string').slice(0, 10) : []

      const safeLorebook: Array<{ keys: string[]; content: string; priority?: number }> = Array.isArray(lorebook)
        ? lorebook
            .filter((e) => e && Array.isArray(e.keys) && typeof e.content === 'string')
            .map((e) => ({
              keys: e.keys.filter((k: any) => typeof k === 'string').slice(0, 20),
              content: String(e.content),
              priority: typeof e.priority === 'number' ? e.priority : 10,
            }))
        : []

      const safeExamples = Array.isArray(examples) ? examples : []
      const exampleDialoguesJson = safeExamples.length ? JSON.stringify(safeExamples) : null

      const created = await this.prisma.character.create({
        data: {
          name: name.trim(),
          avatar: typeof avatar === 'string' ? avatar : null,
          description: typeof description === 'string' ? description : null,
          personality: typeof personality === 'string' ? personality : null,
          systemPrompt: systemPrompt.trim(),
          tags: safeTags,
          category: isPublic === false ? 'private' : 'public',
          background: typeof greeting === 'string' ? greeting : null,
          exampleDialogues: exampleDialoguesJson,
          lorebookEntries: safeLorebook.length
            ? {
                create: safeLorebook.map((e) => ({
                  keys: e.keys,
                  content: e.content,
                  priority: e.priority ?? 10,
                })),
              }
            : undefined,
        },
        select: {
          id: true,
          name: true,
          avatar: true,
          description: true,
          personality: true,
          systemPrompt: true,
          tags: true,
          category: true,
          background: true,
          createdAt: true,
        },
      })

      res.status(201).json({
        success: true,
        data: {
          id: created.id,
          name: created.name,
          avatar: created.avatar,
          description: created.description,
          personality: created.personality ?? '',
          systemPrompt: created.systemPrompt,
          tags: created.tags,
          isPublic: toIsPublic(created.category),
          greeting: created.background ?? null,
          createdAt: created.createdAt,
        },
      })
    } catch (error) {
      logger.error('캐릭터 생성 실패:', error)
      res.status(500).json({ success: false, error: '캐릭터 생성에 실패했습니다.' })
    }
  }
}
