/**
 * 요약 서비스
 * 대화 요약 및 메모리 추출
 */

import OpenAI from 'openai'
import { prisma } from '../../config/database'
import { 
  ChatMessageModel, 
  MemorySummaryArchiveModel,
  SummarizationLogModel 
} from '../../models/memory'
import { 
  ChatMessage, 
  SummarizationResult, 
  SemanticCategory,
  EmotionType 
} from '../../models/memory/types'
import { memoryService } from './MemoryService'
import { logger } from '../../utils/logger'

// 컨텍스트 설정
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-3.5-turbo': 16385
}

const DEFAULT_MODEL = 'gpt-4o'
const CONTEXT_THRESHOLD = 0.7  // 70%에서 요약 트리거
const SUMMARIZE_RATIO = 0.5   // 가장 오래된 50% 요약

interface SummarizationPromptData {
  messages: ChatMessage[]
  characterName: string
  characterPersonality?: string
}

export class SummarizationService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  // =====================================================
  // 컨텍스트 사용량 관리
  // =====================================================

  /**
   * 컨텍스트 사용량 체크 및 요약 필요 여부 판단
   */
  async checkContextUsage(
    userId: string,
    characterId: string,
    chatId: string,
    model: string = DEFAULT_MODEL
  ): Promise<{
    shouldSummarize: boolean
    currentTokens: number
    maxTokens: number
    usagePercent: number
  }> {
    const maxTokens = MODEL_CONTEXT_LIMITS[model] || MODEL_CONTEXT_LIMITS[DEFAULT_MODEL]

    // MongoDB에서 최근 메시지 조회
    const messages = await ChatMessageModel.find({
      chatId,
      'summarization.isSummarized': { $ne: true }
    }).sort({ createdAt: 1 })

    // 토큰 수 계산 (대략적)
    const currentTokens = messages.reduce((acc, msg) => {
      return acc + (msg.tokens || this.estimateTokens(msg.content))
    }, 0)

    const usagePercent = currentTokens / maxTokens

    // 컨텍스트 사용률 업데이트
    await prisma.characterMemoryConfig.updateMany({
      where: { userId, characterId },
      data: { 
        contextUsagePercent: usagePercent,
        lastContextCheck: new Date()
      }
    })

    return {
      shouldSummarize: usagePercent >= CONTEXT_THRESHOLD,
      currentTokens,
      maxTokens,
      usagePercent
    }
  }

  /**
   * 토큰 수 추정 (간단한 방법)
   */
  private estimateTokens(text: string): number {
    // 대략 4자당 1토큰 (영어), 한국어는 더 많음
    return Math.ceil(text.length / 3)
  }

  // =====================================================
  // 대화 요약
  // =====================================================

  /**
   * 비동기 요약 작업 생성
   */
  async createSummarizationJob(
    userId: string,
    characterId: string,
    chatId: string
  ): Promise<string> {
    // 요약되지 않은 메시지 조회
    const messages = await ChatMessageModel.find({
      chatId,
      'summarization.isSummarized': { $ne: true }
    }).sort({ createdAt: 1 })

    if (messages.length < 4) {
      throw new Error('요약할 메시지가 충분하지 않습니다')
    }

    // 가장 오래된 50% 선택
    const messagesToSummarize = messages.slice(0, Math.ceil(messages.length * SUMMARIZE_RATIO))
    
    const job = await prisma.summarizationJob.create({
      data: {
        userId,
        characterId,
        chatId,
        startMessageId: messagesToSummarize[0]._id.toString(),
        endMessageId: messagesToSummarize[messagesToSummarize.length - 1]._id.toString(),
        messageCount: messagesToSummarize.length,
        status: 'PENDING',
        priority: 0
      }
    })

    // 백그라운드에서 처리 시작
    this.processSummarizationJob(job.id).catch(error => {
      logger.error(`요약 작업 실패 [${job.id}]:`, error)
    })

    return job.id
  }

  /**
   * 요약 작업 처리 (백그라운드)
   */
  async processSummarizationJob(jobId: string): Promise<SummarizationResult> {
    const startTime = Date.now()
    
    // 작업 상태 업데이트
    const job = await prisma.summarizationJob.update({
      where: { id: jobId },
      data: { 
        status: 'PROCESSING',
        startedAt: new Date()
      }
    })

    try {
      // 메시지 조회
      const messages = await ChatMessageModel.find({
        _id: { 
          $gte: job.startMessageId, 
          $lte: job.endMessageId 
        },
        chatId: job.chatId
      }).sort({ createdAt: 1 })

      if (messages.length === 0) {
        throw new Error('요약할 메시지를 찾을 수 없습니다')
      }

      // 캐릭터 정보 조회
      const chat = await prisma.chat.findUnique({
        where: { id: job.chatId },
        include: { character: true }
      })

      const characterName = chat?.character?.name || '캐릭터'
      const characterPersonality = chat?.character?.personality || undefined

      // 요약 실행
      const result = await this.summarizeConversation({
        messages: messages.map(m => ({
          id: m._id.toString(),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          tokens: m.tokens,
          createdAt: m.createdAt
        })),
        characterName,
        characterPersonality
      })

      // 메모리 저장
      const memoryIds: { episodic?: string; semantic?: string[]; emotional?: string[] } = {}

      // 에피소드 메모리 생성
      if (result.episodicMemory) {
        const episodic = await memoryService.createEpisodicMemory(
          job.userId,
          job.characterId,
          {
            summary: result.episodicMemory.summary,
            originalMessageIds: messages.map(m => m._id.toString()),
            messageRange: {
              startMessageId: job.startMessageId,
              endMessageId: job.endMessageId,
              startTime: messages[0].createdAt,
              endTime: messages[messages.length - 1].createdAt
            },
            importance: result.episodicMemory.importance
          }
        )
        memoryIds.episodic = episodic.id
      }

      // 의미적 메모리 생성
      if (result.semanticMemories && result.semanticMemories.length > 0) {
        memoryIds.semantic = []
        for (const sm of result.semanticMemories) {
          const semantic = await memoryService.createSemanticMemory(
            job.userId,
            job.characterId,
            {
              category: sm.category,
              key: sm.key,
              value: sm.value,
              confidence: sm.confidence
            }
          )
          memoryIds.semantic.push(semantic.id)
        }
      }

      // 감정 메모리 생성
      if (result.emotionalMemories && result.emotionalMemories.length > 0) {
        memoryIds.emotional = []
        for (const em of result.emotionalMemories) {
          const emotional = await memoryService.createEmotionalMemory(
            job.userId,
            job.characterId,
            {
              emotion: em.emotion,
              intensity: em.intensity,
              trigger: em.trigger
            }
          )
          memoryIds.emotional.push(emotional.id)
        }
      }

      // MongoDB 메시지 요약 상태 업데이트
      await ChatMessageModel.updateMany(
        { _id: { $in: messages.map(m => m._id) } },
        {
          $set: {
            'summarization.isSummarized': true,
            'summarization.summarizedAt': new Date(),
            'summarization.jobId': jobId,
            'summarization.memoryIds': Object.values(memoryIds).flat().filter(Boolean)
          }
        }
      )

      // MongoDB 아카이브 저장 (열람용)
      await MemorySummaryArchiveModel.create({
        userId: job.userId,
        characterId: job.characterId,
        originalMessages: messages.map(m => ({
          messageId: m._id.toString(),
          role: m.role,
          content: m.content,
          createdAt: m.createdAt
        })),
        summary: {
          episodic: result.episodicMemory?.summary,
          semantic: result.semanticMemories?.map(sm => ({
            category: sm.category,
            key: sm.key,
            value: sm.value
          })),
          emotional: result.emotionalMemories?.map(em => ({
            emotion: em.emotion,
            trigger: em.trigger
          }))
        },
        messageRange: {
          startTime: messages[0].createdAt,
          endTime: messages[messages.length - 1].createdAt,
          count: messages.length
        },
        memoryIds,
        isDeleted: false
      })

      // 작업 완료
      await prisma.summarizationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: result as any
        }
      })

      // 로그 기록
      const processingTime = Date.now() - startTime
      await SummarizationLogModel.create({
        jobId,
        userId: job.userId,
        characterId: job.characterId,
        chatId: job.chatId,
        messagesProcessed: messages.length,
        tokensUsed: result.tokensUsed,
        processingTimeMs: processingTime,
        status: 'success',
        memoriesCreated: {
          episodic: memoryIds.episodic ? 1 : 0,
          semantic: memoryIds.semantic?.length || 0,
          emotional: memoryIds.emotional?.length || 0
        }
      })

      logger.info(`요약 완료 [${jobId}]: ${messages.length}개 메시지, ${processingTime}ms`)
      
      return result

    } catch (error) {
      // 작업 실패
      await prisma.summarizationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        }
      })

      // 실패 로그
      await SummarizationLogModel.create({
        jobId,
        userId: job.userId,
        characterId: job.characterId,
        chatId: job.chatId,
        messagesProcessed: 0,
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
        status: 'failed',
        memoriesCreated: { episodic: 0, semantic: 0, emotional: 0 },
        error: {
          message: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack : undefined
        }
      })

      throw error
    }
  }

  /**
   * 대화 요약 수행
   */
  private async summarizeConversation(
    data: SummarizationPromptData
  ): Promise<SummarizationResult> {
    const systemPrompt = `당신은 대화 분석 전문가입니다. 주어진 대화를 분석하여 다음 정보를 JSON 형식으로 추출하세요:

1. **episodicMemory**: 대화의 전체적인 요약 (캐릭터 ${data.characterName}의 시점에서)
   - summary: 대화 요약 (2-3문장)
   - importance: 중요도 (0.0 ~ 1.0)

2. **semanticMemories**: 사용자에 대해 알게 된 사실들 (배열)
   - category: PERSONAL_INFO, PREFERENCE, RELATIONSHIP, EVENT, OPINION, HABIT, GOAL, OTHER 중 하나
   - key: 정보의 키 (예: "생일", "좋아하는 음식")
   - value: 정보의 값
   - confidence: 확신도 (0.0 ~ 1.0)

3. **emotionalMemories**: 감정적으로 의미 있는 순간들 (배열)
   - emotion: happy, sad, angry, fearful, surprised, disgusted, neutral, excited, anxious, loving 중 하나
   - intensity: 강도 (0.0 ~ 1.0)
   - trigger: 감정을 유발한 원인

캐릭터 성격: ${data.characterPersonality || '친절하고 도움이 되는 AI'}

중요:
- 캐릭터의 시점에서 기억을 서술하세요
- 사용자에 대한 중요한 정보만 추출하세요
- 일상적인 대화는 낮은 중요도를 부여하세요
- JSON 형식으로만 응답하세요`

    const conversationText = data.messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n')

    const response = await this.openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `다음 대화를 분석하세요:\n\n${conversationText}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000
    })

    const tokensUsed = response.usage?.total_tokens || 0
    const content = response.choices[0].message.content

    if (!content) {
      throw new Error('요약 응답이 비어있습니다')
    }

    try {
      const parsed = JSON.parse(content)
      return {
        episodicMemory: parsed.episodicMemory,
        semanticMemories: parsed.semanticMemories,
        emotionalMemories: parsed.emotionalMemories,
        tokensUsed
      }
    } catch {
      logger.error('요약 JSON 파싱 실패:', content)
      throw new Error('요약 결과 파싱에 실패했습니다')
    }
  }

  // =====================================================
  // 이벤트 기반 실시간 추출 (Hybrid)
  // =====================================================

  /**
   * 단일 메시지에서 중요 정보 실시간 추출
   */
  async extractImportantInfo(
    message: ChatMessage,
    characterName: string
  ): Promise<{
    hasImportantInfo: boolean
    semanticMemory?: {
      category: SemanticCategory
      key: string
      value: string
      confidence: number
    }
  }> {
    // 빠른 패턴 매칭으로 우선 필터링
    const importantPatterns = [
      /내 (이름|생일|나이|직업|취미|전공)/i,
      /내가 (좋아하는|싫어하는|원하는)/i,
      /(생일|기념일|졸업|결혼|이사|취직)/i,
      /꼭 기억해|잊지 마|중요한/i
    ]

    const hasPattern = importantPatterns.some(p => p.test(message.content))
    
    if (!hasPattern) {
      return { hasImportantInfo: false }
    }

    // LLM으로 상세 분석
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // 빠른 응답을 위해 경량 모델 사용
      messages: [
        {
          role: 'system',
          content: `사용자 메시지에서 중요한 개인 정보를 추출하세요. 
캐릭터 ${characterName}가 기억해야 할 정보가 있다면 JSON으로 반환하세요.
중요한 정보가 없으면 {"hasInfo": false}를 반환하세요.

있을 경우:
{
  "hasInfo": true,
  "category": "PERSONAL_INFO|PREFERENCE|RELATIONSHIP|EVENT|OPINION|HABIT|GOAL|OTHER",
  "key": "정보 키",
  "value": "정보 값",
  "confidence": 0.0-1.0
}`
        },
        { role: 'user', content: message.content }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 200
    })

    try {
      const result = JSON.parse(response.choices[0].message.content || '{}')
      
      if (result.hasInfo) {
        return {
          hasImportantInfo: true,
          semanticMemory: {
            category: result.category as SemanticCategory,
            key: result.key,
            value: result.value,
            confidence: result.confidence
          }
        }
      }
    } catch {
      // 파싱 실패 시 무시
    }

    return { hasImportantInfo: false }
  }
}

export const summarizationService = new SummarizationService()

