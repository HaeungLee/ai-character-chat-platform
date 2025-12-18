/**
 * 🆕 스트리밍 채팅 커스텀 훅
 * SSE (Server-Sent Events)를 통한 AI 응답 스트리밍 지원
 */

import { useState, useCallback, useRef } from 'react'

interface StreamingMessage {
  type: 'start' | 'chunk' | 'done' | 'error'
  content?: string
  fullResponse?: string
  characterId?: string
  characterName?: string
  error?: string
  usage?: {
    estimatedTokens: number
  }
}

interface UseStreamingChatOptions {
  apiUrl?: string
  onStart?: (data: StreamingMessage) => void
  onChunk?: (chunk: string, fullContent: string) => void
  onComplete?: (fullResponse: string, usage?: { estimatedTokens: number }) => void
  onError?: (error: string) => void
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const {
    apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    onStart,
    onChunk,
    onComplete,
    onError,
  } = options

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * 캐릭터 채팅 스트리밍 요청
   */
  const streamCharacterChat = useCallback(async (
    characterId: string,
    message: string,
    conversationHistory: ChatMessage[] = [],
    token?: string
  ) => {
    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsStreaming(true)
    setStreamingContent('')
    setError(null)

    try {
      const response = await fetch(`${apiUrl}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          characterId,
          message,
          conversationHistory,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            if (data === '[DONE]') {
              continue
            }

            try {
              const parsed: StreamingMessage = JSON.parse(data)

              switch (parsed.type) {
                case 'start':
                  onStart?.(parsed)
                  break

                case 'chunk':
                  if (parsed.content) {
                    fullContent += parsed.content
                    setStreamingContent(fullContent)
                    onChunk?.(parsed.content, fullContent)
                  }
                  break

                case 'done':
                  onComplete?.(parsed.fullResponse || fullContent, parsed.usage)
                  break

                case 'error':
                  setError(parsed.error || 'Unknown error')
                  onError?.(parsed.error || 'Unknown error')
                  break
              }
            } catch {
              // JSON 파싱 실패 무시 (불완전한 청크일 수 있음)
            }
          }
        }
      }

      return fullContent
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Streaming request aborted')
        return null
      }

      const errorMessage = err instanceof Error ? err.message : 'Streaming failed'
      setError(errorMessage)
      onError?.(errorMessage)
      throw err
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [apiUrl, onStart, onChunk, onComplete, onError])

  /**
   * 일반 채팅 스트리밍 요청
   */
  const streamChat = useCallback(async (
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
    token?: string
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsStreaming(true)
    setStreamingContent('')
    setError(null)

    try {
      const response = await fetch(`${apiUrl}/api/ai/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          messages,
          ...options,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            if (data === '[DONE]') continue

            try {
              const parsed: StreamingMessage = JSON.parse(data)

              switch (parsed.type) {
                case 'start':
                  onStart?.(parsed)
                  break

                case 'chunk':
                  if (parsed.content) {
                    fullContent += parsed.content
                    setStreamingContent(fullContent)
                    onChunk?.(parsed.content, fullContent)
                  }
                  break

                case 'done':
                  onComplete?.(parsed.fullResponse || fullContent, parsed.usage)
                  break

                case 'error':
                  setError(parsed.error || 'Unknown error')
                  onError?.(parsed.error || 'Unknown error')
                  break
              }
            } catch {
              // JSON 파싱 실패 무시
            }
          }
        }
      }

      return fullContent
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Streaming request aborted')
        return null
      }

      const errorMessage = err instanceof Error ? err.message : 'Streaming failed'
      setError(errorMessage)
      onError?.(errorMessage)
      throw err
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [apiUrl, onStart, onChunk, onComplete, onError])

  /**
   * 현재 진행 중인 스트리밍 취소
   */
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }, [])

  /**
   * 상태 초기화
   */
  const reset = useCallback(() => {
    cancelStreaming()
    setStreamingContent('')
    setError(null)
  }, [cancelStreaming])

  return {
    // 상태
    isStreaming,
    streamingContent,
    error,

    // 메서드
    streamCharacterChat,
    streamChat,
    cancelStreaming,
    reset,
  }
}

export type { StreamingMessage, UseStreamingChatOptions, ChatMessage }



