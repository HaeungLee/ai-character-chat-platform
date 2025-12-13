// AI 컨트롤러
import { Request, Response } from 'express'
import { AIService } from '../services/AIService'
import { logger } from '../utils/logger'

export class AIController {
  private aiService: AIService

  constructor(aiService: AIService) {
    this.aiService = aiService
  }

  // 캐릭터 채팅 응답 생성
  generateCharacterResponse = async (req: Request, res: Response) => {
    try {
      const { characterId, message, conversationHistory } = req.body
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

      // AI 응답 생성
      const response = await this.aiService.generateCharacterResponse(
        character,
        message,
        conversationHistory || []
      )

      // 로그 기록
      logger.info('AI 캐릭터 응답 생성 완료', {
        characterId,
        userId,
        messageLength: message.length,
        responseLength: response.length,
      })

      res.json({
        success: true,
        data: {
          response,
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

  // 이미지 생성
  generateImage = async (req: Request, res: Response) => {
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
  generateChatResponse = async (req: Request, res: Response) => {
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
  generateChatWithProvider = async (req: Request, res: Response) => {
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
  generateChatStreamWithProvider = async (req: Request, res: Response) => {
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
  generateCharacterResponseStream = async (req: Request, res: Response) => {
    try {
      const { characterId, message, conversationHistory } = req.body
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

      // 시작 이벤트 전송
      res.write(`data: ${JSON.stringify({ type: 'start', characterId, characterName: character.name })}\n\n`)

      let fullResponse = ''

      try {
        // 스트리밍 응답 생성
        const stream = this.aiService.generateCharacterResponseStream(
          character,
          message,
          conversationHistory || []
        )

        for await (const chunk of stream) {
          fullResponse += chunk
          // 청크 데이터 전송
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
        }

        // 완료 이벤트 전송
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          fullResponse,
          usage: {
            estimatedTokens: Math.ceil(fullResponse.length / 4)
          }
        })}\n\n`)

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
  generateChatResponseStream = async (req: Request, res: Response) => {
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
    // 실제로는 데이터베이스에서 조회
    // 여기서는 샘플 데이터 반환
    const sampleCharacters = {
      'sample_char_1': {
        id: 'sample_char_1',
        name: '친절한 AI 어시스턴트',
        personality: '항상 친절하고 도움이 되는 AI 어시스턴트입니다.',
        systemPrompt: '당신은 친절하고 도움이 되는 AI 어시스턴트입니다. 사용자의 질문에 최대한 도움이 되는 답변을 제공하세요.',
        temperature: 0.7,
      },
      'sample_char_2': {
        id: 'sample_char_2',
        name: '창의적인 작가',
        personality: '다양한 주제로 창의적인 글을 쓰는 AI 작가입니다.',
        systemPrompt: '당신은 창의적인 작가입니다. 사용자의 요청에 따라 다양한 스타일의 글을 작성하세요.',
        temperature: 0.8,
      },
    }

    return sampleCharacters[characterId as keyof typeof sampleCharacters] || null
  }
}
