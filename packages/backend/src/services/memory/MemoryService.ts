/**
 * 메모리 서비스
 * 캐릭터별 장기 기억 관리 (저장, 조회, 수정, 삭제)
 */

import { prisma } from '../../config/database'
import { 
  ChatMessageModel, 
  MemorySummaryArchiveModel,
  ArchivedMemoryModel 
} from '../../models/memory'
import { 
  MemoryConfig, 
  EpisodicMemoryData, 
  SemanticMemoryData, 
  EmotionalMemoryData,
  MemoryData,
  SemanticCategory,
  EmotionType,
  MemoryListResponse
} from '../../models/memory/types'
import { embeddingService } from './EmbeddingService'
import { logger } from '../../utils/logger'

const DEFAULT_MAX_MEMORIES = 30
const MEMORY_EXPIRY_DAYS = 90  // 비활성 계정 만료

export class MemoryService {
  // =====================================================
  // 메모리 설정 관리
  // =====================================================

  /**
   * 캐릭터별 메모리 설정 조회 또는 생성
   */
  async getOrCreateConfig(userId: string, characterId: string): Promise<MemoryConfig> {
    let config = await prisma.characterMemoryConfig.findUnique({
      where: {
        userId_characterId: { userId, characterId }
      }
    })

    if (!config) {
      config = await prisma.characterMemoryConfig.create({
        data: {
          userId,
          characterId,
          maxMemories: DEFAULT_MAX_MEMORIES,
          totalMemories: 0,
          summarizedTokens: 0,
          contextUsagePercent: 0
        }
      })
    }

    // lastAccessAt 업데이트
    await prisma.characterMemoryConfig.update({
      where: { id: config.id },
      data: { lastAccessAt: new Date() }
    })

    return {
      userId: config.userId,
      characterId: config.characterId,
      maxMemories: config.maxMemories,
      totalMemories: config.totalMemories,
      summarizedTokens: config.summarizedTokens,
      lastContextCheck: config.lastContextCheck || undefined,
      contextUsagePercent: config.contextUsagePercent,
      lastAccessAt: config.lastAccessAt
    }
  }

  /**
   * 메모리 용량 증가 (포인트 결제 후)
   */
  async increaseMemoryCapacity(
    userId: string, 
    characterId: string, 
    additionalSlots: number
  ): Promise<MemoryConfig> {
    const config = await prisma.characterMemoryConfig.update({
      where: {
        userId_characterId: { userId, characterId }
      },
      data: {
        maxMemories: { increment: additionalSlots }
      }
    })

    logger.info(`메모리 용량 증가: ${userId}/${characterId} +${additionalSlots}`)
    
    return this.getOrCreateConfig(userId, characterId)
  }

  // =====================================================
  // 에피소드 메모리
  // =====================================================

  /**
   * 에피소드 메모리 생성
   */
  async createEpisodicMemory(
    userId: string,
    characterId: string,
    data: {
      summary: string
      context?: string
      originalMessageIds: string[]
      messageRange?: {
        startMessageId: string
        endMessageId: string
        startTime: Date
        endTime: Date
      }
      importance?: number
    }
  ): Promise<EpisodicMemoryData> {
    const config = await this.getOrCreateConfig(userId, characterId)
    
    // 용량 체크
    if (config.totalMemories >= config.maxMemories) {
      // 가장 오래된 낮은 중요도 메모리 삭제 또는 아카이브
      await this.archiveOldestMemory(config.userId, config.characterId)
    }

    // 메모리 생성
    const memory = await prisma.episodicMemory.create({
      data: {
        configId: (await prisma.characterMemoryConfig.findUnique({
          where: { userId_characterId: { userId, characterId } }
        }))!.id,
        summary: data.summary,
        context: data.context,
        originalMessageIds: data.originalMessageIds,
        messageRange: data.messageRange,
        importance: data.importance ?? 0.5,
        accessCount: 0,
        lastAccessed: new Date(),
        isEdited: false
      }
    })

    // 임베딩 생성 및 저장
    try {
      const embeddingId = await embeddingService.saveMemoryEmbedding(
        memory.id,
        'episodic',
        data.summary
      )
      
      await prisma.episodicMemory.update({
        where: { id: memory.id },
        data: { embeddingId }
      })
    } catch (error) {
      logger.error('임베딩 저장 실패:', error)
    }

    // 메모리 카운트 증가
    await prisma.characterMemoryConfig.update({
      where: { userId_characterId: { userId, characterId } },
      data: { totalMemories: { increment: 1 } }
    })

    return this.formatEpisodicMemory(memory)
  }

  /**
   * 에피소드 메모리 조회
   */
  async getEpisodicMemories(
    userId: string,
    characterId: string,
    options: {
      page?: number
      limit?: number
      sortBy?: 'importance' | 'createdAt' | 'lastAccessed'
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<MemoryListResponse> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options

    const config = await prisma.characterMemoryConfig.findUnique({
      where: { userId_characterId: { userId, characterId } }
    })

    if (!config) {
      return { memories: [], total: 0, page, limit }
    }

    const [memories, total] = await Promise.all([
      prisma.episodicMemory.findMany({
        where: { configId: config.id },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.episodicMemory.count({
        where: { configId: config.id }
      })
    ])

    return {
      memories: memories.map(m => this.formatEpisodicMemory(m)),
      total,
      page,
      limit
    }
  }

  /**
   * 에피소드 메모리 수정 (사용자 커스터마이징)
   */
  async updateEpisodicMemory(
    memoryId: string,
    userId: string,
    updates: {
      summary?: string
      importance?: number
    }
  ): Promise<EpisodicMemoryData> {
    const memory = await prisma.episodicMemory.findFirst({
      where: { id: memoryId },
      include: { config: true }
    })

    if (!memory || memory.config.userId !== userId) {
      throw new Error('메모리를 찾을 수 없거나 권한이 없습니다')
    }

    const updateData: Record<string, unknown> = {
      isEdited: true,
      editedAt: new Date()
    }

    if (updates.summary && updates.summary !== memory.summary) {
      updateData.originalSummary = memory.originalSummary || memory.summary
      updateData.summary = updates.summary

      // 임베딩 업데이트
      await embeddingService.saveMemoryEmbedding(memoryId, 'episodic', updates.summary)
    }

    if (updates.importance !== undefined) {
      updateData.importance = updates.importance
    }

    const updated = await prisma.episodicMemory.update({
      where: { id: memoryId },
      data: updateData
    })

    return this.formatEpisodicMemory(updated)
  }

  // =====================================================
  // 의미적 메모리
  // =====================================================

  /**
   * 의미적 메모리 생성
   */
  async createSemanticMemory(
    userId: string,
    characterId: string,
    data: {
      category: SemanticCategory
      key: string
      value: string
      context?: string
      confidence?: number
      sourceMessageId?: string
      importance?: number
    }
  ): Promise<SemanticMemoryData> {
    const config = await this.getOrCreateConfig(userId, characterId)

    // 동일한 key가 있으면 업데이트
    const existing = await prisma.semanticMemory.findFirst({
      where: {
        configId: (await prisma.characterMemoryConfig.findUnique({
          where: { userId_characterId: { userId, characterId } }
        }))!.id,
        key: data.key
      }
    })

    if (existing) {
      // 기존 메모리 업데이트
      const updated = await prisma.semanticMemory.update({
        where: { id: existing.id },
        data: {
          value: data.value,
          context: data.context,
          confidence: data.confidence ?? existing.confidence,
          importance: data.importance ?? existing.importance,
          updatedAt: new Date()
        }
      })

      // 임베딩 업데이트
      await embeddingService.saveMemoryEmbedding(
        updated.id,
        'semantic',
        `${data.key}: ${data.value}`
      )

      return this.formatSemanticMemory(updated)
    }

    // 용량 체크
    if (config.totalMemories >= config.maxMemories) {
      await this.archiveOldestMemory(userId, characterId)
    }

    const memory = await prisma.semanticMemory.create({
      data: {
        configId: (await prisma.characterMemoryConfig.findUnique({
          where: { userId_characterId: { userId, characterId } }
        }))!.id,
        category: data.category,
        key: data.key,
        value: data.value,
        context: data.context,
        confidence: data.confidence ?? 0.8,
        sourceMessageId: data.sourceMessageId,
        importance: data.importance ?? 0.7,
        accessCount: 0,
        lastAccessed: new Date(),
        isEdited: false
      }
    })

    // 임베딩 저장
    try {
      const embeddingId = await embeddingService.saveMemoryEmbedding(
        memory.id,
        'semantic',
        `${data.key}: ${data.value}`
      )
      
      await prisma.semanticMemory.update({
        where: { id: memory.id },
        data: { embeddingId }
      })
    } catch (error) {
      logger.error('임베딩 저장 실패:', error)
    }

    // 메모리 카운트 증가
    await prisma.characterMemoryConfig.update({
      where: { userId_characterId: { userId, characterId } },
      data: { totalMemories: { increment: 1 } }
    })

    return this.formatSemanticMemory(memory)
  }

  /**
   * 의미적 메모리 조회
   */
  async getSemanticMemories(
    userId: string,
    characterId: string,
    options: {
      category?: SemanticCategory
      page?: number
      limit?: number
    } = {}
  ): Promise<MemoryListResponse> {
    const { category, page = 1, limit = 20 } = options

    const config = await prisma.characterMemoryConfig.findUnique({
      where: { userId_characterId: { userId, characterId } }
    })

    if (!config) {
      return { memories: [], total: 0, page, limit }
    }

    const where: Record<string, unknown> = { configId: config.id }
    if (category) where.category = category

    const [memories, total] = await Promise.all([
      prisma.semanticMemory.findMany({
        where,
        orderBy: { importance: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.semanticMemory.count({ where })
    ])

    return {
      memories: memories.map(m => this.formatSemanticMemory(m)),
      total,
      page,
      limit
    }
  }

  // =====================================================
  // 감정 메모리
  // =====================================================

  /**
   * 감정 메모리 생성
   */
  async createEmotionalMemory(
    userId: string,
    characterId: string,
    data: {
      emotion: EmotionType
      intensity: number
      trigger: string
      context?: string
      sourceMessageId?: string
      importance?: number
    }
  ): Promise<EmotionalMemoryData> {
    const config = await this.getOrCreateConfig(userId, characterId)

    if (config.totalMemories >= config.maxMemories) {
      await this.archiveOldestMemory(userId, characterId)
    }

    const memory = await prisma.emotionalMemory.create({
      data: {
        configId: (await prisma.characterMemoryConfig.findUnique({
          where: { userId_characterId: { userId, characterId } }
        }))!.id,
        emotion: data.emotion,
        intensity: data.intensity,
        trigger: data.trigger,
        context: data.context,
        sourceMessageId: data.sourceMessageId,
        importance: data.importance ?? 0.6,
        accessCount: 0,
        lastAccessed: new Date()
      }
    })

    // 임베딩 저장
    try {
      const embeddingId = await embeddingService.saveMemoryEmbedding(
        memory.id,
        'emotional',
        `${data.emotion}: ${data.trigger}`
      )
      
      await prisma.emotionalMemory.update({
        where: { id: memory.id },
        data: { embeddingId }
      })
    } catch (error) {
      logger.error('임베딩 저장 실패:', error)
    }

    await prisma.characterMemoryConfig.update({
      where: { userId_characterId: { userId, characterId } },
      data: { totalMemories: { increment: 1 } }
    })

    return this.formatEmotionalMemory(memory)
  }

  // =====================================================
  // 메모리 삭제 및 아카이브
  // =====================================================

  /**
   * 메모리 삭제
   */
  async deleteMemory(
    memoryId: string,
    memoryType: 'episodic' | 'semantic' | 'emotional',
    userId: string
  ): Promise<void> {
    const prismaModel = this.getPrismaModel(memoryType)
    
    const memory = await (prismaModel as any).findFirst({
      where: { id: memoryId },
      include: { config: true }
    })

    if (!memory || memory.config.userId !== userId) {
      throw new Error('메모리를 찾을 수 없거나 권한이 없습니다')
    }

    // MongoDB 아카이브에 기록 (열람용)
    await MemorySummaryArchiveModel.findOneAndUpdate(
      { 'memoryIds.episodic': memoryId },
      { isDeleted: true, deletedAt: new Date() }
    )

    // 임베딩 삭제
    await embeddingService.deleteEmbedding(memoryId)

    // 메모리 삭제
    await (prismaModel as any).delete({ where: { id: memoryId } })

    // 카운트 감소
    await prisma.characterMemoryConfig.update({
      where: { id: memory.configId },
      data: { totalMemories: { decrement: 1 } }
    })

    logger.info(`메모리 삭제: ${memoryType}/${memoryId}`)
  }

  /**
   * 가장 오래된 낮은 중요도 메모리 아카이브
   */
  private async archiveOldestMemory(userId: string, characterId: string): Promise<void> {
    const config = await prisma.characterMemoryConfig.findUnique({
      where: { userId_characterId: { userId, characterId } }
    })

    if (!config) return

    // 가장 낮은 중요도 + 오래된 에피소드 메모리 찾기
    const oldestMemory = await prisma.episodicMemory.findFirst({
      where: { configId: config.id },
      orderBy: [
        { importance: 'asc' },
        { lastAccessed: 'asc' }
      ]
    })

    if (oldestMemory) {
      // MongoDB에 아카이브
      await ArchivedMemoryModel.create({
        userId,
        characterId,
        originalMemoryId: oldestMemory.id,
        memoryType: 'episodic',
        memoryData: oldestMemory,
        archivedReason: 'capacity_limit',
        canRestore: true,
        restoreExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30일
      })

      // 임베딩 삭제
      await embeddingService.deleteEmbedding(oldestMemory.id)

      // 메모리 삭제
      await prisma.episodicMemory.delete({ where: { id: oldestMemory.id } })

      // 카운트 감소
      await prisma.characterMemoryConfig.update({
        where: { id: config.id },
        data: { totalMemories: { decrement: 1 } }
      })

      logger.info(`메모리 아카이브 (용량 초과): ${oldestMemory.id}`)
    }
  }

  /**
   * 비활성 계정 메모리 정리 (90일)
   */
  async cleanupInactiveMemories(): Promise<number> {
    const expiryDate = new Date(Date.now() - MEMORY_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    const inactiveConfigs = await prisma.characterMemoryConfig.findMany({
      where: {
        lastAccessAt: { lt: expiryDate }
      },
      include: {
        episodicMemories: true,
        semanticMemories: true,
        emotionalMemories: true
      }
    })

    let archivedCount = 0

    for (const config of inactiveConfigs) {
      // 모든 메모리 아카이브
      for (const memory of config.episodicMemories) {
        await ArchivedMemoryModel.create({
          userId: config.userId,
          characterId: config.characterId,
          originalMemoryId: memory.id,
          memoryType: 'episodic',
          memoryData: memory,
          archivedReason: 'inactive_account',
          canRestore: true
        })
        await embeddingService.deleteEmbedding(memory.id)
        archivedCount++
      }

      for (const memory of config.semanticMemories) {
        await ArchivedMemoryModel.create({
          userId: config.userId,
          characterId: config.characterId,
          originalMemoryId: memory.id,
          memoryType: 'semantic',
          memoryData: memory,
          archivedReason: 'inactive_account',
          canRestore: true
        })
        await embeddingService.deleteEmbedding(memory.id)
        archivedCount++
      }

      for (const memory of config.emotionalMemories) {
        await ArchivedMemoryModel.create({
          userId: config.userId,
          characterId: config.characterId,
          originalMemoryId: memory.id,
          memoryType: 'emotional',
          memoryData: memory,
          archivedReason: 'inactive_account',
          canRestore: true
        })
        await embeddingService.deleteEmbedding(memory.id)
        archivedCount++
      }

      // Prisma 메모리 삭제
      await prisma.episodicMemory.deleteMany({ where: { configId: config.id } })
      await prisma.semanticMemory.deleteMany({ where: { configId: config.id } })
      await prisma.emotionalMemory.deleteMany({ where: { configId: config.id } })

      // 설정 초기화
      await prisma.characterMemoryConfig.update({
        where: { id: config.id },
        data: { totalMemories: 0 }
      })

      logger.info(`비활성 계정 메모리 아카이브: ${config.userId}/${config.characterId}`)
    }

    return archivedCount
  }

  // =====================================================
  // 유틸리티
  // =====================================================

  private getPrismaModel(type: 'episodic' | 'semantic' | 'emotional') {
    switch (type) {
      case 'episodic': return prisma.episodicMemory
      case 'semantic': return prisma.semanticMemory
      case 'emotional': return prisma.emotionalMemory
    }
  }

  private formatEpisodicMemory(memory: any): EpisodicMemoryData {
    return {
      id: memory.id,
      configId: memory.configId,
      type: 'episodic',
      summary: memory.summary,
      context: memory.context || undefined,
      originalMessageIds: memory.originalMessageIds,
      messageRange: memory.messageRange || undefined,
      importance: memory.importance,
      accessCount: memory.accessCount,
      lastAccessed: memory.lastAccessed,
      embeddingId: memory.embeddingId || undefined,
      isEdited: memory.isEdited,
      editedAt: memory.editedAt || undefined,
      originalSummary: memory.originalSummary || undefined,
      expiresAt: memory.expiresAt || undefined,
      createdAt: memory.createdAt
    }
  }

  private formatSemanticMemory(memory: any): SemanticMemoryData {
    return {
      id: memory.id,
      configId: memory.configId,
      type: 'semantic',
      category: memory.category,
      key: memory.key,
      value: memory.value,
      context: memory.context || undefined,
      confidence: memory.confidence,
      sourceMessageId: memory.sourceMessageId || undefined,
      importance: memory.importance,
      accessCount: memory.accessCount,
      lastAccessed: memory.lastAccessed,
      embeddingId: memory.embeddingId || undefined,
      isEdited: memory.isEdited,
      editedAt: memory.editedAt || undefined,
      createdAt: memory.createdAt
    }
  }

  private formatEmotionalMemory(memory: any): EmotionalMemoryData {
    return {
      id: memory.id,
      configId: memory.configId,
      type: 'emotional',
      emotion: memory.emotion as EmotionType,
      intensity: memory.intensity,
      trigger: memory.trigger,
      context: memory.context || undefined,
      sourceMessageId: memory.sourceMessageId || undefined,
      importance: memory.importance,
      accessCount: memory.accessCount,
      lastAccessed: memory.lastAccessed,
      embeddingId: memory.embeddingId || undefined,
      createdAt: memory.createdAt
    }
  }
}

export const memoryService = new MemoryService()

