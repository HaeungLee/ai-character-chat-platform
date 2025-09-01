// Stability AI 서비스
import { logger } from '../../utils/logger'

export interface StabilityConfig {
  apiKey: string
  baseUrl?: string
}

export interface StabilityImageOptions {
  width?: number
  height?: number
  cfg_scale?: number
  steps?: number
  samples?: number
  style_preset?: string
  negative_prompt?: string
}

export class StabilityAIService {
  private apiKey: string
  private baseUrl: string

  constructor(config: StabilityConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.stability.ai'
  }

  // 텍스트 투 이미지 생성
  async generateImage(
    prompt: string,
    options?: StabilityImageOptions
  ): Promise<string> {
    try {
      const enhancedPrompt = this.enhanceImagePrompt(prompt)

      const formData = new FormData()
      formData.append('prompt', enhancedPrompt)
      formData.append('output_format', 'png')

      // 옵션들 추가
      if (options?.width) formData.append('width', options.width.toString())
      if (options?.height) formData.append('height', options.height.toString())
      if (options?.cfg_scale) formData.append('cfg_scale', options.cfg_scale.toString())
      if (options?.steps) formData.append('steps', options.steps.toString())
      if (options?.samples) formData.append('samples', options.samples?.toString() || '1')
      if (options?.style_preset) formData.append('style_preset', options.style_preset)
      if (options?.negative_prompt) {
        formData.append('negative_prompt', options.negative_prompt)
      }

      logger.info('Stability AI 이미지 생성 시작', { prompt: prompt.substring(0, 100) })

      const response = await fetch(`${this.baseUrl}/v2beta/stable-image/generate/core`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'image/*',
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Stability AI API 오류: ${response.status} - ${errorText}`)
      }

      // 응답이 이미지인 경우
      if (response.headers.get('content-type')?.startsWith('image/')) {
        const arrayBuffer = await response.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const dataUrl = `data:image/png;base64,${base64}`

        logger.info('Stability AI 이미지 생성 완료')
        return dataUrl
      }

      // JSON 응답인 경우 (여러 이미지)
      const result = await response.json()
      if (result.artifacts && result.artifacts.length > 0) {
        const base64 = result.artifacts[0].base64
        const dataUrl = `data:image/png;base64,${base64}`

        logger.info('Stability AI 이미지 생성 완료')
        return dataUrl
      }

      throw new Error('이미지 생성 결과가 없습니다.')

    } catch (error) {
      logger.error('Stability AI 이미지 생성 실패:', error)
      throw new Error('Stability AI 이미지 생성 중 오류가 발생했습니다.')
    }
  }

  // SDXL 모델로 이미지 생성
  async generateImageSDXL(
    prompt: string,
    options?: StabilityImageOptions
  ): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('prompt', this.enhanceImagePrompt(prompt))
      formData.append('output_format', 'png')

      // SDXL 기본 옵션들
      formData.append('model', 'stable-diffusion-xl-1024-v1-0')
      if (options?.width) formData.append('width', options.width.toString())
      if (options?.height) formData.append('height', options.height.toString())
      if (options?.cfg_scale) formData.append('cfg_scale', options.cfg_scale.toString())
      if (options?.steps) formData.append('steps', options.steps.toString())
      if (options?.samples) formData.append('samples', options.samples?.toString() || '1')
      if (options?.negative_prompt) {
        formData.append('negative_prompt', options.negative_prompt)
      }

      const response = await fetch(`${this.baseUrl}/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Stability AI SDXL API 오류: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      if (result.artifacts && result.artifacts.length > 0) {
        const base64 = result.artifacts[0].base64
        return `data:image/png;base64,${base64}`
      }

      throw new Error('SDXL 이미지 생성 결과가 없습니다.')

    } catch (error) {
      logger.error('Stability AI SDXL 이미지 생성 실패:', error)
      throw error
    }
  }

  // 이미지 업스케일링
  async upscaleImage(
    imageData: string, // base64 또는 URL
    options?: {
      width?: number
      height?: number
    }
  ): Promise<string> {
    try {
      const formData = new FormData()

      // 이미지 데이터가 base64인 경우
      if (imageData.startsWith('data:image/')) {
        const base64Data = imageData.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        const blob = new Blob([buffer], { type: 'image/png' })
        formData.append('image', blob)
      } else {
        // URL인 경우 다운로드 후 업로드
        const imageResponse = await fetch(imageData)
        const imageBlob = await imageResponse.blob()
        formData.append('image', imageBlob)
      }

      if (options?.width) formData.append('width', options.width.toString())
      if (options?.height) formData.append('height', options.height.toString())

      const response = await fetch(`${this.baseUrl}/v2beta/stable-image/upscale/fast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'image/*',
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Stability AI 업스케일링 오류: ${response.status} - ${errorText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      return `data:image/png;base64,${base64}`

    } catch (error) {
      logger.error('Stability AI 이미지 업스케일링 실패:', error)
      throw new Error('이미지 업스케일링 중 오류가 발생했습니다.')
    }
  }

  // 프롬프트 최적화
  private enhanceImagePrompt(prompt: string): string {
    return `${prompt}, high quality, detailed, professional, 8k, sharp focus, well lit, masterpiece, best quality`
  }

  // 사용량 및 잔액 확인
  async getBalance(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v2beta/user/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Balance API 오류: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Stability AI 잔액 조회 실패:', error)
      return null
    }
  }

  // 지원되는 스타일 프리셋 목록
  getStylePresets(): string[] {
    return [
      'enhance', 'anime', 'photographic', 'digital-art', 'comic-book',
      'fantasy-art', 'line-art', 'analog-film', 'neon-punk', 'isometric',
      'low-poly', 'origami', 'modeling-compound', 'cinematic', '3d-model',
      'pixel-art', 'tile-texture'
    ]
  }

  // 모델 목록
  getModels(): any[] {
    return [
      {
        name: 'Stable Diffusion XL',
        model: 'stable-diffusion-xl-1024-v1-0',
        description: '최신 SDXL 모델, 고품질 이미지 생성'
      },
      {
        name: 'Stable Diffusion 2.1',
        model: 'stable-diffusion-512-v2-1',
        description: '안정적인 이미지 생성'
      },
      {
        name: 'Stable Diffusion 1.5',
        model: 'stable-diffusion-v1-5',
        description: '클래식 SD 모델'
      }
    ]
  }
}
