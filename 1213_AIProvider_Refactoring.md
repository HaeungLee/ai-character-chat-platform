# AI Provider 확장성 리팩토링 설계

> **작성일:** 2024-12-13  
> **상태:** 📋 검토 대기 (향후 구현 고려)  
> **우선순위:** 낮음 (현재 OpenRouter로 대부분 커버 가능)

---

## 📋 배경

### 현재 상황

```
AIService
├── OpenAIService      - GPT 모델 직접 연동
├── OpenRouterService  - 다양한 모델 (Claude, Gemini, Llama 등)
├── ReplicateService   - 이미지/비디오 생성
└── StabilityAIService - Stable Diffusion
```

### OpenRouter의 장점

OpenRouter를 통해 이미 사용 가능한 모델:
- **Anthropic:** Claude 3.5 Sonnet, Claude 3 Opus
- **Google:** Gemini Pro, Gemini Flash
- **Meta:** Llama 3.3, Llama 3.2
- **Mistral:** Mistral Large, Mixtral
- **OpenAI:** GPT-4o, GPT-4 Turbo (프록시)

→ **별도 Provider 직접 연동 없이도 대부분의 모델 사용 가능**

---

## 🤔 직접 연동 vs OpenRouter 비교

### 비용 비교 (1M 토큰 기준, 2024년 12월)

| 모델 | 직접 연동 | OpenRouter | 차이 |
|------|-----------|------------|------|
| GPT-4o (input) | $2.50 | $2.50 | 동일 |
| GPT-4o (output) | $10.00 | $10.00 | 동일 |
| Claude 3.5 Sonnet (input) | $3.00 | $3.00 | 동일 |
| Claude 3.5 Sonnet (output) | $15.00 | $15.00 | 동일 |
| Gemini 1.5 Pro (input) | $1.25 | $1.25 | 동일 |

**결론:** OpenRouter는 원가 + 마진 없이 제공 (대부분 동일 가격)

### 직접 연동이 필요한 경우

1. **Fine-tuning 사용 시** - OpenAI/Anthropic 직접 연동 필요
2. **Batch API** - OpenAI Batch API (50% 할인)
3. **특수 기능** - Assistants API, Function Calling 고급 기능
4. **SLA/보안 요구** - 엔터프라이즈 계약 시

### 현재 판단

```
✅ OpenRouter 유지 - 대부분의 use case 커버
❌ 직접 연동 리팩토링 - 당장 불필요
📋 문서화 - 향후 필요 시 참고
```

---

## 🏗️ 향후 리팩토링 설계 (참고용)

### Provider Interface

```typescript
// packages/backend/src/services/ai/providers/IAIProvider.ts

export interface IAIProvider {
  // Provider 식별
  readonly name: string  // 'openai' | 'openrouter' | 'anthropic' | 'google'
  readonly displayName: string
  
  // 채팅 생성
  generateChatResponse(
    messages: ChatMessage[],
    options: ChatOptions
  ): Promise<ChatResponse>
  
  // 스트리밍
  generateChatResponseStream(
    messages: ChatMessage[],
    options: ChatOptions
  ): AsyncGenerator<string>
  
  // 임베딩 (지원하는 경우)
  generateEmbedding?(text: string): Promise<number[]>
  
  // 사용량 정보 (비용 계산용)
  getLastUsage(): UsageInfo | null
  
  // 지원 모델 목록
  getAvailableModels(): ModelInfo[]
  
  // 상태 확인
  healthCheck(): Promise<HealthCheckResult>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

export interface ChatResponse {
  content: string
  usage: UsageInfo
  model: string
  finishReason: string
}

export interface UsageInfo {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  inputPrice: number   // per 1K tokens
  outputPrice: number  // per 1K tokens
  capabilities: ('chat' | 'vision' | 'function' | 'embedding')[]
}
```

### Provider Registry

```typescript
// packages/backend/src/services/ai/ProviderRegistry.ts

class ProviderRegistry {
  private providers: Map<string, IAIProvider> = new Map()
  
  register(provider: IAIProvider): void {
    this.providers.set(provider.name, provider)
  }
  
  get(name: string): IAIProvider | undefined {
    return this.providers.get(name)
  }
  
  getAll(): IAIProvider[] {
    return Array.from(this.providers.values())
  }
  
  // 모델 ID로 적절한 Provider 찾기
  findProviderForModel(modelId: string): IAIProvider | undefined {
    for (const provider of this.providers.values()) {
      const models = provider.getAvailableModels()
      if (models.some(m => m.id === modelId)) {
        return provider
      }
    }
    return undefined
  }
}

// 싱글톤 인스턴스
export const providerRegistry = new ProviderRegistry()

// 초기화
providerRegistry.register(new OpenAIProvider(process.env.OPENAI_API_KEY))
providerRegistry.register(new OpenRouterProvider(process.env.OPENROUTER_API_KEY))
// 필요 시 추가
// providerRegistry.register(new AnthropicProvider(process.env.ANTHROPIC_API_KEY))
// providerRegistry.register(new GoogleProvider(process.env.GOOGLE_API_KEY))
```

### 새 Provider 추가 예시

```typescript
// packages/backend/src/services/ai/providers/AnthropicProvider.ts

import Anthropic from '@anthropic-ai/sdk'

export class AnthropicProvider implements IAIProvider {
  readonly name = 'anthropic'
  readonly displayName = 'Anthropic'
  
  private client: Anthropic
  private lastUsage: UsageInfo | null = null

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async generateChatResponse(
    messages: ChatMessage[], 
    options: ChatOptions
  ): Promise<ChatResponse> {
    const response = await this.client.messages.create({
      model: options.model || 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens || 4096,
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
      system: messages.find(m => m.role === 'system')?.content,
    })

    this.lastUsage = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    }

    return {
      content: response.content[0].type === 'text' 
        ? response.content[0].text 
        : '',
      usage: this.lastUsage,
      model: response.model,
      finishReason: response.stop_reason || 'stop',
    }
  }

  async *generateChatResponseStream(
    messages: ChatMessage[], 
    options: ChatOptions
  ): AsyncGenerator<string> {
    const stream = await this.client.messages.stream({
      model: options.model || 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens || 4096,
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
      system: messages.find(m => m.role === 'system')?.content,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && 
          event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }

    const finalMessage = await stream.finalMessage()
    this.lastUsage = {
      promptTokens: finalMessage.usage.input_tokens,
      completionTokens: finalMessage.usage.output_tokens,
      totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
    }
  }

  getLastUsage(): UsageInfo | null {
    return this.lastUsage
  }

  getAvailableModels(): ModelInfo[] {
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        inputPrice: 0.003,
        outputPrice: 0.015,
        capabilities: ['chat', 'vision'],
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        inputPrice: 0.015,
        outputPrice: 0.075,
        capabilities: ['chat', 'vision'],
      },
    ]
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      // 간단한 API 호출로 상태 확인
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      })
      return { healthy: true }
    } catch (error) {
      return { healthy: false, error: error.message }
    }
  }
}
```

---

## 📊 사용량 추적 (현재 구현 권장)

### 즉시 구현 가능한 범위

리팩토링 없이 현재 구조에서 사용량 추적 추가:

```typescript
// 기존 OpenAIService, OpenRouterService에 추가

class OpenAIService {
  private usageTracker: UsageTrackingService
  
  async generateChatCompletion(...) {
    const response = await this.client.chat.completions.create(...)
    
    // 🆕 사용량 기록
    await this.usageTracker.recordUsage({
      provider: 'openai',
      model: options.model,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      userId,
      requestType: 'chat',
    })
    
    return response
  }
}
```

### DB 스키마 (최소)

```prisma
model AIUsageLog {
  id                String   @id @default(cuid())
  userId            String
  provider          String   // 'openai' | 'openrouter'
  model             String
  promptTokens      Int
  completionTokens  Int
  totalTokens       Int
  costUsd           Decimal  @db.Decimal(10, 6)
  requestType       String   // 'chat' | 'image' | 'embedding'
  characterId       String?
  chatId            String?
  isSuccess         Boolean  @default(true)
  createdAt         DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([provider, createdAt])
}
```

---

## 📋 결정 사항

### 현재 (2024-12)

| 항목 | 결정 |
|------|------|
| Provider 리팩토링 | ❌ 보류 (OpenRouter로 충분) |
| 사용량 추적 | ✅ 구현 (AIUsageLog 테이블) |
| 관리자 대시보드 | ✅ 구현 (기본 집계 API) |
| 직접 연동 (Claude/Gemini) | ❌ 보류 (OpenRouter 활용) |

### 향후 트리거

직접 연동 리팩토링이 필요한 시점:
1. Fine-tuning 모델 사용 필요
2. OpenRouter 가격 정책 변경
3. 특정 Provider 전용 기능 필요
4. 엔터프라이즈 SLA 요구

---

## 📁 관련 문서

- `1213_analize.md` - 전체 프로젝트 분석
- `1213_VectorDB.md` - 메모리 시스템 설계
- `1212_LoRA.md` - 커스텀 모델 계획


