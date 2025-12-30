import { AIService, ChatMessage, ChatOptions } from '../AIService'
import { buildCharacterChatSystemPrompt, CharacterChatPromptCharacter } from './CharacterChatPipeline'
import { memoryIntegration } from '../memory'
import { logger } from '../../utils/logger'

export interface RunCharacterChatTurnBaseParams {
  aiService: AIService
  userId?: string
  chatId?: string
  character: CharacterChatPromptCharacter & {
    personality?: string
    temperature?: number
    avatar?: string
  }
  userMessage: string
  conversationHistory?: ChatMessage[]
  aiOptions?: ChatOptions
  outputLanguage?: 'ko' | 'en'
}

function makeMessageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function fireAndForgetSaveMemory(params: {
  userId?: string
  chatId?: string
  characterId: string
  characterName: string
  userMessage: string
  assistantMessage: string
  source: 'rest' | 'sse'
}): void {
  const { userId, chatId, characterId, characterName, userMessage, assistantMessage, source } = params

  if (!userId || typeof chatId !== 'string' || !chatId) return

  const userMessageId = makeMessageId('msg')
  const assistantMessageId = makeMessageId('msg')

  void memoryIntegration
    .afterMessageProcess(
      {
        id: userMessageId,
        chatId,
        userId,
        characterId,
        role: 'user',
        content: userMessage,
        metadata: { source },
      },
      characterName
    )
    .catch(() => {})

  void memoryIntegration
    .afterMessageProcess(
      {
        id: assistantMessageId,
        chatId,
        userId,
        characterId,
        role: 'assistant',
        content: assistantMessage,
        tokens: Math.ceil(assistantMessage.length / 3),
        metadata: { source },
      },
      characterName
    )
    .catch(() => {})
}

export async function runCharacterChatTurnRest(
  params: RunCharacterChatTurnBaseParams
): Promise<{
  response: string
  ragContext: { formattedContext: string; totalTokens: number }
  systemPrompt: string
}> {
  const {
    aiService,
    userId,
    chatId,
    character,
    userMessage,
    conversationHistory = [],
    aiOptions,
    outputLanguage = 'ko',
  } = params

  const ragResult = await buildCharacterChatSystemPrompt({
    userId,
    character,
    userMessage,
    outputLanguage,
  })

  const response = await aiService.generateCharacterResponse(
    {
      ...(character as any),
      systemPrompt: ragResult.systemPrompt,
    },
    userMessage,
    conversationHistory,
    aiOptions
  )

  // Memory save happens only after we have the final assistant output.
  fireAndForgetSaveMemory({
    userId,
    chatId,
    characterId: character.id,
    characterName: character.name,
    userMessage,
    assistantMessage: response,
    source: 'rest',
  })

  return {
    response,
    ragContext: ragResult.ragContext,
    systemPrompt: ragResult.systemPrompt,
  }
}

export async function* runCharacterChatTurnSse(
  params: RunCharacterChatTurnBaseParams
): AsyncGenerator<
  { type: 'chunk'; content: string } | { type: 'done'; fullResponse: string; usage: { estimatedTokens: number } },
  void,
  unknown
> {
  const {
    aiService,
    userId,
    chatId,
    character,
    userMessage,
    conversationHistory = [],
    aiOptions,
    outputLanguage = 'ko',
  } = params

  const ragResult = await buildCharacterChatSystemPrompt({
    userId,
    character,
    userMessage,
    outputLanguage,
  })

  const stream = aiService.generateCharacterResponseStream(
    {
      ...(character as any),
      systemPrompt: ragResult.systemPrompt,
    },
    userMessage,
    conversationHistory,
    aiOptions
  )

  let fullResponse = ''

  for await (const chunk of stream) {
    fullResponse += chunk
    yield { type: 'chunk', content: chunk }
  }

  // Save memory only after the assistant response is finalized.
  fireAndForgetSaveMemory({
    userId,
    chatId,
    characterId: character.id,
    characterName: character.name,
    userMessage,
    assistantMessage: fullResponse,
    source: 'sse',
  })

  if (ragResult.ragContext.totalTokens > 0) {
    logger.info('RAG 컨텍스트 주입 (SSE)', {
      characterId: character.id,
      userId,
      ragTokens: ragResult.ragContext.totalTokens,
    })
  }

  yield {
    type: 'done',
    fullResponse,
    usage: { estimatedTokens: Math.ceil(fullResponse.length / 4) },
  }
}
