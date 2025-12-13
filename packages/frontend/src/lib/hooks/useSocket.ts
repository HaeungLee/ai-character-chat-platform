/**
 * Socket.IO 연결 관리 훅
 * - 재연결 로직
 * - 세션 복구
 * - 중복 연결 감지
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { ConnectionState } from '../types/socket'

// =====================================================
// 타입 정의
// =====================================================

interface UseSocketOptions {
  url?: string
  token?: string
  autoConnect?: boolean
  reconnectionDelay?: number
  reconnectionDelayMax?: number
  maxReconnectionAttempts?: number
  heartbeatInterval?: number
  onConnect?: () => void
  onDisconnect?: (reason: string) => void
  onReconnecting?: (attempt: number) => void
  onReconnectFailed?: () => void
  onReplaced?: () => void
  onSessionRestored?: (data: SessionRestoredData) => void
  onError?: (error: string) => void
}

interface SessionRestoredData {
  previousRoomId?: string
  previousCharacterId?: string
  disconnectedAt: string
  canReconnect: boolean
}

interface UseSocketReturn {
  socket: Socket | null
  isConnected: boolean
  connectionState: ConnectionState
  reconnectAttempts: number
  lastError: string | null
  connect: () => void
  disconnect: () => void
  reconnect: () => void
}

// =====================================================
// Hook 구현
// =====================================================

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000',
    token,
    autoConnect = true,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    maxReconnectionAttempts = 10,
    heartbeatInterval = 30000, // 30초
    onConnect,
    onDisconnect,
    onReconnecting,
    onReconnectFailed,
    onReplaced,
    onSessionRestored,
    onError,
  } = options

  const socketRef = useRef<Socket | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)

  /**
   * 하트비트 시작
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('heartbeat')
      }
    }, heartbeatInterval)
  }, [heartbeatInterval])

  /**
   * 하트비트 중지
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  /**
   * 소켓 연결
   */
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('[Socket] Already connected')
      return
    }

    const authToken = token || localStorage.getItem('auth_token')
    if (!authToken) {
      setLastError('인증 토큰이 없습니다.')
      setConnectionState('failed')
      onError?.('인증 토큰이 없습니다.')
      return
    }

    setConnectionState('connecting')
    setLastError(null)

    // Socket.IO 클라이언트 생성
    const socket = io(url, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: false, // 수동 재연결 처리
      timeout: 10000,
    })

    socketRef.current = socket

    // 연결 성공
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
      setIsConnected(true)
      setConnectionState('connected')
      setReconnectAttempts(0)
      setLastError(null)
      startHeartbeat()
      onConnect?.()
    })

    // 연결 해제
    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      setIsConnected(false)
      stopHeartbeat()

      // 서버에서 강제 종료한 경우 (다른 기기 로그인)
      if (reason === 'io server disconnect') {
        setConnectionState('disconnected')
        onDisconnect?.(reason)
        return
      }

      // 자동 재연결 시도
      if (reason === 'transport close' || reason === 'transport error' || reason === 'ping timeout') {
        setConnectionState('reconnecting')
        scheduleReconnect()
      } else {
        setConnectionState('disconnected')
      }

      onDisconnect?.(reason)
    })

    // 연결 에러
    socket.on('connect_error', (error) => {
      console.error('[Socket] Connect error:', error.message)
      setLastError(error.message)
      
      if (reconnectAttempts < maxReconnectionAttempts) {
        setConnectionState('reconnecting')
        scheduleReconnect()
      } else {
        setConnectionState('failed')
        onReconnectFailed?.()
      }
      
      onError?.(error.message)
    })

    // 다른 기기에서 로그인 (연결 대체)
    socket.on('connection:replaced', (data) => {
      console.warn('[Socket] Connection replaced:', data.message)
      setIsConnected(false)
      setConnectionState('disconnected')
      setLastError(data.message)
      stopHeartbeat()
      onReplaced?.()
    })

    // 세션 복구 정보
    socket.on('session:restored', (data: SessionRestoredData) => {
      console.log('[Socket] Session restored:', data)
      onSessionRestored?.(data)
    })

    // 하트비트 응답
    socket.on('heartbeat:ack', () => {
      // 연결 상태 확인됨
    })

  }, [url, token, startHeartbeat, stopHeartbeat, onConnect, onDisconnect, onError, onReplaced, onSessionRestored, maxReconnectionAttempts, reconnectAttempts, onReconnectFailed])

  /**
   * 재연결 스케줄링
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (reconnectAttempts >= maxReconnectionAttempts) {
      setConnectionState('failed')
      onReconnectFailed?.()
      return
    }

    const delay = Math.min(
      reconnectionDelay * Math.pow(1.5, reconnectAttempts),
      reconnectionDelayMax
    )

    console.log(`[Socket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`)
    onReconnecting?.(reconnectAttempts + 1)

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1)
      
      // 기존 소켓 정리
      if (socketRef.current) {
        socketRef.current.removeAllListeners()
        socketRef.current.close()
        socketRef.current = null
      }

      connect()
    }, delay)
  }, [reconnectAttempts, maxReconnectionAttempts, reconnectionDelay, reconnectionDelayMax, connect, onReconnecting, onReconnectFailed])

  /**
   * 수동 재연결
   */
  const reconnect = useCallback(() => {
    console.log('[Socket] Manual reconnect')
    setReconnectAttempts(0)
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.close()
      socketRef.current = null
    }

    connect()
  }, [connect])

  /**
   * 연결 해제
   */
  const disconnect = useCallback(() => {
    console.log('[Socket] Manual disconnect')
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    stopHeartbeat()

    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.close()
      socketRef.current = null
    }

    setIsConnected(false)
    setConnectionState('disconnected')
  }, [stopHeartbeat])

  // 자동 연결
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    socket: socketRef.current,
    isConnected,
    connectionState,
    reconnectAttempts,
    lastError,
    connect,
    disconnect,
    reconnect,
  }
}

export type { UseSocketOptions, UseSocketReturn, SessionRestoredData }

