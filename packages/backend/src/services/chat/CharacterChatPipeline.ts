import { assembleSystemPrompt, LorebookEntry } from '../prompt/PromptAssembly'
import { memoryIntegration } from '../memory'
import { logger } from '../../utils/logger'

export interface CharacterChatPromptCharacter {
  id: string
  name: string
  systemPrompt: string
  lorebookEntries?: LorebookEntry[]
  exampleDialogues?: string | null
}

export async function buildCharacterChatSystemPrompt(params: {
  userId?: string
  character: CharacterChatPromptCharacter
  userMessage: string
  outputLanguage?: 'ko' | 'en'
}): Promise<{
  systemPrompt: string
  ragContext: { formattedContext: string; totalTokens: number }
}> {
  const { userId, character, userMessage, outputLanguage = 'ko' } = params

  const assembled = assembleSystemPrompt({
    baseSystemPrompt: character.systemPrompt,
    userMessage,
    lorebookEntries: character.lorebookEntries,
    exampleDialoguesJson: character.exampleDialogues,
    options: {
      includeHardRules: true,
      outputLanguage,
    },
  })

  if (!userId) {
    return {
      systemPrompt: assembled.assembledSystemPrompt,
      ragContext: { formattedContext: '', totalTokens: 0 },
    }
  }

  try {
    const ragResult = await memoryIntegration.beforeMessageProcess(
      userId,
      character.id,
      character.name,
      userMessage,
      assembled.assembledSystemPrompt
    )

    if (ragResult.ragContext.totalTokens > 0) {
      logger.info('RAG 컨텍스트 주입', {
        characterId: character.id,
        userId,
        ragTokens: ragResult.ragContext.totalTokens,
      })
    }

    return {
      systemPrompt: ragResult.systemPrompt,
      ragContext: ragResult.ragContext,
    }
  } catch {
    return {
      systemPrompt: assembled.assembledSystemPrompt,
      ragContext: { formattedContext: '', totalTokens: 0 },
    }
  }
}
