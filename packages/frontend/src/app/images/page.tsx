'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  model: string
  createdAt: string
}

export default function ImagesPage() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [selectedModel, setSelectedModel] = useState('replicate')
  const [aspectRatio, setAspectRatio] = useState('1:1')

  const models = [
    { id: 'replicate', name: 'Replicate SDXL', description: '고품질 이미지 생성' },
    { id: 'stability', name: 'Stability AI', description: '빠르고 안정적인 생성' },
    { id: 'openai', name: 'DALL-E 3', description: 'OpenAI 고품질 생성' },
  ]

  const aspectRatios = [
    { value: '1:1', label: '정사각형', icon: '⬜' },
    { value: '16:9', label: '가로형', icon: '⬌' },
    { value: '9:16', label: '세로형', icon: '⬍' },
    { value: '4:3', label: '클래식', icon: '📐' },
  ]

  const handleGenerateImage = async () => {
    if (!prompt.trim()) return

    setIsGenerating(true)

    try {
      // 실제로는 API 호출
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
          aspectRatio,
        }),
      })

      if (!response.ok) {
        throw new Error('이미지 생성에 실패했습니다.')
      }

      const result = await response.json()

      const newImage: GeneratedImage = {
        id: result.data.id || `img_${Date.now()}`,
        url: result.data.imageUrl,
        prompt: prompt.trim(),
        model: selectedModel,
        createdAt: new Date().toISOString(),
      }

      setGeneratedImages(prev => [newImage, ...prev])
      setPrompt('')

    } catch (error) {
      console.error('이미지 생성 실패:', error)
      alert('이미지 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('다운로드 실패:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI 이미지 생성</h1>
              <p className="text-gray-600">텍스트로 AI 이미지를 생성해보세요</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 생성 설정 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 프롬프트 입력 */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">이미지 설명</h2>
              </CardHeader>
              <CardContent>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="생성할 이미지에 대해 자세히 설명해주세요..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                />
                <p className="text-sm text-gray-500 mt-2">
                  {prompt.length}/1000자
                </p>
              </CardContent>
            </Card>

            {/* 모델 선택 */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">AI 모델 선택</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {models.map((model) => (
                    <label key={model.id} className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="model"
                        value={model.id}
                        checked={selectedModel === model.id}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-blue-600"
                      />
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-sm text-gray-500">{model.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 종횡비 선택 */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">종횡비</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={`p-3 border rounded-lg text-center transition-colors ${
                        aspectRatio === ratio.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{ratio.icon}</div>
                      <div className="text-sm font-medium">{ratio.label}</div>
                      <div className="text-xs text-gray-500">{ratio.value}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 생성 버튼 */}
            <Button
              onClick={handleGenerateImage}
              disabled={!prompt.trim() || isGenerating}
              isLoading={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? '생성 중...' : '이미지 생성'}
            </Button>
          </div>

          {/* 생성 결과 */}
          <div className="lg:col-span-2">
            {generatedImages.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-gray-500">
                    <div className="text-6xl mb-4">🎨</div>
                    <h3 className="text-lg font-medium mb-2">첫 번째 AI 이미지를 생성해보세요</h3>
                    <p className="text-sm">
                      왼쪽에서 프롬프트를 입력하고 모델을 선택한 후 생성 버튼을 클릭하세요.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generatedImages.map((image) => (
                  <Card key={image.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 line-clamp-2">
                            {image.prompt}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {image.model} • {new Date(image.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadImage(image.url, `ai-image-${image.id}.png`)}
                        >
                          다운로드
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={image.url}
                          alt={image.prompt}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
