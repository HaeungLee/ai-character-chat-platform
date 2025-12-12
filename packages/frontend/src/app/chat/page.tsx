'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'

interface Message {
  id: string
  content: string
  senderId: string
  characterId?: string
  characterName?: string
  role: 'user' | 'assistant' | 'system'
  timestamp: string
  roomId?: string
  isStreaming?: boolean // 스트리밍 중인 메시지 표시
}

interface Character {
  id: string
  name: string
  avatar?: string
  description?: string
  personality?: string
}

interface StreamingMessage {
  id: string
  content: string
  characterId: string
  characterName: string
}

export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [roomId] = useState(`room_${Date.now()}`)
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 샘플 캐릭터들
  const characters: Character[] = [
    {
      id: 'sample_char_1',
      name: '친절한 AI 어시스턴트',
      avatar: '🤖',
      description: '항상 친절하고 도움이 되는 AI 어시스턴트',
      personality: '친절하고, 도움이 되고, 전문적임',
    },
    {
      id: 'sample_char_2',
      name: '창의적인 작가',
      avatar: '✍️',
      description: '다양한 주제로 창의적인 글을 쓰는 AI 작가',
      personality: '창의적이고, 영감을 주는, 글쓰기 전문가',
    },
  ]

  // Socket.IO 연결 초기화
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000', {
      auth: {
        token: localStorage.getItem('auth_token'),
      },
    })

    // 연결 이벤트
    socketInstance.on('connect', () => {
      setIsConnected(true)
      console.log('Socket connected')
      socketInstance.emit('room:join', { roomId })
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
      console.log('Socket disconnected')
    })

    socketInstance.on('room:joined', (data) => {
      console.log('Joined room:', data.roomId)
    })

    // 일반 메시지 수신
    socketInstance.on('message', (message: Message) => {
      setMessages(prev => [...prev, message])
      setIsLoading(false)
    })

    // 🆕 스트리밍 시작
    socketInstance.on('message:stream:start', (data) => {
      console.log('Streaming started:', data)
      setStreamingMessage({
        id: data.id,
        content: '',
        characterId: data.characterId,
        characterName: data.characterName,
      })
      setIsAiTyping(true)
    })

    // 🆕 스트리밍 청크 수신 (타자기 효과)
    socketInstance.on('message:stream:chunk', (data) => {
      setStreamingMessage(prev => {
        if (!prev || prev.id !== data.id) return prev
        return {
          ...prev,
          content: prev.content + data.chunk,
        }
      })
    })

    // 🆕 스트리밍 완료
    socketInstance.on('message:stream:end', (data) => {
      console.log('Streaming ended:', data)
      
      // 완료된 메시지를 messages 배열에 추가
      const completeMessage: Message = {
        id: data.id,
        content: data.content,
        senderId: data.senderId,
        characterId: data.characterId,
        characterName: data.characterName,
        role: 'assistant',
        timestamp: data.timestamp,
        roomId: data.roomId,
      }
      
      setMessages(prev => [...prev, completeMessage])
      setStreamingMessage(null)
      setIsAiTyping(false)
      setIsLoading(false)
    })

    // 🆕 스트리밍 오류
    socketInstance.on('message:stream:error', (data) => {
      console.error('Streaming error:', data)
      setStreamingMessage(null)
      setIsAiTyping(false)
      setIsLoading(false)
      
      // 오류 메시지 추가
      const errorMessage: Message = {
        id: data.id,
        content: '죄송합니다. 응답 생성 중 오류가 발생했습니다.',
        senderId: 'system',
        characterId: data.characterId,
        role: 'system',
        timestamp: data.timestamp,
        roomId: data.roomId,
      }
      setMessages(prev => [...prev, errorMessage])
    })

    // AI 타이핑 이벤트
    socketInstance.on('typing:start', (data) => {
      if (data.userId === 'ai') {
        setIsAiTyping(true)
      }
    })

    socketInstance.on('typing:stop', (data) => {
      if (data.userId === 'ai') {
        setIsAiTyping(false)
      }
    })

    socketInstance.on('error', (error) => {
      console.error('Socket error:', error)
      setIsLoading(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [roomId])

  // 메시지 추가 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessage])

  // 🆕 스트리밍 메시지 전송
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputMessage.trim() || isLoading || !socket || !isConnected) return

    const messageContent = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    // 대화 기록 가져오기 (최근 10개)
    const conversationHistory = messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    // 🆕 스트리밍 모드로 메시지 전송
    socket.emit('message:send:stream', {
      content: messageContent,
      characterId: selectedCharacter?.id,
      roomId,
      conversationHistory,
      timestamp: new Date().toISOString(),
    })
  }, [inputMessage, isLoading, socket, isConnected, selectedCharacter, roomId, messages])

  // 캐릭터 선택
  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {selectedCharacter?.avatar || 'AI'}
                </span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {selectedCharacter?.name || 'AI 캐릭터'}
                </h1>
                <p className="text-sm text-gray-500 flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {isConnected ? '온라인' : '오프라인'}
                  {isAiTyping && <span className="ml-2 text-blue-500">• 입력 중...</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCharacter(null)}
              >
                캐릭터 변경
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 캐릭터 선택 사이드바 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">AI 캐릭터 선택</h2>
              <div className="space-y-3">
                {characters.map((character) => (
                  <div
                    key={character.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCharacter?.id === character.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleCharacterSelect(character)}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{character.avatar}</span>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{character.name}</h3>
                        <p className="text-sm text-gray-500">{character.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 스트리밍 모드 표시 */}
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700 font-medium">✨ 스트리밍 모드 활성화</p>
                <p className="text-xs text-green-600 mt-1">AI 응답이 실시간으로 표시됩니다</p>
              </div>
            </div>
          </div>

          {/* 채팅 영역 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm h-[600px] flex flex-col">
              {/* 메시지 목록 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && !streamingMessage ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-4">
                        {selectedCharacter?.avatar || '💬'}
                      </div>
                      <h3 className="text-lg font-medium mb-2">
                        {selectedCharacter?.name || 'AI 캐릭터'}와 대화를 시작하세요
                      </h3>
                      <p className="text-sm">
                        왼쪽에서 캐릭터를 선택하고 메시지를 입력해보세요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : message.role === 'assistant'
                              ? 'bg-gray-100 text-gray-900'
                              : 'bg-yellow-100 text-yellow-900'
                          }`}
                        >
                          {message.role === 'assistant' && message.characterName && (
                            <p className="text-xs font-medium text-gray-600 mb-1">
                              {message.characterName}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.role === 'user'
                              ? 'text-blue-100'
                              : 'text-gray-500'
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* 🆕 스트리밍 중인 메시지 표시 (타자기 효과) */}
                    {streamingMessage && (
                      <div className="flex justify-start">
                        <div className="max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg bg-gray-100 text-gray-900">
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            {streamingMessage.characterName}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {streamingMessage.content}
                            <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse" />
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* AI 타이핑 표시 (스트리밍이 아닐 때) */}
                {isAiTyping && !streamingMessage && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-4 py-2 rounded-lg">
                      <div className="flex space-x-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 로딩 표시 */}
                {isLoading && !isAiTyping && !streamingMessage && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-4 py-2 rounded-lg">
                      <Loading size="sm" text="AI가 입력 중..." />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* 메시지 입력 */}
              <div className="border-t p-4">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <Input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={
                      selectedCharacter
                        ? `${selectedCharacter.name}와 대화해보세요...`
                        : "캐릭터를 선택하고 메시지를 입력하세요..."
                    }
                    disabled={isLoading || !isConnected || !selectedCharacter}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!inputMessage.trim() || isLoading || !isConnected || !selectedCharacter}
                    isLoading={isLoading}
                  >
                    전송
                  </Button>
                </form>

                {!selectedCharacter && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    왼쪽에서 AI 캐릭터를 선택해주세요.
                  </p>
                )}

                {!isConnected && (
                  <p className="text-sm text-red-500 mt-2 text-center">
                    서버에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
