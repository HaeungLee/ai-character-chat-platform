// 통합 AI 서비스
import { OpenAIService, OpenAIConfig } from './ai/OpenAIService'
import { OpenRouterService, OpenRouterConfig, OPENROUTER_MODELS } from './ai/OpenRouterService'
import { ReplicateService, ReplicateConfig } from './ai/ReplicateService'
import { StabilityAIService, StabilityConfig } from './ai/StabilityAIService'
import { UsageTrackingService, UsageRecord, AIProvider as BillingAIProvider } from './billing'
import { logger } from '../utils/logger'

export interface AIServiceConfig {
  openai?: OpenAIConfig
  openrouter?: OpenRouterConfig
  replicate?: ReplicateConfig
  stability?: StabilityConfig
  usageTracker?: UsageTrackingService
}

// AI 프로바이더 타입
export type AIProvider = 'openai' | 'openrouter'

// 채팅 옵션
export interface ChatOptions {
  provider?: AIProvider
  model?: string
  temperature?: number
  maxTokens?: number
  nsfwMode?: boolean  // 검열 해제 모드
}

export interface Character {
  id: string
  name: string
  personality: string
  systemPrompt: string
  temperature?: number
  avatar?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp?: Date
}

export class AIService {
  private openai?: OpenAIService
  private openrouter?: OpenRouterService
  private replicate?: ReplicateService
  private stability?: StabilityAIService
  private usageTracker?: UsageTrackingService
  private defaultProvider: AIProvider = 'openai'

  constructor(config: AIServiceConfig) {
    if (config.openai) {
      this.openai = new OpenAIService(config.openai)
    }
    if (config.openrouter) {
      this.openrouter = new OpenRouterService(config.openrouter)
    }
    if (config.replicate) {
      this.replicate = new ReplicateService(config.replicate)
    }
    if (config.stability) {
      this.stability = new StabilityAIService(config.stability)
    }
    if (config.usageTracker) {
      this.usageTracker = config.usageTracker
    }

    // 기본 프로바이더 설정 (OpenAI 우선, 없으면 OpenRouter)
    if (this.openai) {
      this.defaultProvider = 'openai'
    } else if (this.openrouter) {
      this.defaultProvider = 'openrouter'
    }
  }

  /**
   * 현재 사용 가능한 프로바이더 조회
   */
  getDefaultProvider(): AIProvider {
    return this.defaultProvider
  }

  /**
   * UsageTracker 설정 (나중에 주입 가능)
   */
  setUsageTracker(tracker: UsageTrackingService): void {
    this.usageTracker = tracker
  }

  /**
   * 🆕 사용량 기록 헬퍼
   */
  private async recordUsage(
    provider: AIProvider,
    requestType: 'chat' | 'chat_stream' | 'embedding' | 'summarization',
    options?: {
      userId?: string
      characterId?: string
      chatId?: string
      latencyMs?: number
      isSuccess?: boolean
      errorMessage?: string
    }
  ): Promise<void> {
    if (!this.usageTracker) return

    try {
      let usage: { promptTokens: number; completionTokens: number; model: string } | null = null

      if (provider === 'openai' && this.openai?.lastUsage) {
        usage = this.openai.lastUsage
      } else if (provider === 'openrouter' && this.openrouter?.lastUsage) {
        usage = this.openrouter.lastUsage
      }

      if (usage && options?.userId) {
        await this.usageTracker.recordUsage({
          userId: options.userId,
          provider: provider as BillingAIProvider,
          model: usage.model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          requestType,
          characterId: options.characterId,
          chatId: options.chatId,
          latencyMs: options.latencyMs,
          isSuccess: options.isSuccess ?? true,
          errorMessage: options.errorMessage,
        })
      }
    } catch (error) {
      logger.warn('사용량 기록 실패:', error)
      // 사용량 기록 실패는 메인 로직에 영향 주지 않음
    }
  }

  /**
   * 프로바이더 선택 로직
   * - nsfwMode: OpenRouter 강제
   * - 명시적 provider 지정: 해당 프로바이더 사용
   * - 기본: defaultProvider 사용
   */
  private selectProvider(options?: ChatOptions): AIProvider {
    if (options?.nsfwMode) {
      // NSFW 모드는 OpenRouter 필수
      if (!this.openrouter) {
        throw new Error('NSFW 모드를 사용하려면 OpenRouter API 키가 필요합니다.')
      }
      return 'openrouter'
    }

    if (options?.provider) {
      return options.provider
    }

    return this.defaultProvider
  }

  // 캐릭터 기반 채팅 응답 생성
  async generateCharacterResponse(
    character: Character,
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    options?: ChatOptions
  ): Promise<string> {
    const provider = this.selectProvider(options)

    try {
      const characterPrompt = {
        name: character.name,
        personality: character.personality,
        systemPrompt: character.systemPrompt,
        temperature: character.temperature || 0.7,
      }

      const messages: ChatMessage[] = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      if (provider === 'openrouter') {
        if (!this.openrouter) {
          throw new Error('OpenRouter 서비스가 설정되지 않았습니다.')
        }
        return await this.openrouter.generateCharacterResponse(
          characterPrompt,
          userMessage,
          messages,
          {
            model: options?.model,
            nsfwMode: options?.nsfwMode
          }
        )
      } else {
        if (!this.openai) {
          throw new Error('OpenAI 서비스가 설정되지 않았습니다.')
        }
        return await this.openai.generateCharacterResponse(
          characterPrompt,
          userMessage,
          messages
        )
      }
    } catch (error) {
      logger.error('캐릭터 응답 생성 실패:', error)

      // Fallback: 다른 프로바이더로 시도
      if (provider === 'openai' && this.openrouter) {
        logger.info('OpenRouter로 폴백 시도')
        try {
          const characterPrompt = {
            name: character.name,
            personality: character.personality,
            systemPrompt: character.systemPrompt,
            temperature: character.temperature || 0.7,
          }
          const messages = conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
          }))
          return await this.openrouter.generateCharacterResponse(
            characterPrompt,
            userMessage,
            messages
          )
        } catch (fallbackError) {
          logger.error('폴백도 실패:', fallbackError)
        }
      }

      return `${character.name}: 죄송합니다. 지금은 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.`
    }
  }

  // 🆕 캐릭터 기반 스트리밍 응답 생성 (타자기 효과)
  async *generateCharacterResponseStream(
    character: Character,
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    options?: ChatOptions
  ): AsyncGenerator<string, void, unknown> {
    const provider = this.selectProvider(options)

    try {
      const characterPrompt = {
        name: character.name,
        personality: character.personality,
        systemPrompt: character.systemPrompt,
        temperature: character.temperature || 0.7,
      }

      const messages: ChatMessage[] = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      if (provider === 'openrouter') {
        if (!this.openrouter) {
          throw new Error('OpenRouter 서비스가 설정되지 않았습니다.')
        }
        yield* this.openrouter.generateCharacterResponseStream(
          characterPrompt,
          userMessage,
          messages,
          {
            model: options?.model,
            nsfwMode: options?.nsfwMode
          }
        )
      } else {
        if (!this.openai) {
          throw new Error('OpenAI 서비스가 설정되지 않았습니다.')
        }
        yield* this.openai.generateCharacterResponseStream(
          characterPrompt,
          userMessage,
          messages
        )
      }
    } catch (error) {
      logger.error('캐릭터 스트리밍 응답 생성 실패:', error)
      throw error
    }
  }

  // 🆕 일반 채팅 스트리밍 응답 생성
  async *generateChatResponseStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string, void, unknown> {
    const provider = this.selectProvider(options)

    if (provider === 'openrouter') {
      if (!this.openrouter) {
        throw new Error('OpenRouter 서비스가 설정되지 않았습니다.')
      }
      yield* this.openrouter.generateChatResponseStream(messages, options)
    } else {
      if (!this.openai) {
        throw new Error('OpenAI 서비스가 설정되지 않았습니다.')
      }
      yield* this.openai.generateChatResponseStream(messages, options)
    }
  }

  // 이미지 생성
  async generateImage(
    prompt: string,
    options?: {
      model?: 'openai' | 'replicate' | 'stability'
      style?: string
      aspectRatio?: string
      negativePrompt?: string
    }
  ): Promise<string> {
    const model = options?.model || 'replicate'

    try {
      switch (model) {
        case 'openai':
          if (!this.openai) throw new Error('OpenAI 서비스가 설정되지 않았습니다.')
          return await this.openai.generateImage(prompt, {
            size: this.mapAspectRatioToOpenAI(options?.aspectRatio),
            style: options?.style as any,
          })

        case 'replicate':
          if (!this.replicate) throw new Error('Replicate 서비스가 설정되지 않았습니다.')
          const dimensions = this.parseAspectRatio(options?.aspectRatio)
          return await this.replicate.generateImage(prompt, {
            width: dimensions.width,
            height: dimensions.height,
            negativePrompt: options?.negativePrompt,
          })

        case 'stability':
          if (!this.stability) throw new Error('Stability AI 서비스가 설정되지 않았습니다.')
          const stabDimensions = this.parseAspectRatio(options?.aspectRatio)
          return await this.stability.generateImage(prompt, {
            width: stabDimensions.width,
            height: stabDimensions.height,
            negative_prompt: options?.negativePrompt,
            style_preset: options?.style,
          })

        default:
          throw new Error(`지원하지 않는 모델: ${model}`)
      }
    } catch (error) {
      logger.error(`${model} 이미지 생성 실패:`, error)

      // 다른 서비스로 폴백 시도
      if (model !== 'replicate' && this.replicate) {
        logger.info('Replicate로 폴백 시도')
        try {
          const dimensions = this.parseAspectRatio(options?.aspectRatio)
          return await this.replicate.generateImage(prompt, {
            width: dimensions.width,
            height: dimensions.height,
            negativePrompt: options?.negativePrompt,
          })
        } catch (fallbackError) {
          logger.error('폴백도 실패:', fallbackError)
        }
      }

      throw new Error('이미지 생성에 실패했습니다. 다른 모델을 시도해보세요.')
    }
  }

  // 일반 채팅 응답 생성
  async generateChatResponse(
    messages: ChatMessage[],
    options?: {
      model?: 'openai'
      temperature?: number
      maxTokens?: number
    }
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI 서비스가 설정되지 않았습니다.')
    }

    return await this.openai.generateChatResponse(messages, options)
  }

  // 서비스 상태 확인
  getServiceStatus(): {
    openai: boolean
    openrouter: boolean
    replicate: boolean
    stability: boolean
    defaultProvider: AIProvider
  } {
    return {
      openai: !!this.openai,
      openrouter: !!this.openrouter,
      replicate: !!this.replicate,
      stability: !!this.stability,
      defaultProvider: this.defaultProvider,
    }
  }

  // 사용 가능한 모델 목록
  getAvailableModels(): {
    chat: string[]
    chatUncensored: string[]
    chatRoleplay: string[]
    chatFree: string[]
    image: string[]
  } {
    const status = this.getServiceStatus()

    const openrouterModels = this.openrouter?.getAvailableModels()

    return {
      chat: [
        ...(status.openai ? ['gpt-4', 'gpt-4o', 'gpt-3.5-turbo'] : []),
        ...(status.openrouter ? (openrouterModels?.premium || []) : []),
      ],
      chatUncensored: status.openrouter ? (openrouterModels?.uncensored || []) : [],
      chatRoleplay: status.openrouter ? (openrouterModels?.roleplay || []) : [],
      chatFree: status.openrouter ? (openrouterModels?.free || []) : [],
      image: [
        ...(status.openai ? ['openai/dall-e-3'] : []),
        ...(status.replicate ? ['replicate/sdxl', 'replicate/sdxl-turbo'] : []),
        ...(status.stability ? ['stability/sdxl', 'stability/core'] : []),
      ],
    }
  }

  // OpenRouter 크레딧 조회
  async getOpenRouterCredits(): Promise<{ usage: number; limit: number | null } | null> {
    if (!this.openrouter) return null
    try {
      return await this.openrouter.getCredits()
    } catch {
      return null
    }
  }

  // 헬퍼 함수들
  private mapAspectRatioToOpenAI(aspectRatio?: string): any {
    const ratioMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1024x768',
      '3:4': '768x1024',
    }
    return ratioMap[aspectRatio || '1:1'] || '1024x1024'
  }

  private parseAspectRatio(aspectRatio?: string): { width: number; height: number } {
    if (!aspectRatio) return { width: 1024, height: 1024 }

    const [widthStr, heightStr] = aspectRatio.split(':')
    const width = parseInt(widthStr)
    const height = parseInt(heightStr)

    if (isNaN(width) || isNaN(height)) return { width: 1024, height: 1024 }

    // 최대 크기 제한
    const maxSize = 1024
    let actualWidth = width
    let actualHeight = height

    if (width > height) {
      actualWidth = Math.min(width, maxSize)
      actualHeight = Math.round((height * actualWidth) / width)
    } else {
      actualHeight = Math.min(height, maxSize)
      actualWidth = Math.round((width * actualHeight) / height)
    }

    return { width: actualWidth, height: actualHeight }
  }
}

// 싱글톤 인스턴스 생성 함수
export function createAIService(config: AIServiceConfig): AIService {
  return new AIService(config)
}

// 환경 변수에서 설정 생성
export function createAIServiceFromEnv(): AIService {
  const config: AIServiceConfig = {}

  if (process.env.OPENAI_API_KEY) {
    config.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    config.openrouter = {
      apiKey: process.env.OPENROUTER_API_KEY,
      siteUrl: process.env.OPENROUTER_SITE_URL || process.env.CORS_ORIGIN,
      siteName: process.env.OPENROUTER_SITE_NAME || 'AI Character Chat Platform',
      defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',
    }
  }

  if (process.env.REPLICATE_API_TOKEN) {
    config.replicate = {
      apiToken: process.env.REPLICATE_API_TOKEN,
    }
  }

  if (process.env.STABILITY_API_KEY) {
    config.stability = {
      apiKey: process.env.STABILITY_API_KEY,
    }
  }

  // 설정 로그
  const enabledServices = []
  if (config.openai) enabledServices.push('OpenAI')
  if (config.openrouter) enabledServices.push('OpenRouter')
  if (config.replicate) enabledServices.push('Replicate')
  if (config.stability) enabledServices.push('Stability')
  
  console.log(`🤖 AI Services enabled: ${enabledServices.join(', ') || 'None'}`)

  return new AIService(config)
}
