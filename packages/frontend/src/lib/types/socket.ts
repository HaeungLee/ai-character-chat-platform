// WebSocket 관련 타입 정의

// Socket 이벤트 타입들
export type SocketEvent =
  | 'connect'
  | 'disconnect'
  | 'message'
  | 'message:send'
  | 'room:join'
  | 'room:leave'
  | 'room:joined'
  | 'room:left'
  | 'typing:start'
  | 'typing:stop'
  | 'error'
  | 'status'

// Socket 메시지 타입들
export interface SocketMessage {
  id: string
  type: 'message' | 'system' | 'error'
  event: SocketEvent
  data: any
  timestamp: string
  userId?: string
  roomId?: string
}

// 채팅 메시지 이벤트
export interface MessageSendEvent {
  content: string
  characterId?: string
  metadata?: Record<string, any>
}

export interface MessageReceiveEvent {
  id: string
  content: string
  senderId: string
  characterId?: string
  role: 'user' | 'assistant' | 'system'
  timestamp: string
  tokens?: number
  metadata?: Record<string, any>
}

// 타이핑 이벤트
export interface TypingStartEvent {
  userId: string
  roomId: string
}

export interface TypingStopEvent {
  userId: string
  roomId: string
}

// 방 관리 이벤트
export interface RoomJoinEvent {
  roomId: string
}

export interface RoomLeaveEvent {
  roomId: string
}

export interface RoomJoinedEvent {
  roomId: string
  messages?: MessageReceiveEvent[]
  participants?: RoomParticipant[]
}

export interface RoomLeftEvent {
  roomId: string
}

// 참가자 정보
export interface RoomParticipant {
  id: string
  name: string
  avatar?: string
  role: 'user' | 'character'
  isOnline: boolean
  lastSeen?: string
}

// 에러 이벤트
export interface SocketErrorEvent {
  code: string
  message: string
  details?: Record<string, any>
}

// 상태 이벤트
export interface StatusEvent {
  type: 'online' | 'offline' | 'away'
  userId: string
  timestamp: string
}

// Socket 설정 타입들
export interface SocketConfig {
  url: string
  path?: string
  auth?: {
    token?: string
    userId?: string
  }
  options?: {
    transports?: string[]
    timeout?: number
    reconnection?: boolean
    reconnectionDelay?: number
    maxReconnectionAttempts?: number
  }
}

// Socket 연결 상태
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'

// Socket 훅 반환 타입
export interface UseSocketReturn {
  socket: any // Socket.IO client instance
  isConnected: boolean
  connectionState: ConnectionState
  lastError: string | null
  reconnect: () => void
  disconnect: () => void
}

// 채팅 훅 반환 타입
export interface UseChatReturn {
  messages: MessageReceiveEvent[]
  isTyping: boolean
  typingUsers: string[]
  sendMessage: (content: string, characterId?: string) => Promise<void>
  startTyping: () => void
  stopTyping: () => void
  loadMoreMessages: () => Promise<void>
  hasMoreMessages: boolean
  isLoadingMessages: boolean
}

// 방 관리 훅 반환 타입
export interface UseRoomReturn {
  currentRoom: string | null
  participants: RoomParticipant[]
  joinRoom: (roomId: string) => Promise<void>
  leaveRoom: (roomId?: string) => Promise<void>
  createRoom: (characterId: string, title?: string) => Promise<string>
  isJoining: boolean
  isLeaving: boolean
}

// 공통 타입들 (다른 파일에서 import)
interface Message {
  id: string
  chatId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  tokens?: number
  metadata?: Record<string, any>
  createdAt: string
}
