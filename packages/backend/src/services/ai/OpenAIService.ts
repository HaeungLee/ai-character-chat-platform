// OpenAI 서비스
import OpenAI from 'openai'
import { logger } from '../../utils/logger'

export interface OpenAIConfig {
  apiKey: string
  organization?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CharacterPrompt {
  name: string
  personality: string
  systemPrompt: string
  temperature?: number
}

// 🆕 사용량 정보
export interface UsageInfo {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
}

export class OpenAIService {
  private client: OpenAI
  private defaultModel: string
  private defaultTemperature: number
  private defaultMaxTokens: number
  
  // 🆕 마지막 요청의 사용량 정보
  private _lastUsage: UsageInfo | null = null

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
    })

    this.defaultModel = config.model || 'gpt-4'
    this.defaultTemperature = config.temperature || 0.7
    this.defaultMaxTokens = config.maxTokens || 1000
  }

  // 🆕 마지막 사용량 조회
  get lastUsage(): UsageInfo | null {
    return this._lastUsage
  }

  // 🆕 사용량 초기화
  clearLastUsage(): void {
    this._lastUsage = null
  }

  // 캐릭터 기반 채팅 응답 생성
  async generateCharacterResponse(
    character: CharacterPrompt,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<string> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: this.buildCharacterSystemPrompt(character)
        },
        ...conversationHistory.slice(-10), // 최근 10개 메시지만 사용
        {
          role: 'user',
          content: userMessage
        }
      ]

      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages,
        temperature: character.temperature || this.defaultTemperature,
        max_tokens: this.defaultMaxTokens,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
      })

      // 🆕 사용량 저장
      if (response.usage) {
        this._lastUsage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          model: response.model,
        }
      }

      const aiResponse = response.choices[0]?.message?.content
      if (!aiResponse) {
        throw new Error('AI 응답을 생성할 수 없습니다.')
      }

      return aiResponse
    } catch (error) {
      logger.error('OpenAI 캐릭터 응답 생성 실패:', error)
      throw new Error('AI 응답 생성 중 오류가 발생했습니다.')
    }
  }

  // 🆕 캐릭터 기반 스트리밍 응답 생성 (타자기 효과)
  async *generateCharacterResponseStream(
    character: CharacterPrompt,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): AsyncGenerator<string, void, unknown> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: this.buildCharacterSystemPrompt(character)
        },
        ...conversationHistory.slice(-10),
        {
          role: 'user',
          content: userMessage
        }
      ]

      const stream = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages,
        temperature: character.temperature || this.defaultTemperature,
        max_tokens: this.defaultMaxTokens,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
        stream: true, // 스트리밍 활성화
      })

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          yield content
        }
      }
    } catch (error) {
      logger.error('OpenAI 스트리밍 응답 생성 실패:', error)
      throw new Error('AI 스트리밍 응답 생성 중 오류가 발생했습니다.')
    }
  }

  // 🆕 일반 채팅 스트리밍 응답 생성
  async *generateChatResponseStream(
    messages: ChatMessage[],
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
    }
  ): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages,
        temperature: options?.temperature || this.defaultTemperature,
        max_tokens: options?.maxTokens || this.defaultMaxTokens,
        stream: true,
      })

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          yield content
        }
      }
    } catch (error) {
      logger.error('OpenAI 스트리밍 채팅 응답 생성 실패:', error)
      throw new Error('AI 스트리밍 응답 생성 중 오류가 발생했습니다.')
    }
  }

  // 일반 채팅 응답 생성
  async generateChatResponse(
    messages: ChatMessage[],
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
    }
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages,
        temperature: options?.temperature || this.defaultTemperature,
        max_tokens: options?.maxTokens || this.defaultMaxTokens,
      })

      // 🆕 사용량 저장
      if (response.usage) {
        this._lastUsage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          model: response.model,
        }
      }

      const aiResponse = response.choices[0]?.message?.content
      if (!aiResponse) {
        throw new Error('AI 응답을 생성할 수 없습니다.')
      }

      return aiResponse
    } catch (error) {
      logger.error('OpenAI 채팅 응답 생성 실패:', error)
      throw new Error('AI 응답 생성 중 오류가 발생했습니다.')
    }
  }

  // 이미지 생성 (DALL-E)
  async generateImage(
    prompt: string,
    options?: {
      size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'
      quality?: 'standard' | 'hd'
      style?: 'vivid' | 'natural'
    }
  ): Promise<string> {
    try {
      const enhancedPrompt = this.enhanceImagePrompt(prompt)

      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        size: options?.size || '1024x1024',
        quality: options?.quality || 'standard',
        style: options?.style || 'vivid',
        n: 1,
      })

      const imageUrl = response.data[0]?.url
      if (!imageUrl) {
        throw new Error('이미지를 생성할 수 없습니다.')
      }

      return imageUrl
    } catch (error) {
      logger.error('OpenAI 이미지 생성 실패:', error)
      throw new Error('이미지 생성 중 오류가 발생했습니다.')
    }
  }

  // 캐릭터 시스템 프롬프트 구성
  private buildCharacterSystemPrompt(character: CharacterPrompt): string {
    return `You are ${character.name}. ${character.personality}.

Guidelines:
- Stay in character at all times
- Be engaging and natural in your responses
- Maintain the personality and behavior patterns described
- Keep responses appropriate and helpful
- If asked about your identity, maintain the character role
- Respond in Korean unless specifically asked to use another language

System Prompt: ${character.systemPrompt}

Remember: You are role-playing as ${character.name}. Stay consistent with the character's personality and background.`
  }

  // 이미지 프롬프트 최적화
  private enhanceImagePrompt(prompt: string): string {
    return `${prompt}, high quality, detailed, professional, 8k, sharp focus, well lit`
  }

  // 토큰 수 계산 (대략)
  estimateTokens(text: string): number {
    // 간단한 토큰 계산 (실제로는 tiktoken 라이브러리 사용 권장)
    return Math.ceil(text.length / 4)
  }

  // 사용량 확인
  async getUsage(): Promise<any> {
    try {
      // 실제로는 Stripe나 OpenAI Billing API를 통해 사용량 조회
      // 여기서는 간단한 구현
      return {
        totalTokens: 0,
        totalRequests: 0,
        costs: 0,
      }
    } catch (error) {
      logger.error('사용량 조회 실패:', error)
      return null
    }
  }
}
