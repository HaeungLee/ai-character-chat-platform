// 이미지 컨트롤러
import { Request, Response } from 'express'
import { AIService } from '../services/AIService'
import { logger } from '../utils/logger'

export class ImageController {
  private aiService: AIService

  constructor(aiService: AIService) {
    this.aiService = aiService
  }

  // 이미지 생성
  generateImage = async (req: Request, res: Response) => {
    try {
      const {
        prompt,
        model = 'replicate',
        style,
        aspectRatio = '1:1',
        negativePrompt,
        count = 1,
      } = req.body

      const userId = req.user?.id

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: '프롬프트는 필수입니다.'
        })
      }

      if (count > 5) {
        return res.status(400).json({
          success: false,
          error: '한 번에 최대 5장까지 생성할 수 있습니다.'
        })
      }

      const results = []

      // 여러 장 생성
      for (let i = 0; i < count; i++) {
        try {
          const imageUrl = await this.aiService.generateImage(prompt, {
            model,
            style,
            aspectRatio,
            negativePrompt,
          })

          results.push({
            id: `img_${Date.now()}_${i}`,
            url: imageUrl,
            prompt,
            model,
            style,
            aspectRatio,
            createdAt: new Date().toISOString(),
          })
        } catch (error) {
          logger.error(`이미지 ${i + 1} 생성 실패:`, error)
          // 개별 이미지 생성 실패해도 계속 진행
        }
      }

      if (results.length === 0) {
        return res.status(500).json({
          success: false,
          error: '모든 이미지 생성에 실패했습니다.'
        })
      }

      // 로그 기록
      logger.info('이미지 생성 완료', {
        userId,
        model,
        count: results.length,
        promptLength: prompt.length,
      })

      res.json({
        success: true,
        data: {
          images: results,
          count: results.length,
          prompt,
          model,
          style,
          aspectRatio,
        },
      })
    } catch (error) {
      logger.error('이미지 생성 실패:', error)
      res.status(500).json({
        success: false,
        error: '이미지 생성 중 오류가 발생했습니다.',
      })
    }
  }

  // 이미지 목록 조회
  getImages = async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 20,
        model,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query

      const userId = req.user?.id

      // 실제로는 데이터베이스에서 조회
      // 여기서는 샘플 데이터 반환
      const sampleImages = [
        {
          id: 'img_001',
          url: 'https://example.com/image1.jpg',
          prompt: 'Beautiful sunset over mountains',
          model: 'replicate',
          style: 'realistic',
          aspectRatio: '16:9',
          createdAt: '2024-01-15T10:30:00Z',
        },
        {
          id: 'img_002',
          url: 'https://example.com/image2.jpg',
          prompt: 'Cyberpunk city at night',
          model: 'stability',
          style: 'digital-art',
          aspectRatio: '1:1',
          createdAt: '2024-01-14T15:45:00Z',
        },
      ]

      // 필터링 및 정렬
      let filteredImages = sampleImages

      if (model) {
        filteredImages = filteredImages.filter(img => img.model === model)
      }

      // 정렬
      filteredImages.sort((a, b) => {
        const aValue = new Date(a.createdAt).getTime()
        const bValue = new Date(b.createdAt).getTime()
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
      })

      // 페이지네이션
      const startIndex = (Number(page) - 1) * Number(limit)
      const endIndex = startIndex + Number(limit)
      const paginatedImages = filteredImages.slice(startIndex, endIndex)

      res.json({
        success: true,
        data: {
          images: paginatedImages,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: filteredImages.length,
            totalPages: Math.ceil(filteredImages.length / Number(limit)),
            hasNext: endIndex < filteredImages.length,
            hasPrev: Number(page) > 1,
          },
        },
      })
    } catch (error) {
      logger.error('이미지 목록 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '이미지 목록 조회 중 오류가 발생했습니다.',
      })
    }
  }

  // 이미지 상세 조회
  getImageById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params

      // 실제로는 데이터베이스에서 조회
      // 여기서는 샘플 데이터 반환
      const sampleImage = {
        id,
        url: `https://example.com/${id}.jpg`,
        prompt: 'Sample generated image',
        model: 'replicate',
        style: 'realistic',
        aspectRatio: '1:1',
        createdAt: new Date().toISOString(),
        metadata: {
          width: 1024,
          height: 1024,
          format: 'png',
        },
      }

      res.json({
        success: true,
        data: sampleImage,
      })
    } catch (error) {
      logger.error('이미지 상세 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '이미지 조회 중 오류가 발생했습니다.',
      })
    }
  }

  // 이미지 삭제
  deleteImage = async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const userId = req.user?.id

      // 실제로는 데이터베이스에서 삭제
      // 여기서는 성공 응답 반환

      logger.info('이미지 삭제 완료', {
        imageId: id,
        userId,
      })

      res.json({
        success: true,
        data: {
          id,
          deleted: true,
        },
      })
    } catch (error) {
      logger.error('이미지 삭제 실패:', error)
      res.status(500).json({
        success: false,
        error: '이미지 삭제 중 오류가 발생했습니다.',
      })
    }
  }

  // 사용 가능한 모델 목록
  getModels = async (req: Request, res: Response) => {
    try {
      const models = this.aiService.getAvailableModels()

      const modelDetails = {
        image: [
          {
            id: 'replicate',
            name: 'Replicate SDXL',
            description: 'Stable Diffusion XL 고품질 이미지 생성',
            maxResolution: '1024x1024',
            speed: '중간',
          },
          {
            id: 'stability',
            name: 'Stability AI',
            description: 'Stability AI의 다양한 모델 지원',
            maxResolution: '1024x1024',
            speed: '빠름',
          },
          {
            id: 'openai',
            name: 'DALL-E 3',
            description: 'OpenAI의 고품질 이미지 생성',
            maxResolution: '1024x1024',
            speed: '중간',
          },
        ],
        chat: [
          {
            id: 'gpt-4',
            name: 'GPT-4',
            description: '가장 강력한 AI 모델',
            maxTokens: 4000,
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            description: '빠르고 효율적인 AI 모델',
            maxTokens: 2000,
          },
        ],
      }

      res.json({
        success: true,
        data: modelDetails,
      })
    } catch (error) {
      logger.error('모델 목록 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '모델 목록 조회 중 오류가 발생했습니다.',
      })
    }
  }
}
