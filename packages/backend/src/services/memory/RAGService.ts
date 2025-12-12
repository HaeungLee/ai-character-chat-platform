/**
 * RAG (Retrieval-Augmented Generation) 서비스
 * 메모리 검색 및 프롬프트 주입
 */

import { prisma } from '../../config/database'
import { 
  EpisodicMemoryData, 
  SemanticMemoryData, 
  EmotionalMemoryData,
  MemoryData,
  MemorySearchResult,
  RAGContext 
} from '../../models/memory/types'
import { embeddingService } from './EmbeddingService'
import { logger } from '../../utils/logger'

// RAG 설정
const DEFAULT_MEMORY_LIMIT = 5
const DEFAULT_MIN_SIMILARITY = 0.65
const MAX_CONTEXT_TOKENS = 2000  // 메모리 컨텍스트 최대 토큰

export interface RAGOptions {
  memoryTypes?: ('episodic' | 'semantic' | 'emotional')[]
  limit?: number
  minSimilarity?: number
  includeRecent?: boolean
  maxTokens?: number
}

export class RAGService {
  // =====================================================
  // 메모리 검색
  // =====================================================

  /**
   * 관련 메모리 검색
   */
  async searchRelevantMemories(
    userId: string,
    characterId: string,
    query: string,
    options: RAGOptions = {}
  ): Promise<MemorySearchResult[]> {
    const {
      memoryTypes = ['episodic', 'semantic', 'emotional'],
      limit = DEFAULT_MEMORY_LIMIT,
      minSimilarity = DEFAULT_MIN_SIMILARITY,
      includeRecent = true
    } = options

    const config = await prisma.characterMemoryConfig.findUnique({
      where: { userId_characterId: { userId, characterId } }
    })

    if (!config) {
      return []
    }

    const results: MemorySearchResult[] = []

    // 벡터 유사도 검색
    try {
      const similarMemories = await embeddingService.searchSimilarMemories(
        query,
        config.id,
        { memoryTypes, limit: limit * 2, minSimilarity }
      )

      for (const item of similarMemories) {
        const memory = await this.getMemoryById(item.memoryId, item.memoryType as any)
        if (memory) {
          results.push({
            memory,
            score: item.similarity,
            distance: 1 - item.similarity
          })

          // 접근 카운트 증가
          await this.incrementAccessCount(item.memoryId, item.memoryType as any)
        }
      }
    } catch (error) {
      logger.warn('벡터 검색 실패, 최근 메모리로 대체:', error)
    }

    // 최근 메모리 추가 (유사도 검색 결과가 부족할 때)
    if (includeRecent && results.length < limit) {
      const recentMemories = await this.getRecentMemories(
        config.id,
        memoryTypes,
        limit - results.length
      )

      for (const memory of recentMemories) {
        // 중복 방지
        if (!results.find(r => r.memory.id === memory.id)) {
          results.push({
            memory,
            score: 0.5,  // 기본 점수
            distance: 0.5
          })
        }
      }
    }

    // 중요도 및 유사도로 정렬
    return results
      .sort((a, b) => {
        const scoreA = a.score * 0.6 + a.memory.importance * 0.4
        const scoreB = b.score * 0.6 + b.memory.importance * 0.4
        return scoreB - scoreA
      })
      .slice(0, limit)
  }

  /**
   * 메모리 ID로 조회
   */
  private async getMemoryById(
    memoryId: string,
    memoryType: 'episodic' | 'semantic' | 'emotional'
  ): Promise<MemoryData | null> {
    switch (memoryType) {
      case 'episodic': {
        const memory = await prisma.episodicMemory.findUnique({
          where: { id: memoryId }
        })
        return memory ? this.formatEpisodicMemory(memory) : null
      }
      case 'semantic': {
        const memory = await prisma.semanticMemory.findUnique({
          where: { id: memoryId }
        })
        return memory ? this.formatSemanticMemory(memory) : null
      }
      case 'emotional': {
        const memory = await prisma.emotionalMemory.findUnique({
          where: { id: memoryId }
        })
        return memory ? this.formatEmotionalMemory(memory) : null
      }
    }
  }

  /**
   * 최근 메모리 조회
   */
  private async getRecentMemories(
    configId: string,
    types: ('episodic' | 'semantic' | 'emotional')[],
    limit: number
  ): Promise<MemoryData[]> {
    const memories: MemoryData[] = []

    if (types.includes('episodic')) {
      const episodic = await prisma.episodicMemory.findMany({
        where: { configId },
        orderBy: { lastAccessed: 'desc' },
        take: Math.ceil(limit / types.length)
      })
      memories.push(...episodic.map(m => this.formatEpisodicMemory(m)))
    }

    if (types.includes('semantic')) {
      const semantic = await prisma.semanticMemory.findMany({
        where: { configId },
        orderBy: { importance: 'desc' },
        take: Math.ceil(limit / types.length)
      })
      memories.push(...semantic.map(m => this.formatSemanticMemory(m)))
    }

    if (types.includes('emotional')) {
      const emotional = await prisma.emotionalMemory.findMany({
        where: { configId },
        orderBy: { importance: 'desc' },
        take: Math.ceil(limit / types.length)
      })
      memories.push(...emotional.map(m => this.formatEmotionalMemory(m)))
    }

    return memories.slice(0, limit)
  }

  /**
   * 접근 카운트 증가
   */
  private async incrementAccessCount(
    memoryId: string,
    memoryType: 'episodic' | 'semantic' | 'emotional'
  ): Promise<void> {
    const model = {
      episodic: prisma.episodicMemory,
      semantic: prisma.semanticMemory,
      emotional: prisma.emotionalMemory
    }[memoryType]

    await (model as any).update({
      where: { id: memoryId },
      data: {
        accessCount: { increment: 1 },
        lastAccessed: new Date()
      }
    })
  }

  // =====================================================
  // 프롬프트 생성 (캐릭터 관점 서술)
  // =====================================================

  /**
   * RAG 컨텍스트 생성 (캐릭터 관점)
   */
  async generateRAGContext(
    userId: string,
    characterId: string,
    query: string,
    characterName: string,
    options: RAGOptions = {}
  ): Promise<RAGContext> {
    const memories = await this.searchRelevantMemories(
      userId,
      characterId,
      query,
      options
    )

    if (memories.length === 0) {
      return {
        memories: [],
        formattedContext: '',
        totalTokens: 0
      }
    }

    const formattedContext = this.formatMemoriesAsCharacterNarrative(
      memories,
      characterName
    )

    const totalTokens = Math.ceil(formattedContext.length / 3)

    return {
      memories,
      formattedContext,
      totalTokens
    }
  }

  /**
   * 메모리를 캐릭터 관점 서술로 변환
   * (설계 문서의 Option C: 캐릭터 시점 서술)
   */
  private formatMemoriesAsCharacterNarrative(
    memories: MemorySearchResult[],
    characterName: string
  ): string {
    if (memories.length === 0) return ''

    const sections: string[] = []

    // 에피소드 메모리
    const episodic = memories.filter(m => m.memory.type === 'episodic')
    if (episodic.length > 0) {
      const narratives = episodic.map(m => {
        const mem = m.memory as EpisodicMemoryData
        return `- ${mem.summary}`
      }).join('\n')
      sections.push(`[이전에 나눈 대화들]\n${narratives}`)
    }

    // 의미적 메모리
    const semantic = memories.filter(m => m.memory.type === 'semantic')
    if (semantic.length > 0) {
      const facts = semantic.map(m => {
        const mem = m.memory as SemanticMemoryData
        return `- ${mem.key}: ${mem.value}`
      }).join('\n')
      sections.push(`[내가 알고 있는 것들]\n${facts}`)
    }

    // 감정 메모리
    const emotional = memories.filter(m => m.memory.type === 'emotional')
    if (emotional.length > 0) {
      const emotions = emotional.map(m => {
        const mem = m.memory as EmotionalMemoryData
        return `- ${mem.trigger}에 대해 ${this.translateEmotion(mem.emotion)} 감정을 느꼈음`
      }).join('\n')
      sections.push(`[우리 사이의 감정적 순간들]\n${emotions}`)
    }

    if (sections.length === 0) return ''

    return `<${characterName}의 기억>
${sections.join('\n\n')}
</${characterName}의 기억>`
  }

  /**
   * 감정 한글 변환
   */
  private translateEmotion(emotion: string): string {
    const translations: Record<string, string> = {
      happy: '행복한',
      sad: '슬픈',
      angry: '화난',
      fearful: '두려운',
      surprised: '놀란',
      disgusted: '불쾌한',
      neutral: '평온한',
      excited: '신나는',
      anxious: '불안한',
      loving: '사랑하는'
    }
    return translations[emotion] || emotion
  }

  // =====================================================
  // 시스템 프롬프트 통합
  // =====================================================

  /**
   * 시스템 프롬프트에 RAG 컨텍스트 통합
   */
  async buildSystemPromptWithMemory(
    baseSystemPrompt: string,
    userId: string,
    characterId: string,
    characterName: string,
    userMessage: string,
    options: RAGOptions = {}
  ): Promise<{
    systemPrompt: string
    ragContext: RAGContext
  }> {
    const ragContext = await this.generateRAGContext(
      userId,
      characterId,
      userMessage,
      characterName,
      options
    )

    let systemPrompt = baseSystemPrompt

    if (ragContext.formattedContext) {
      // 메모리 컨텍스트를 시스템 프롬프트 끝에 추가
      systemPrompt = `${baseSystemPrompt}

---
아래는 당신이 이 사용자와 함께한 기억들입니다. 자연스럽게 대화에 반영하되, 기억을 직접적으로 언급하지 마세요.

${ragContext.formattedContext}
---`
    }

    return {
      systemPrompt,
      ragContext
    }
  }

  // =====================================================
  // 유틸리티
  // =====================================================

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
      emotion: memory.emotion,
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

export const ragService = new RAGService()

