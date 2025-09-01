'use client'

import { useState, useRef, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'

interface Message {
  id: string
  content: string
  senderId: string
  characterId?: string
  role: 'user' | 'assistant' | 'system'
  timestamp: string
  roomId?: string
}

interface Character {
  id: string
  name: string
  avatar?: string
  description?: string
  personality?: string
}

export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [roomId] = useState(`room_${Date.now()}`)
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
    const initSocket = async () => {
      try {
        const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000', {
          auth: {
            token: localStorage.getItem('auth_token'), // 실제로는 JWT 토큰 사용
          },
        })

        socketInstance.on('connect', () => {
          setIsConnected(true)
          console.log('Socket connected')

          // 방 참여
          socketInstance.emit('room:join', { roomId })
        })

        socketInstance.on('disconnect', () => {
          setIsConnected(false)
          console.log('Socket disconnected')
        })

        socketInstance.on('room:joined', (data) => {
          console.log('Joined room:', data.roomId)
        })

        socketInstance.on('message', (message: Message) => {
          setMessages(prev => [...prev, message])
        })

        socketInstance.on('error', (error) => {
          console.error('Socket error:', error)
        })

        setSocket(socketInstance)

        return () => {
          socketInstance.disconnect()
        }
      } catch (error) {
        console.error('Socket initialization failed:', error)
      }
    }

    initSocket()
  }, [roomId])

  // 메시지 추가 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 메시지 전송
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputMessage.trim() || isLoading || !socket || !isConnected) return

    const messageContent = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    try {
      // Socket.IO를 통해 메시지 전송
      socket.emit('message:send', {
        content: messageContent,
        characterId: selectedCharacter?.id,
        roomId,
        timestamp: new Date().toISOString(),
      })

      // 타이핑 시작
      socket.emit('typing:start', { roomId })

      // 잠시 후 타이핑 종료
      setTimeout(() => {
        socket.emit('typing:stop', { roomId })
      }, 1000)

    } catch (error) {
      console.error('메시지 전송 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
            </div>
          </div>

          {/* 채팅 영역 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm h-[600px] flex flex-col">
              {/* 메시지 목록 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
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
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : message.role === 'assistant'
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-yellow-100 text-yellow-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.role === 'user'
                            ? 'text-blue-100'
                            : 'text-gray-500'
                        }`}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {/* 로딩 표시 */}
                {isLoading && (
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
