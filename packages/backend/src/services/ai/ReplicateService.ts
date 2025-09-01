// Replicate 서비스
import Replicate from 'replicate'
import { logger } from '../../utils/logger'

export interface ReplicateConfig {
  apiToken: string
  model?: string
}

export class ReplicateService {
  private client: Replicate
  private defaultModel: string

  constructor(config: ReplicateConfig) {
    this.client = new Replicate({
      auth: config.apiToken,
    })
    this.defaultModel = config.model || 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc'
  }

  // 이미지 생성
  async generateImage(
    prompt: string,
    options?: {
      negativePrompt?: string
      width?: number
      height?: number
      guidanceScale?: number
      numInferenceSteps?: number
      model?: string
    }
  ): Promise<string> {
    try {
      const enhancedPrompt = this.enhanceImagePrompt(prompt)

      const model = options?.model || this.defaultModel
      const input = {
        prompt: enhancedPrompt,
        negative_prompt: options?.negativePrompt || 'blurry, low quality, distorted, ugly, deformed',
        width: options?.width || 1024,
        height: options?.height || 1024,
        guidance_scale: options?.guidanceScale || 7.5,
        num_inference_steps: options?.numInferenceSteps || 20,
      }

      logger.info(`Replicate 이미지 생성 시작: ${model}`, { prompt: prompt.substring(0, 100) })

      const output = await this.client.run(model, { input })

      if (!output || !Array.isArray(output) || output.length === 0) {
        throw new Error('이미지 생성 결과가 없습니다.')
      }

      const imageUrl = output[0]
      if (typeof imageUrl !== 'string') {
        throw new Error('잘못된 이미지 URL 형식입니다.')
      }

      logger.info('Replicate 이미지 생성 완료')
      return imageUrl
    } catch (error) {
      logger.error('Replicate 이미지 생성 실패:', error)
      throw new Error('Replicate 이미지 생성 중 오류가 발생했습니다.')
    }
  }

  // 고급 이미지 생성 (SDXL Turbo)
  async generateImageTurbo(
    prompt: string,
    options?: {
      negativePrompt?: string
      width?: number
      height?: number
    }
  ): Promise<string> {
    try {
      return await this.generateImage(prompt, {
        ...options,
        model: 'stability-ai/sdxl-turbo:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
        guidanceScale: 0.0, // Turbo 모델은 guidance_scale 0 사용
        numInferenceSteps: 1, // Turbo 모델은 1 step만 사용
      })
    } catch (error) {
      logger.error('Replicate Turbo 이미지 생성 실패:', error)
      throw error
    }
  }

  // 이미지 변형 (img2img)
  async transformImage(
    imageUrl: string,
    prompt: string,
    options?: {
      strength?: number
      guidanceScale?: number
      numInferenceSteps?: number
    }
  ): Promise<string> {
    try {
      const input = {
        image: imageUrl,
        prompt: this.enhanceImagePrompt(prompt),
        strength: options?.strength || 0.8,
        guidance_scale: options?.guidanceScale || 7.5,
        num_inference_steps: options?.numInferenceSteps || 20,
      }

      logger.info('Replicate 이미지 변형 시작')

      const output = await this.client.run(
        'stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4c',
        { input }
      )

      if (!output || !Array.isArray(output) || output.length === 0) {
        throw new Error('이미지 변형 결과가 없습니다.')
      }

      const transformedImageUrl = output[0]
      logger.info('Replicate 이미지 변형 완료')
      return transformedImageUrl
    } catch (error) {
      logger.error('Replicate 이미지 변형 실패:', error)
      throw new Error('이미지 변형 중 오류가 발생했습니다.')
    }
  }

  // 프롬프트 최적화
  private enhanceImagePrompt(prompt: string): string {
    return `${prompt}, high quality, detailed, professional, 8k, sharp focus, well lit, masterpiece`
  }

  // 모델 목록 조회
  async listModels(): Promise<any[]> {
    try {
      // 실제로는 Replicate API를 통해 모델 목록을 가져올 수 있음
      return [
        {
          name: 'SDXL',
          model: 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
          description: 'Stable Diffusion XL 고품질 이미지 생성'
        },
        {
          name: 'SDXL Turbo',
          model: 'stability-ai/sdxl-turbo:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
          description: '빠른 속도의 SDXL 이미지 생성'
        }
      ]
    } catch (error) {
      logger.error('Replicate 모델 목록 조회 실패:', error)
      return []
    }
  }

  // 모델 예측 상태 확인
  async getPredictionStatus(predictionId: string): Promise<any> {
    try {
      // 실제로는 Replicate API를 통해 예측 상태를 확인할 수 있음
      const prediction = await this.client.predictions.get(predictionId)
      return {
        id: prediction.id,
        status: prediction.status,
        output: prediction.output,
        error: prediction.error,
      }
    } catch (error) {
      logger.error('Replicate 예측 상태 조회 실패:', error)
      throw error
    }
  }
}
