// 통합 AI 서비스
import { OpenAIService, OpenAIConfig } from './ai/OpenAIService'
import { ReplicateService, ReplicateConfig } from './ai/ReplicateService'
import { StabilityAIService, StabilityConfig } from './ai/StabilityAIService'
import { logger } from '../utils/logger'

export interface AIServiceConfig {
  openai?: OpenAIConfig
  replicate?: ReplicateConfig
  stability?: StabilityConfig
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
  private replicate?: ReplicateService
  private stability?: StabilityAIService

  constructor(config: AIServiceConfig) {
    if (config.openai) {
      this.openai = new OpenAIService(config.openai)
    }
    if (config.replicate) {
      this.replicate = new ReplicateService(config.replicate)
    }
    if (config.stability) {
      this.stability = new StabilityAIService(config.stability)
    }
  }

  // 캐릭터 기반 채팅 응답 생성
  async generateCharacterResponse(
    character: Character,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI 서비스가 설정되지 않았습니다.')
    }

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

      return await this.openai.generateCharacterResponse(
        characterPrompt,
        userMessage,
        messages
      )
    } catch (error) {
      logger.error('캐릭터 응답 생성 실패:', error)

      // Fallback 응답
      return `${character.name}: 죄송합니다. 지금은 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.`
    }
  }

  // 🆕 캐릭터 기반 스트리밍 응답 생성 (타자기 효과)
  async *generateCharacterResponseStream(
    character: Character,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): AsyncGenerator<string, void, unknown> {
    if (!this.openai) {
      throw new Error('OpenAI 서비스가 설정되지 않았습니다.')
    }

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

      yield* this.openai.generateCharacterResponseStream(
        characterPrompt,
        userMessage,
        messages
      )
    } catch (error) {
      logger.error('캐릭터 스트리밍 응답 생성 실패:', error)
      throw error
    }
  }

  // 🆕 일반 채팅 스트리밍 응답 생성
  async *generateChatResponseStream(
    messages: ChatMessage[],
    options?: {
      model?: 'openai'
      temperature?: number
      maxTokens?: number
    }
  ): AsyncGenerator<string, void, unknown> {
    if (!this.openai) {
      throw new Error('OpenAI 서비스가 설정되지 않았습니다.')
    }

    yield* this.openai.generateChatResponseStream(messages, options)
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
    replicate: boolean
    stability: boolean
  } {
    return {
      openai: !!this.openai,
      replicate: !!this.replicate,
      stability: !!this.stability,
    }
  }

  // 사용 가능한 모델 목록
  getAvailableModels(): {
    chat: string[]
    image: string[]
  } {
    const status = this.getServiceStatus()

    return {
      chat: status.openai ? ['gpt-4', 'gpt-3.5-turbo'] : [],
      image: [
        ...(status.openai ? ['openai/dall-e-3'] : []),
        ...(status.replicate ? ['replicate/sdxl', 'replicate/sdxl-turbo'] : []),
        ...(status.stability ? ['stability/sdxl', 'stability/core'] : []),
      ],
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
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
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

  return new AIService(config)
}
