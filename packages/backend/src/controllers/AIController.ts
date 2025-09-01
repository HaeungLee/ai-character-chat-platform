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

      res.json({
        success: true,
        data: {
          status,
          models,
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
