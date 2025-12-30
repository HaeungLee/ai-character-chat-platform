// AI 컨트롤러
import { Request, Response } from 'express'
import { AIService } from '../services/AIService'
import { logger } from '../utils/logger'
import { prisma } from '../config/database'
import { AuthenticatedRequest } from '../middleware/auth'
import { assembleSystemPrompt, LorebookEntry } from '../services/prompt/PromptAssembly'
import { runCharacterChatTurnRest, runCharacterChatTurnSse } from '../services/chat/CharacterChatTurnPipeline'
import { memoryIntegration } from '../services/memory'
import { resolveOrCreateChatId } from '../services/chat/ChatSessionService'

export class AIController {
  private aiService: AIService

  constructor(aiService: AIService) {
    this.aiService = aiService
  }

  // 캐릭터 채팅 응답 생성
  generateCharacterResponse = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { characterId, message, conversationHistory, provider, model, nsfwMode, chatId } = req.body
      const userId = req.user?.id

      if (!characterId || !message) {
        return res.status(400).json({
          success: false,
          error: 'characterId와 message는 필수입니다.'
        })
      }

      // 캐릭터 정보 조회 (실제로는 DB에서 조회)
      const character = await this.getCharacterById(characterId)
      if (!character) {
        return res.status(404).json({
          success: false,
          error: '캐릭터를 찾을 수 없습니다.'
        })
      }

      const result = await runCharacterChatTurnRest({
        aiService: this.aiService,
        userId: userId || undefined,
        chatId,
        character: {
          id: character.id,
          name: character.name,
          systemPrompt: character.systemPrompt,
          personality: character.personality,
          temperature: character.temperature,
          lorebookEntries: character.lorebookEntries,
          exampleDialogues: character.exampleDialogues,
        },
        userMessage: message,
        conversationHistory: conversationHistory || [],
        aiOptions: {
          provider,
          model,
          nsfwMode,
        },
        outputLanguage: 'ko',
      })

      // 로그 기록
      logger.info('AI 캐릭터 응답 생성 완료', {
        characterId,
        userId,
        messageLength: message.length,
        responseLength: result.response.length,
      })

      res.json({
        success: true,
        data: {
          response: result.response,
          character: {
            id: character.id,
            name: character.name,
          },
        },
      })
    } catch (error) {
      logger.error('AI 캐릭터 응답 생성 실패:', error)
      res.status(500).json({
        success: false,
        error: 'AI 응답 생성 중 오류가 발생했습니다.',
      })
    }
  }

  // 🆕 캐릭터 채팅 프롬프트/컨텍스트 프리뷰 (LLM 호출 없음)
  previewCharacterChatPrompt = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        characterId,
        message,
        includeRag = true,
        outputLanguage = 'ko',
        maxLorebookEntries,
        maxExamplesChars,
        includeHardRules,
      } = req.body as {
        characterId?: string
        message?: string
        includeRag?: boolean
        outputLanguage?: 'ko' | 'en'
        maxLorebookEntries?: number
        maxExamplesChars?: number
        includeHardRules?: boolean
      }

      const userId = req.user?.id

      if (!characterId || typeof characterId !== 'string') {
        return res.status(400).json({ success: false, error: 'characterId는 필수입니다.' })
      }

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'message는 필수입니다.' })
      }

      const character = await this.getCharacterById(characterId)
      if (!character) {
        return res.status(404).json({ success: false, error: '캐릭터를 찾을 수 없습니다.' })
      }

      const assembled = assembleSystemPrompt({
        baseSystemPrompt: character.systemPrompt,
        userMessage: message,
        lorebookEntries: character.lorebookEntries,
        exampleDialoguesJson: character.exampleDialogues,
        options: {
          outputLanguage,
          ...(typeof maxLorebookEntries === 'number' ? { maxLorebookEntries } : {}),
          ...(typeof maxExamplesChars === 'number' ? { maxExamplesChars } : {}),
          ...(typeof includeHardRules === 'boolean' ? { includeHardRules } : {}),
        },
      })

      let finalSystemPrompt = assembled.assembledSystemPrompt
      let ragContext: { formattedContext: string; totalTokens: number } = { formattedContext: '', totalTokens: 0 }
      let ragError: string | null = null

      if (includeRag && userId) {
        try {
          const ragResult = await memoryIntegration.beforeMessageProcess(
            userId,
            character.id,
            character.name,
            message,
            assembled.assembledSystemPrompt
          )
          finalSystemPrompt = ragResult.systemPrompt
          ragContext = ragResult.ragContext
        } catch (e) {
          ragError = e instanceof Error ? e.message : 'RAG 주입 실패'
        }
      }

      return res.json({
        success: true,
        data: {
          character: { id: character.id, name: character.name },
          input: {
            message,
            includeRag: !!includeRag,
            outputLanguage,
            maxLorebookEntries: typeof maxLorebookEntries === 'number' ? maxLorebookEntries : null,
            maxExamplesChars: typeof maxExamplesChars === 'number' ? maxExamplesChars : null,
            includeHardRules: typeof includeHardRules === 'boolean' ? includeHardRules : null,
          },
          assembly: {
            usedLorebookEntries: assembled.usedLorebookEntries,
            usedLorebookEntryIds: assembled.usedLorebookEntries.map((e) => e.id),
            usedExamplesCount: assembled.usedExamples.length,
          },
          prompts: {
            assembledSystemPrompt: assembled.assembledSystemPrompt,
            finalSystemPrompt,
          },
          rag: {
            totalTokens: ragContext.totalTokens,
            formattedContext: ragContext.formattedContext,
            error: ragError,
          },
          note: 'This endpoint does not call the LLM. Use /api/ai/chat or /api/ai/chat/stream for actual responses.',
        },
      })
    } catch (error) {
      logger.error('프롬프트 프리뷰 생성 실패:', error)
      return res.status(500).json({ success: false, error: '프롬프트 프리뷰 생성 중 오류가 발생했습니다.' })
    }
  }

  // 이미지 생성
  generateImage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        prompt,
        model = 'replicate',
        style,
        aspectRatio = '1:1',
        negativePrompt
      } = req.body

      const userId = req.user?.id

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: '프롬프트는 필수입니다.'
        })
      }

      // 이미지 생성
      const imageUrl = await this.aiService.generateImage(prompt, {
        model,
        style,
        aspectRatio,
        negativePrompt,
      })

      // 로그 기록
      logger.info('AI 이미지 생성 완료', {
        userId,
        model,
        promptLength: prompt.length,
      })

      res.json({
        success: true,
        data: {
          imageUrl,
          prompt,
          model,
          style,
          aspectRatio,
        },
      })
    } catch (error) {
      logger.error('AI 이미지 생성 실패:', error)
      res.status(500).json({
        success: false,
        error: '이미지 생성 중 오류가 발생했습니다.',
      })
    }
  }

  // 일반 채팅 응답 생성
  generateChatResponse = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { messages, temperature, maxTokens } = req.body
      const userId = req.user?.id

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          error: 'messages 배열은 필수입니다.'
        })
      }

      const response = await this.aiService.generateChatResponse(messages, {
        temperature,
        maxTokens,
      })

      logger.info('AI 채팅 응답 생성 완료', {
        userId,
        messageCount: messages.length,
        responseLength: response.length,
      })

      res.json({
        success: true,
        data: {
          response,
          usage: {
            messageCount: messages.length,
          },
        },
      })
    } catch (error) {
      logger.error('AI 채팅 응답 생성 실패:', error)
      res.status(500).json({
        success: false,
        error: '채팅 응답 생성 중 오류가 발생했습니다.',
      })
    }
  }

  // 서비스 상태 확인
  getServiceStatus = async (req: Request, res: Response) => {
    try {
      const status = this.aiService.getServiceStatus()
      const models = this.aiService.getAvailableModels()
      const credits = await this.aiService.getOpenRouterCredits()

      res.json({
        success: true,
        data: {
          status,
          models,
          openRouterCredits: credits,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error('AI 서비스 상태 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '서비스 상태 조회 중 오류가 발생했습니다.',
      })
    }
  }

  // 🆕 프로바이더 지정 채팅 응답 생성
  generateChatWithProvider = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        messages, 
        provider,      // 'openai' | 'openrouter'
        model,         // 특정 모델 지정
        temperature, 
        maxTokens,
        nsfwMode       // 검열 해제 모드
      } = req.body
      const userId = req.user?.id

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          error: 'messages 배열은 필수입니다.'
        })
      }

      // NSFW 모드는 성인 인증 확인 필요 (TODO: 실제 인증 로직)
      if (nsfwMode) {
        // const isAdultVerified = await checkAdultVerification(userId)
        // if (!isAdultVerified) {
        //   return res.status(403).json({
        //     success: false,
        //     error: '성인 인증이 필요합니다.'
        //   })
        // }
        logger.warn('NSFW 모드 요청 - 성인 인증 미구현', { userId })
      }

      const response = await this.aiService.generateChatResponse(messages, {
        provider,
        model,
        temperature,
        maxTokens,
        nsfwMode,
      })

      logger.info('AI 채팅 응답 생성 완료', {
        userId,
        provider: provider || 'default',
        model: model || 'default',
        nsfwMode: !!nsfwMode,
        messageCount: messages.length,
        responseLength: response.length,
      })

      res.json({
        success: true,
        data: {
          response,
          provider: provider || this.aiService.getDefaultProvider(),
          model,
          usage: {
            messageCount: messages.length,
            estimatedTokens: Math.ceil(response.length / 4),
          },
        },
      })
    } catch (error) {
      logger.error('AI 채팅 응답 생성 실패:', error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '채팅 응답 생성 중 오류가 발생했습니다.',
      })
    }
  }

  // 🆕 프로바이더 지정 스트리밍 응답 생성
  generateChatStreamWithProvider = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        messages, 
        provider,
        model,
        temperature, 
        maxTokens,
        nsfwMode
      } = req.body
      const userId = req.user?.id

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          error: 'messages 배열은 필수입니다.'
        })
      }

      // SSE 헤더 설정
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders()

      const actualProvider = provider || this.aiService.getDefaultProvider()

      // 시작 이벤트
      res.write(`data: ${JSON.stringify({ 
        type: 'start', 
        provider: actualProvider,
        model: model || 'default',
        messageCount: messages.length 
      })}\n\n`)

      let fullResponse = ''

      try {
        const stream = this.aiService.generateChatResponseStream(messages, {
          provider,
          model,
          temperature,
          maxTokens,
          nsfwMode,
        })

        for await (const chunk of stream) {
          fullResponse += chunk
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
        }

        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          fullResponse,
          provider: actualProvider,
          usage: {
            messageCount: messages.length,
            estimatedTokens: Math.ceil(fullResponse.length / 4)
          }
        })}\n\n`)

        logger.info('AI 프로바이더 스트리밍 완료', {
          userId,
          provider: actualProvider,
          model,
          nsfwMode: !!nsfwMode,
          responseLength: fullResponse.length,
        })

      } catch (streamError) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: streamError instanceof Error ? streamError.message : '응답 생성 중 오류가 발생했습니다.' 
        })}\n\n`)
        logger.error('프로바이더 스트리밍 오류:', streamError)
      }

      res.write('data: [DONE]\n\n')
      res.end()

    } catch (error) {
      logger.error('AI 프로바이더 스트리밍 실패:', error)
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '스트리밍 응답 생성 중 오류가 발생했습니다.',
        })
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: '서버 오류가 발생했습니다.' })}\n\n`)
        res.end()
      }
    }
  }

  // 🆕 캐릭터 채팅 스트리밍 응답 생성 (SSE)
  generateCharacterResponseStream = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { characterId, message, conversationHistory, provider, model, nsfwMode, chatId } = req.body
      const userId = req.user?.id

      if (!characterId || !message) {
        return res.status(400).json({
          success: false,
          error: 'characterId와 message는 필수입니다.'
        })
      }

      // 캐릭터 정보 조회
      const character = await this.getCharacterById(characterId)
      if (!character) {
        return res.status(404).json({
          success: false,
          error: '캐릭터를 찾을 수 없습니다.'
        })
      }

      // SSE 헤더 설정
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no') // Nginx 버퍼링 비활성화
      res.flushHeaders()

      const { chatId: resolvedChatId } = await resolveOrCreateChatId({
        prisma,
        userId: userId || undefined,
        characterId,
        chatId,
      })

      // 시작 이벤트 전송
      res.write(
        `data: ${JSON.stringify({
          type: 'start',
          characterId,
          characterName: character.name,
          ...(resolvedChatId ? { chatId: resolvedChatId } : {}),
        })}\n\n`
      )

      try {
        const stream = runCharacterChatTurnSse({
          aiService: this.aiService,
          userId: userId || undefined,
          chatId: resolvedChatId,
          character: {
            id: character.id,
            name: character.name,
            systemPrompt: character.systemPrompt,
            personality: character.personality,
            temperature: character.temperature,
            lorebookEntries: character.lorebookEntries,
            exampleDialogues: character.exampleDialogues,
          },
          userMessage: message,
          conversationHistory: conversationHistory || [],
          aiOptions: {
            provider,
            model,
            nsfwMode,
          },
          outputLanguage: 'ko',
        })

        let fullResponse = ''
        for await (const evt of stream) {
          if (evt.type === 'chunk') {
            fullResponse += evt.content
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: evt.content })}\n\n`)
          } else if (evt.type === 'done') {
            fullResponse = evt.fullResponse
            res.write(`data: ${JSON.stringify({ 
              type: 'done', 
              fullResponse,
              usage: evt.usage,
            })}\n\n`)
          }
        }

        logger.info('AI 캐릭터 스트리밍 응답 완료', {
          characterId,
          userId,
          messageLength: message.length,
          responseLength: fullResponse.length,
        })

      } catch (streamError) {
        // 스트리밍 중 오류 발생
        res.write(`data: ${JSON.stringify({ type: 'error', error: '응답 생성 중 오류가 발생했습니다.' })}\n\n`)
        logger.error('스트리밍 중 오류:', streamError)
      }

      // 연결 종료
      res.write('data: [DONE]\n\n')
      res.end()

    } catch (error) {
      logger.error('AI 캐릭터 스트리밍 응답 생성 실패:', error)
      
      // 아직 헤더가 전송되지 않았다면 JSON 응답
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'AI 스트리밍 응답 생성 중 오류가 발생했습니다.',
        })
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: '서버 오류가 발생했습니다.' })}\n\n`)
        res.end()
      }
    }
  }

  // 🆕 일반 채팅 스트리밍 응답 생성 (SSE)
  generateChatResponseStream = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { messages, temperature, maxTokens } = req.body
      const userId = req.user?.id

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          error: 'messages 배열은 필수입니다.'
        })
      }

      // SSE 헤더 설정
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders()

      // 시작 이벤트 전송
      res.write(`data: ${JSON.stringify({ type: 'start', messageCount: messages.length })}\n\n`)

      let fullResponse = ''

      try {
        const stream = this.aiService.generateChatResponseStream(messages, {
          temperature,
          maxTokens,
        })

        for await (const chunk of stream) {
          fullResponse += chunk
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
        }

        // 완료 이벤트
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          fullResponse,
          usage: {
            messageCount: messages.length,
            estimatedTokens: Math.ceil(fullResponse.length / 4)
          }
        })}\n\n`)

        logger.info('AI 채팅 스트리밍 응답 완료', {
          userId,
          messageCount: messages.length,
          responseLength: fullResponse.length,
        })

      } catch (streamError) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: '응답 생성 중 오류가 발생했습니다.' })}\n\n`)
        logger.error('채팅 스트리밍 중 오류:', streamError)
      }

      res.write('data: [DONE]\n\n')
      res.end()

    } catch (error) {
      logger.error('AI 채팅 스트리밍 응답 생성 실패:', error)
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: '채팅 스트리밍 응답 생성 중 오류가 발생했습니다.',
        })
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: '서버 오류가 발생했습니다.' })}\n\n`)
        res.end()
      }
    }
  }

  // 헬퍼 메서드: 캐릭터 정보 조회
  private async getCharacterById(characterId: string) {
    const character = await prisma.character.findFirst({
      where: { id: characterId, isActive: true },
      include: {
        lorebookEntries: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
          select: { id: true, keys: true, content: true, priority: true },
        },
      },
    })

    if (!character) return null

    const lorebookEntries: LorebookEntry[] = (character.lorebookEntries || []).map((e) => ({
      id: e.id,
      keys: e.keys,
      content: e.content,
      priority: e.priority,
    }))

    return {
      id: character.id,
      name: character.name,
      personality: character.personality ?? '',
      systemPrompt: character.systemPrompt,
      temperature: 0.7,
      exampleDialogues: character.exampleDialogues,
      lorebookEntries,
    }
  }
}
