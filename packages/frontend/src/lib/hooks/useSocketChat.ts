/**
 * Socket.IO 채팅 훅
 * - ACK 기반 메시지 전송
 * - 메시지 상태 관리 (sent/failed)
 * - 스트리밍 응답 처리
 * - 방 재참여
 */

import { useEffect, useCallback, useState, useRef } from 'react'
import { Socket } from 'socket.io-client'

// =====================================================
// 타입 정의
// =====================================================

export type MessageStatus = 'pending' | 'sent' | 'failed'

export interface ChatMessage {
  id: string
  content: string
  senderId: string
  characterId?: string
  characterName?: string
  role: 'user' | 'assistant' | 'system'
  timestamp: string
  roomId: string
  status?: MessageStatus
  isStreaming?: boolean
  isError?: boolean
  retryCount?: number
}

interface MessageAck {
  success: boolean
  messageId?: string
  timestamp?: string
  error?: string
}

interface UseSocketChatOptions {
  socket: Socket | null
  isConnected: boolean
  roomId?: string
  characterId?: string
  onMessage?: (message: ChatMessage) => void
  onStreamStart?: (messageId: string) => void
  onStreamChunk?: (messageId: string, chunk: string, fullContent: string) => void
  onStreamEnd?: (message: ChatMessage) => void
  onStreamError?: (messageId: string, error: string) => void
  onTypingStart?: (userId: string) => void
  onTypingStop?: (userId: string) => void
  onRoomJoined?: (data: RoomJoinedData) => void
  onError?: (error: string) => void
  ackTimeout?: number
  maxRetries?: number
}

interface RoomJoinedData {
  roomId: string
  users: string[]
  timestamp: string
  wasReconnection?: boolean
}

interface ConversationHistoryItem {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// =====================================================
// 상수
// =====================================================

const DEFAULT_ACK_TIMEOUT = 5000 // 5초
const DEFAULT_MAX_RETRIES = 2

// =====================================================
// Hook 구현
// =====================================================

export function useSocketChat(options: UseSocketChatOptions) {
  const {
    socket,
    isConnected,
    roomId,
    characterId,
    onMessage,
    onStreamStart,
    onStreamChunk,
    onStreamEnd,
    onStreamError,
    onTypingStart,
    onTypingStop,
    onRoomJoined,
    onError,
    ackTimeout = DEFAULT_ACK_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessages, setStreamingMessages] = useState<Map<string, string>>(new Map())
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [isInRoom, setIsInRoom] = useState(false)
  const [pendingMessages, setPendingMessages] = useState<Set<string>>(new Set())

  const conversationHistoryRef = useRef<ConversationHistoryItem[]>([])
  const currentRoomRef = useRef<string | null>(null)

  /**
   * 메시지 상태 업데이트
   */
  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, status } : msg
    ))

    if (status === 'sent' || status === 'failed') {
      setPendingMessages(prev => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    }
  }, [])

  /**
   * 방 참여
   */
  const joinRoom = useCallback((targetRoomId: string, targetCharacterId?: string) => {
    if (!socket || !isConnected) {
      onError?.('소켓이 연결되어 있지 않습니다.')
      return
    }

    console.log('[Chat] Joining room:', targetRoomId)
    currentRoomRef.current = targetRoomId

    socket.emit('room:join', {
      roomId: targetRoomId,
      characterId: targetCharacterId || characterId,
    })
  }, [socket, isConnected, characterId, onError])

  /**
   * 방 재참여 (재연결 시)
   */
  const rejoinRoom = useCallback((targetRoomId: string, targetCharacterId?: string) => {
    if (!socket || !isConnected) {
      onError?.('소켓이 연결되어 있지 않습니다.')
      return
    }

    console.log('[Chat] Rejoining room:', targetRoomId)
    currentRoomRef.current = targetRoomId

    socket.emit('room:rejoin', {
      roomId: targetRoomId,
      characterId: targetCharacterId || characterId,
    })
  }, [socket, isConnected, characterId, onError])

  /**
   * 방 나가기
   */
  const leaveRoom = useCallback((targetRoomId?: string) => {
    if (!socket || !isConnected) return

    const roomToLeave = targetRoomId || currentRoomRef.current
    if (!roomToLeave) return

    console.log('[Chat] Leaving room:', roomToLeave)
    socket.emit('room:leave', { roomId: roomToLeave })
    
    if (roomToLeave === currentRoomRef.current) {
      currentRoomRef.current = null
      setIsInRoom(false)
    }
  }, [socket, isConnected])

  /**
   * 메시지 전송 (ACK 지원)
   */
  const sendMessage = useCallback(async (
    content: string,
    streaming = true
  ): Promise<boolean> => {
    if (!socket || !isConnected) {
      onError?.('소켓이 연결되어 있지 않습니다.')
      return false
    }

    if (!currentRoomRef.current) {
      onError?.('채팅방에 참여하지 않았습니다.')
      return false
    }

    const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timestamp = new Date().toISOString()

    // 낙관적 UI 업데이트
    const userMessage: ChatMessage = {
      id: clientMessageId,
      content,
      senderId: 'user',
      characterId,
      role: 'user',
      timestamp,
      roomId: currentRoomRef.current,
      status: 'pending',
    }

    setMessages(prev => [...prev, userMessage])
    setPendingMessages(prev => new Set(prev).add(clientMessageId))

    // 대화 히스토리 업데이트
    conversationHistoryRef.current.push({ role: 'user', content })

    return new Promise((resolve) => {
      const event = streaming ? 'message:send:stream' : 'message:send'
      
      const timeoutId = setTimeout(() => {
        console.warn('[Chat] ACK timeout for:', clientMessageId)
        updateMessageStatus(clientMessageId, 'failed')
        resolve(false)
      }, ackTimeout)

      socket.emit(event, {
        content,
        characterId,
        roomId: currentRoomRef.current,
        clientMessageId,
        conversationHistory: conversationHistoryRef.current.slice(-20), // 최근 20개
      }, (ack: MessageAck) => {
        clearTimeout(timeoutId)

        if (ack.success) {
          console.log('[Chat] Message ACK received:', ack.messageId)
          updateMessageStatus(clientMessageId, 'sent')
          resolve(true)
        } else {
          console.error('[Chat] Message ACK failed:', ack.error)
          updateMessageStatus(clientMessageId, 'failed')
          onError?.(ack.error || '메시지 전송 실패')
          resolve(false)
        }
      })
    })
  }, [socket, isConnected, characterId, ackTimeout, updateMessageStatus, onError])

  /**
   * 실패한 메시지 재전송
   */
  const retryMessage = useCallback(async (messageId: string): Promise<boolean> => {
    const message = messages.find(m => m.id === messageId)
    if (!message || message.status !== 'failed') {
      return false
    }

    const retryCount = (message.retryCount || 0) + 1
    if (retryCount > maxRetries) {
      onError?.('최대 재시도 횟수를 초과했습니다.')
      return false
    }

    // 메시지 상태 업데이트
    setMessages(prev => prev.map(msg =>
      msg.id === messageId 
        ? { ...msg, status: 'pending' as MessageStatus, retryCount }
        : msg
    ))

    return sendMessage(message.content)
  }, [messages, maxRetries, sendMessage, onError])

  /**
   * 타이핑 시작
   */
  const startTyping = useCallback(() => {
    if (!socket || !isConnected || !currentRoomRef.current || isTyping) return

    setIsTyping(true)
    socket.emit('typing:start', { roomId: currentRoomRef.current })
  }, [socket, isConnected, isTyping])

  /**
   * 타이핑 중지
   */
  const stopTyping = useCallback(() => {
    if (!socket || !isConnected || !currentRoomRef.current || !isTyping) return

    setIsTyping(false)
    socket.emit('typing:stop', { roomId: currentRoomRef.current })
  }, [socket, isConnected, isTyping])

  /**
   * 메시지 히스토리 로드
   */
  const loadMessageHistory = useCallback((limit = 50): Promise<ChatMessage[]> => {
    return new Promise((resolve, reject) => {
      if (!socket || !isConnected || !currentRoomRef.current) {
        reject(new Error('소켓이 연결되어 있지 않습니다.'))
        return
      }

      socket.emit('messages:history', {
        roomId: currentRoomRef.current,
        limit,
      }, (result: { success: boolean; messages?: ChatMessage[]; error?: string }) => {
        if (result.success && result.messages) {
          setMessages(result.messages.map(msg => ({ ...msg, status: 'sent' as MessageStatus })))
          resolve(result.messages)
        } else {
          reject(new Error(result.error || '히스토리 로드 실패'))
        }
      })
    })
  }, [socket, isConnected])

  /**
   * 메시지 초기화
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    setStreamingMessages(new Map())
    conversationHistoryRef.current = []
  }, [])

  // =====================================================
  // 이벤트 리스너 등록
  // =====================================================

  useEffect(() => {
    if (!socket) return

    // 방 참여 성공
    const handleRoomJoined = (data: RoomJoinedData) => {
      console.log('[Chat] Room joined:', data)
      setIsInRoom(true)
      currentRoomRef.current = data.roomId
      onRoomJoined?.(data)
    }

    // 방 재참여 성공
    const handleRoomRejoined = (data: RoomJoinedData) => {
      console.log('[Chat] Room rejoined:', data)
      setIsInRoom(true)
      currentRoomRef.current = data.roomId
      onRoomJoined?.(data)
    }

    // 방 나가기 성공
    const handleRoomLeft = (data: { roomId: string }) => {
      console.log('[Chat] Room left:', data.roomId)
      if (data.roomId === currentRoomRef.current) {
        setIsInRoom(false)
        currentRoomRef.current = null
      }
    }

    // 일반 메시지 수신
    const handleMessage = (message: ChatMessage) => {
      // 자신의 메시지는 이미 추가됨 (낙관적 업데이트)
      if (message.role === 'user' && message.senderId === 'user') {
        return
      }

      const newMessage = { ...message, status: 'sent' as MessageStatus }
      setMessages(prev => [...prev, newMessage])
      
      if (message.role === 'assistant') {
        conversationHistoryRef.current.push({ 
          role: 'assistant', 
          content: message.content 
        })
      }
      
      onMessage?.(newMessage)
    }

    // 스트리밍 시작
    const handleStreamStart = (data: { id: string; characterId?: string; characterName?: string }) => {
      console.log('[Chat] Stream start:', data.id)
      setStreamingMessages(prev => new Map(prev).set(data.id, ''))
      onStreamStart?.(data.id)
    }

    // 스트리밍 청크
    const handleStreamChunk = (data: { id: string; chunk: string }) => {
      setStreamingMessages(prev => {
        const current = prev.get(data.id) || ''
        const updated = current + data.chunk
        const next = new Map(prev)
        next.set(data.id, updated)
        return next
      })

      const fullContent = (streamingMessages.get(data.id) || '') + data.chunk
      onStreamChunk?.(data.id, data.chunk, fullContent)
    }

    // 스트리밍 완료
    const handleStreamEnd = (data: ChatMessage) => {
      console.log('[Chat] Stream end:', data.id)
      
      // 스트리밍 상태에서 완료된 메시지로 변환
      setStreamingMessages(prev => {
        const next = new Map(prev)
        next.delete(data.id)
        return next
      })

      const finalMessage = { ...data, status: 'sent' as MessageStatus, isStreaming: false }
      setMessages(prev => [...prev, finalMessage])
      
      conversationHistoryRef.current.push({ 
        role: 'assistant', 
        content: data.content 
      })
      
      onStreamEnd?.(finalMessage)
    }

    // 스트리밍 에러
    const handleStreamError = (data: { id: string; error: string }) => {
      console.error('[Chat] Stream error:', data)
      
      setStreamingMessages(prev => {
        const next = new Map(prev)
        next.delete(data.id)
        return next
      })

      onStreamError?.(data.id, data.error)
    }

    // 타이핑 시작
    const handleTypingStart = (data: { userId: string }) => {
      if (data.userId !== 'user') {
        setTypingUsers(prev => [...prev.filter(id => id !== data.userId), data.userId])
        onTypingStart?.(data.userId)
      }
    }

    // 타이핑 중지
    const handleTypingStop = (data: { userId: string }) => {
      setTypingUsers(prev => prev.filter(id => id !== data.userId))
      onTypingStop?.(data.userId)
    }

    // 에러
    const handleError = (data: { message: string }) => {
      console.error('[Chat] Socket error:', data.message)
      onError?.(data.message)
    }

    // 리스너 등록
    socket.on('room:joined', handleRoomJoined)
    socket.on('room:rejoined', handleRoomRejoined)
    socket.on('room:left', handleRoomLeft)
    socket.on('message', handleMessage)
    socket.on('message:stream:start', handleStreamStart)
    socket.on('message:stream:chunk', handleStreamChunk)
    socket.on('message:stream:end', handleStreamEnd)
    socket.on('message:stream:error', handleStreamError)
    socket.on('typing:start', handleTypingStart)
    socket.on('typing:stop', handleTypingStop)
    socket.on('error', handleError)

    // 정리
    return () => {
      socket.off('room:joined', handleRoomJoined)
      socket.off('room:rejoined', handleRoomRejoined)
      socket.off('room:left', handleRoomLeft)
      socket.off('message', handleMessage)
      socket.off('message:stream:start', handleStreamStart)
      socket.off('message:stream:chunk', handleStreamChunk)
      socket.off('message:stream:end', handleStreamEnd)
      socket.off('message:stream:error', handleStreamError)
      socket.off('typing:start', handleTypingStart)
      socket.off('typing:stop', handleTypingStop)
      socket.off('error', handleError)
    }
  }, [socket, onMessage, onStreamStart, onStreamChunk, onStreamEnd, onStreamError, onTypingStart, onTypingStop, onRoomJoined, onError, streamingMessages])

  // roomId가 변경되면 자동으로 방 참여
  useEffect(() => {
    if (isConnected && roomId && roomId !== currentRoomRef.current) {
      joinRoom(roomId, characterId)
    }
  }, [isConnected, roomId, characterId, joinRoom])

  return {
    // 상태
    messages,
    streamingMessages,
    isTyping,
    typingUsers,
    isInRoom,
    pendingMessages: Array.from(pendingMessages),

    // 방 관리
    joinRoom,
    rejoinRoom,
    leaveRoom,

    // 메시지
    sendMessage,
    retryMessage,
    clearMessages,
    loadMessageHistory,

    // 타이핑
    startTyping,
    stopTyping,

    // 유틸
    currentRoomId: currentRoomRef.current,
  }
}

export type { UseSocketChatOptions, RoomJoinedData, ConversationHistoryItem }

