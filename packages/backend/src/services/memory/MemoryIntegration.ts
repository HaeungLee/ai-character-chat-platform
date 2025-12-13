/**
 * 메모리 통합 서비스
 * 메시지 처리 시 자동으로 메모리 시스템과 연동
 */

import { ChatMessageModel } from '../../models/memory'
import { ChatMessage } from '../../models/memory/types'
import { memoryService } from './MemoryService'
import { summarizationService } from './SummarizationService'
import { ragService } from './RAGService'
import { logger } from '../../utils/logger'

// 컨텍스트 체크 주기 (메시지 수)
const CONTEXT_CHECK_INTERVAL = 10

export interface MessageData {
  id: string
  chatId: string
  userId: string
  characterId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tokens?: number
  metadata?: Record<string, unknown>
}

export interface IntegrationResult {
  messageSaved: boolean
  contextChecked: boolean
  summarizationTriggered: boolean
  importantInfoExtracted: boolean
  ragContext?: {
    formattedContext: string
    totalTokens: number
  }
}

export class MemoryIntegration {
  // 메시지 카운터 (컨텍스트 체크 주기용)
  private messageCounters: Map<string, number> = new Map()

  /**
   * 메시지 처리 전 - RAG 컨텍스트 가져오기
   */
  async beforeMessageProcess(
    userId: string,
    characterId: string,
    characterName: string,
    userMessage: string,
    baseSystemPrompt: string
  ): Promise<{
    systemPrompt: string
    ragContext: {
      formattedContext: string
      totalTokens: number
    }
  }> {
    try {
      const result = await ragService.buildSystemPromptWithMemory(
        baseSystemPrompt,
        userId,
        characterId,
        characterName,
        userMessage,
        {
          limit: 5,
          minSimilarity: 0.65
        }
      )

      // 메모리 설정 접근 시간 업데이트
      await memoryService.getOrCreateConfig(userId, characterId)

      return {
        systemPrompt: result.systemPrompt,
        ragContext: {
          formattedContext: result.ragContext.formattedContext,
          totalTokens: result.ragContext.totalTokens
        }
      }
    } catch (error) {
      logger.error('RAG 컨텍스트 가져오기 실패:', error)
      return {
        systemPrompt: baseSystemPrompt,
        ragContext: {
          formattedContext: '',
          totalTokens: 0
        }
      }
    }
  }

  /**
   * 메시지 처리 후 - 저장 및 분석
   */
  async afterMessageProcess(
    message: MessageData,
    characterName: string
  ): Promise<IntegrationResult> {
    const result: IntegrationResult = {
      messageSaved: false,
      contextChecked: false,
      summarizationTriggered: false,
      importantInfoExtracted: false
    }

    try {
      // 1. MongoDB에 메시지 저장
      await this.saveMessage(message)
      result.messageSaved = true

      // 2. 이벤트 기반 중요 정보 추출 (사용자 메시지만)
      if (message.role === 'user') {
        const extracted = await this.extractImportantInfo(message, characterName)
        result.importantInfoExtracted = extracted
      }

      // 3. 컨텍스트 사용량 체크 (주기적으로)
      const shouldCheck = this.shouldCheckContext(message.chatId)
      if (shouldCheck) {
        result.contextChecked = true
        const contextTriggered = await this.checkAndTriggerSummarization(
          message.userId,
          message.characterId,
          message.chatId
        )
        result.summarizationTriggered = contextTriggered
      }

    } catch (error) {
      logger.error('메시지 후처리 실패:', error)
    }

    return result
  }

  /**
   * MongoDB에 메시지 저장
   */
  private async saveMessage(message: MessageData): Promise<void> {
    await ChatMessageModel.create({
      chatId: message.chatId,
      userId: message.userId,
      characterId: message.characterId,
      role: message.role,
      content: message.content,
      tokens: message.tokens || this.estimateTokens(message.content),
      metadata: message.metadata,
      summarization: {
        isSummarized: false
      }
    })

    logger.debug(`메시지 저장: ${message.id}`)
  }

  /**
   * 중요 정보 실시간 추출
   */
  private async extractImportantInfo(
    message: MessageData,
    characterName: string
  ): Promise<boolean> {
    try {
      const result = await summarizationService.extractImportantInfo(
        {
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: new Date()
        },
        characterName
      )

      if (result.hasImportantInfo && result.semanticMemory) {
        // 의미적 메모리 저장
        await memoryService.createSemanticMemory(
          message.userId,
          message.characterId,
          {
            category: result.semanticMemory.category,
            key: result.semanticMemory.key,
            value: result.semanticMemory.value,
            confidence: result.semanticMemory.confidence,
            sourceMessageId: message.id,
            importance: 0.8  // 실시간 추출은 높은 중요도
          }
        )

        logger.info(`중요 정보 추출: ${result.semanticMemory.key}`)
        return true
      }
    } catch (error) {
      logger.warn('중요 정보 추출 실패:', error)
    }

    return false
  }

  /**
   * 컨텍스트 체크 필요 여부
   */
  private shouldCheckContext(chatId: string): boolean {
    const currentCount = (this.messageCounters.get(chatId) || 0) + 1
    this.messageCounters.set(chatId, currentCount)

    return currentCount % CONTEXT_CHECK_INTERVAL === 0
  }

  /**
   * 컨텍스트 체크 및 요약 트리거
   */
  private async checkAndTriggerSummarization(
    userId: string,
    characterId: string,
    chatId: string
  ): Promise<boolean> {
    try {
      const usage = await summarizationService.checkContextUsage(
        userId,
        characterId,
        chatId
      )

      if (usage.shouldSummarize) {
        logger.info(`컨텍스트 70% 도달 - 요약 트리거: ${chatId}`)
        
        // 비동기로 요약 작업 시작
        summarizationService.createSummarizationJob(
          userId,
          characterId,
          chatId
        ).catch(error => {
          logger.error('요약 작업 생성 실패:', error)
        })

        return true
      }
    } catch (error) {
      logger.warn('컨텍스트 체크 실패:', error)
    }

    return false
  }

  /**
   * 토큰 수 추정
   */
  private estimateTokens(text: string): number {
    // 대략 3자당 1토큰 (한국어 기준)
    return Math.ceil(text.length / 3)
  }

  /**
   * 채팅 종료 시 메시지 카운터 정리
   */
  clearChatCounter(chatId: string): void {
    this.messageCounters.delete(chatId)
  }
}

export const memoryIntegration = new MemoryIntegration()


