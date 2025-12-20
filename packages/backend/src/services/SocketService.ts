// Socket.IO 서비스
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { AIService } from './AIService'
import { memoryIntegration } from './memory'
import { ChatMessageModel } from '../models/memory'
import { logger } from '../utils/logger'

// =====================================================
// 타입 정의
// =====================================================

interface ConnectedUser {
  id: string
  socketId: string
  roomId?: string
  characterId?: string
  lastActivity: Date
  connectedAt: Date
}

interface ChatRoom {
  id: string
  users: string[]
  characterId?: string
  createdAt: Date
  lastActivity: Date
}

// 메시지 ACK 응답
interface MessageAck {
  success: boolean
  messageId?: string
  timestamp?: string
  error?: string
}

// 재연결 시 클라이언트가 보내는 데이터
interface ReconnectionData {
  lastMessageId?: string
  roomId?: string
  characterId?: string
}

// 설정
const SESSION_TIMEOUT_MS = 5 * 60 * 1000  // 5분
const ACK_TIMEOUT_MS = 5000               // ACK 대기 5초
const MAX_RETRY_COUNT = 2                 // 최대 재시도 2회

export class SocketService {
  private io: Server
  private aiService: AIService
  private connectedUsers: Map<string, ConnectedUser> = new Map()
  private chatRooms: Map<string, ChatRoom> = new Map()
  
  // 사용자별 이전 세션 정보 (재연결용)
  private userSessions: Map<string, {
    roomId?: string
    characterId?: string
    disconnectedAt: Date
  }> = new Map()

  constructor(io: Server, aiService: AIService) {
    this.io = io
    this.aiService = aiService
    this.setupSocketHandlers()
    this.startSessionCleanup()
  }

  /**
   * 세션 타임아웃 정리 작업 (5분마다)
   */
  private startSessionCleanup() {
    setInterval(() => {
      const now = Date.now()
      
      // 만료된 세션 정리
      for (const [userId, session] of this.userSessions.entries()) {
        if (now - session.disconnectedAt.getTime() > SESSION_TIMEOUT_MS) {
          this.userSessions.delete(userId)
          logger.debug(`세션 만료 정리: ${userId}`)
        }
      }
    }, 60000) // 1분마다 체크
  }

  // Socket 이벤트 핸들러 설정
  private setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        // JWT 토큰 검증
        const token = socket.handshake.auth.token
        if (!token) {
          return next(new Error('Authentication error'))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
        socket.data.user = decoded
        next()
      } catch (error) {
        logger.error('Socket authentication failed:', error)
        next(new Error('Authentication error'))
      }
    })

    this.io.on('connection', (socket) => {
      this.handleConnection(socket)
    })
  }

  // 연결 처리
  private handleConnection(socket: Socket) {
    const userId = socket.data.user.userId || socket.data.user.id
    const userName = socket.data.user.email

    // 🆕 동일 사용자 중복 연결 방지
    const existingConnection = this.connectedUsers.get(userId)
    if (existingConnection) {
      // 기존 연결 강제 종료
      const existingSocket = this.io.sockets.sockets.get(existingConnection.socketId)
      if (existingSocket) {
        existingSocket.emit('connection:replaced', {
          message: '다른 기기에서 로그인하여 연결이 종료되었습니다.',
          timestamp: new Date().toISOString()
        })
        existingSocket.disconnect(true)
        logger.info(`기존 연결 종료: ${userId} (${existingConnection.socketId})`)
      }
    }

    logger.info(`User connected: ${userId} (${userName})`)

    // 사용자 연결 정보 저장
    this.connectedUsers.set(userId, {
      id: userId,
      socketId: socket.id,
      lastActivity: new Date(),
      connectedAt: new Date()
    })

    // 🆕 재연결 정보 확인 및 전송
    const previousSession = this.userSessions.get(userId)
    if (previousSession) {
      socket.emit('session:restored', {
        previousRoomId: previousSession.roomId,
        previousCharacterId: previousSession.characterId,
        disconnectedAt: previousSession.disconnectedAt.toISOString(),
        canReconnect: Date.now() - previousSession.disconnectedAt.getTime() < SESSION_TIMEOUT_MS
      })
      
      // 세션 정보 삭제 (복구됨)
      this.userSessions.delete(userId)
    }

    // 연결 이벤트 브로드캐스트
    socket.broadcast.emit('user:connected', {
      userId,
      timestamp: new Date().toISOString(),
    })

    // 이벤트 핸들러 등록
    this.setupEventHandlers(socket)

    // 연결 해제 처리
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, userId, reason)
    })
  }

  // 이벤트 핸들러 설정
  private setupEventHandlers(socket: Socket) {
    const userId = socket.data.user.id

    // 방 참여
    socket.on('room:join', (data) => {
      this.handleRoomJoin(socket, userId, data)
    })

    // 방 나가기
    socket.on('room:leave', (data) => {
      this.handleRoomLeave(socket, userId, data)
    })

    // 🆕 메시지 전송 (ACK 콜백 지원)
    socket.on('message:send', (data, callback) => {
      this.handleMessageSendWithAck(socket, userId, data, callback)
    })

    // 🆕 스트리밍 메시지 전송 (ACK 콜백 지원)
    socket.on('message:send:stream', (data, callback) => {
      this.handleMessageSendStreamWithAck(socket, userId, data, callback)
    })

    // 🆕 재연결 시 방 재참여
    socket.on('room:rejoin', (data) => {
      this.handleRoomRejoin(socket, userId, data)
    })

    // 🆕 하트비트 (연결 상태 확인)
    socket.on('heartbeat', () => {
      this.handleHeartbeat(socket, userId)
    })

    // 🆕 메시지 히스토리 요청
    socket.on('messages:history', (data, callback) => {
      this.handleMessagesHistory(socket, userId, data, callback)
    })

    // 타이핑 시작
    socket.on('typing:start', (data) => {
      this.handleTypingStart(socket, userId, data)
    })

    // 타이핑 종료
    socket.on('typing:stop', (data) => {
      this.handleTypingStop(socket, userId, data)
    })

    // 상태 업데이트
    socket.on('status:update', (data) => {
      this.handleStatusUpdate(socket, userId, data)
    })
  }

  // 방 참여 처리
  private handleRoomJoin(socket: Socket, userId: string, data: any) {
    try {
      const { roomId, characterId } = data

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' })
        return
      }

      // 방 정보 가져오기 또는 생성
      let room = this.chatRooms.get(roomId)
      if (!room) {
        room = {
          id: roomId,
          users: [],
          createdAt: new Date(),
          lastActivity: new Date(),
        }
        this.chatRooms.set(roomId, room)
      }

      // 사용자를 방에 추가
      if (!room.users.includes(userId)) {
        room.users.push(userId)
      }

      // Socket.IO 방 참여
      socket.join(roomId)

      // 사용자 연결 정보 업데이트
      const userConnection = this.connectedUsers.get(userId)
      if (userConnection) {
        userConnection.roomId = roomId
        userConnection.lastActivity = new Date()
      }

      room.lastActivity = new Date()

      // 참여 성공 이벤트
      socket.emit('room:joined', {
        roomId,
        users: room.users,
        characterId,
        timestamp: new Date().toISOString(),
      })

      // 다른 사용자들에게 참여 알림
      socket.to(roomId).emit('user:joined', {
        userId,
        roomId,
        timestamp: new Date().toISOString(),
      })

      logger.info(`User ${userId} joined room ${roomId}`)

    } catch (error) {
      logger.error('Room join error:', error)
      socket.emit('error', { message: 'Failed to join room' })
    }
  }

  // 방 나가기 처리
  private handleRoomLeave(socket: Socket, userId: string, data: any) {
    try {
      const { roomId } = data

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' })
        return
      }

      const room = this.chatRooms.get(roomId)
      if (room) {
        // 사용자를 방에서 제거
        room.users = room.users.filter(id => id !== userId)

        // Socket.IO 방 나가기
        socket.leave(roomId)

        // 사용자 연결 정보 업데이트
        const userConnection = this.connectedUsers.get(userId)
        if (userConnection) {
          userConnection.roomId = undefined
        }

        // 나가기 이벤트
        socket.emit('room:left', {
          roomId,
          timestamp: new Date().toISOString(),
        })

        // 다른 사용자들에게 나가기 알림
        socket.to(roomId).emit('user:left', {
          userId,
          roomId,
          timestamp: new Date().toISOString(),
        })

        // 방이 비었으면 정리
        if (room.users.length === 0) {
          this.chatRooms.delete(roomId)
        }
      }

      logger.info(`User ${userId} left room ${roomId}`)

    } catch (error) {
      logger.error('Room leave error:', error)
      socket.emit('error', { message: 'Failed to leave room' })
    }
  }

  // 메시지 전송 처리
  private async handleMessageSend(socket: Socket, userId: string, data: any) {
    try {
      const { content, characterId, roomId } = data

      if (!content || !roomId) {
        socket.emit('error', { message: 'Content and roomId are required' })
        return
      }

      const userConnection = this.connectedUsers.get(userId)
      if (!userConnection || userConnection.roomId !== roomId) {
        socket.emit('error', { message: 'Not in the specified room' })
        return
      }

      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        senderId: userId,
        characterId,
        role: 'user',
        timestamp: new Date().toISOString(),
        roomId,
      }

      // 방의 모든 사용자에게 메시지 전송
      this.io.to(roomId).emit('message', message)

      logger.info(`Message sent by ${userId} in room ${roomId}`)

      // AI 캐릭터 응답 생성 (캐릭터가 지정된 경우)
      if (characterId) {
        try {
          const character = await this.getCharacterById(characterId)
          if (character) {
            const aiResponse = await this.aiService.generateCharacterResponse(
              character,
              content,
              [] // 대화 기록은 실제로는 DB에서 가져와야 함
            )

            const aiMessage = {
              id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              content: aiResponse,
              senderId: 'system',
              characterId,
              role: 'assistant',
              timestamp: new Date().toISOString(),
              roomId,
            }

            // AI 응답 전송
            this.io.to(roomId).emit('message', aiMessage)

            logger.info(`AI response sent for character ${characterId} in room ${roomId}`)
          }
        } catch (error) {
          logger.error('AI response generation failed:', error)

          // AI 응답 실패 메시지
          const errorMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: '죄송합니다. 지금은 응답을 생성할 수 없습니다.',
            senderId: 'system',
            characterId,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            roomId,
            isError: true,
          }

          this.io.to(roomId).emit('message', errorMessage)
        }
      }

    } catch (error) {
      logger.error('Message send error:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  }

  // 🆕 스트리밍 메시지 전송 처리 (타자기 효과)
  private async handleMessageSendStream(socket: Socket, userId: string, data: any) {
    try {
      const { content, characterId, roomId, conversationHistory = [] } = data

      if (!content || !roomId) {
        socket.emit('error', { message: 'Content and roomId are required' })
        return
      }

      const userConnection = this.connectedUsers.get(userId)
      if (!userConnection || userConnection.roomId !== roomId) {
        socket.emit('error', { message: 'Not in the specified room' })
        return
      }

      // 사용자 메시지 전송
      const userMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        senderId: userId,
        characterId,
        role: 'user',
        timestamp: new Date().toISOString(),
        roomId,
      }

      this.io.to(roomId).emit('message', userMessage)
      logger.info(`Message sent by ${userId} in room ${roomId}`)

      // AI 캐릭터 스트리밍 응답 생성
      if (characterId) {
        const character = await this.getCharacterById(characterId)
        if (!character) {
          socket.emit('error', { message: 'Character not found' })
          return
        }

        const aiMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const chatId = roomId // roomId를 chatId로 사용

        // 🆕 사용자 메시지 저장 및 메모리 처리
        try {
          await memoryIntegration.afterMessageProcess(
            {
              id: userMessage.id,
              chatId,
              userId,
              characterId,
              role: 'user',
              content
            },
            character.name
          )
        } catch (memError) {
          logger.warn('사용자 메시지 메모리 처리 실패:', memError)
        }

        // 🆕 RAG 컨텍스트 가져오기 (메모리 기반 시스템 프롬프트 보강)
        let enhancedSystemPrompt = character.systemPrompt
        try {
          const ragResult = await memoryIntegration.beforeMessageProcess(
            userId,
            characterId,
            character.name,
            content,
            character.systemPrompt
          )
          enhancedSystemPrompt = ragResult.systemPrompt
          
          if (ragResult.ragContext.totalTokens > 0) {
            logger.info(`RAG 컨텍스트 주입: ${ragResult.ragContext.totalTokens} 토큰`)
          }
        } catch (ragError) {
          logger.warn('RAG 컨텍스트 가져오기 실패:', ragError)
        }

        // 스트리밍 시작 알림
        this.io.to(roomId).emit('message:stream:start', {
          id: aiMessageId,
          characterId,
          characterName: character.name,
          roomId,
          timestamp: new Date().toISOString(),
        })

        // AI 타이핑 표시
        this.io.to(roomId).emit('typing:start', {
          userId: 'ai',
          characterId,
          roomId,
          timestamp: new Date().toISOString(),
        })

        let fullResponse = ''

        try {
          // 메모리 보강된 캐릭터 객체 생성
          const enhancedCharacter = {
            ...character,
            systemPrompt: enhancedSystemPrompt
          }

          const stream = this.aiService.generateCharacterResponseStream(
            enhancedCharacter,
            content,
            conversationHistory
          )

          for await (const chunk of stream) {
            fullResponse += chunk

            // 각 청크를 실시간으로 전송 (타자기 효과)
            this.io.to(roomId).emit('message:stream:chunk', {
              id: aiMessageId,
              chunk,
              characterId,
              roomId,
              timestamp: new Date().toISOString(),
            })
          }

          // 스트리밍 완료
          this.io.to(roomId).emit('message:stream:end', {
            id: aiMessageId,
            content: fullResponse,
            senderId: 'system',
            characterId,
            characterName: character.name,
            role: 'assistant',
            roomId,
            timestamp: new Date().toISOString(),
            usage: {
              estimatedTokens: Math.ceil(fullResponse.length / 4),
            },
          })

          // 🆕 AI 응답 메모리 저장
          try {
            await memoryIntegration.afterMessageProcess(
              {
                id: aiMessageId,
                chatId,
                userId,
                characterId,
                role: 'assistant',
                content: fullResponse,
                tokens: Math.ceil(fullResponse.length / 3)
              },
              character.name
            )
          } catch (memError) {
            logger.warn('AI 응답 메모리 처리 실패:', memError)
          }

          logger.info(`AI streaming response completed for character ${characterId} in room ${roomId}`)

        } catch (streamError) {
          logger.error('AI streaming response failed:', streamError)

          // 스트리밍 오류 전송
          this.io.to(roomId).emit('message:stream:error', {
            id: aiMessageId,
            characterId,
            roomId,
            error: 'AI 응답 생성 중 오류가 발생했습니다.',
            timestamp: new Date().toISOString(),
          })
        }

        // AI 타이핑 종료
        this.io.to(roomId).emit('typing:stop', {
          userId: 'ai',
          characterId,
          roomId,
          timestamp: new Date().toISOString(),
        })
      }

    } catch (error) {
      logger.error('Streaming message send error:', error)
      socket.emit('error', { message: 'Failed to send streaming message' })
    }
  }

  // =====================================================
  // 🆕 ACK 지원 메시지 핸들러
  // =====================================================

  /**
   * ACK 콜백을 지원하는 메시지 전송 처리
   */
  private async handleMessageSendWithAck(
    socket: Socket, 
    userId: string, 
    data: any,
    callback?: (ack: MessageAck) => void
  ) {
    const messageId = data.clientMessageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timestamp = new Date().toISOString()

    try {
      const { content, characterId, roomId } = data

      if (!content || !roomId) {
        callback?.({ success: false, error: 'Content and roomId are required' })
        return
      }

      const userConnection = this.connectedUsers.get(userId)
      if (!userConnection || userConnection.roomId !== roomId) {
        callback?.({ success: false, error: 'Not in the specified room' })
        return
      }

      // 메시지 저장 (MongoDB)
      try {
        await ChatMessageModel.create({
          chatId: roomId,
          userId,
          characterId,
          role: 'user',
          content,
          metadata: { clientMessageId: data.clientMessageId }
        })
      } catch (dbError) {
        logger.warn('메시지 DB 저장 실패:', dbError)
      }

      const message = {
        id: messageId,
        content,
        senderId: userId,
        characterId,
        role: 'user',
        timestamp,
        roomId,
      }

      // 방의 모든 사용자에게 메시지 전송
      this.io.to(roomId).emit('message', message)

      // ACK 성공 콜백
      callback?.({ 
        success: true, 
        messageId,
        timestamp
      })

      logger.info(`Message sent with ACK: ${messageId} by ${userId}`)

      // AI 응답 생성 (캐릭터가 지정된 경우)
      if (characterId) {
        await this.generateAIResponse(socket, roomId, characterId, content, userId)
      }

    } catch (error) {
      logger.error('Message send error:', error)
      callback?.({ 
        success: false, 
        messageId,
        error: 'Failed to send message' 
      })
    }
  }

  /**
   * ACK 콜백을 지원하는 스트리밍 메시지 전송 처리
   */
  private async handleMessageSendStreamWithAck(
    socket: Socket, 
    userId: string, 
    data: any,
    callback?: (ack: MessageAck) => void
  ) {
    const userMessageId = data.clientMessageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const timestamp = new Date().toISOString()

    try {
      const { content, characterId, roomId, conversationHistory = [] } = data

      if (!content || !roomId) {
        callback?.({ success: false, error: 'Content and roomId are required' })
        return
      }

      const userConnection = this.connectedUsers.get(userId)
      if (!userConnection || userConnection.roomId !== roomId) {
        callback?.({ success: false, error: 'Not in the specified room' })
        return
      }

      // 사용자 메시지 저장 및 전송
      const userMessage = {
        id: userMessageId,
        content,
        senderId: userId,
        characterId,
        role: 'user',
        timestamp,
        roomId,
      }

      this.io.to(roomId).emit('message', userMessage)

      // ACK 성공 콜백 (사용자 메시지에 대한 ACK)
      callback?.({ 
        success: true, 
        messageId: userMessageId,
        timestamp
      })

      logger.info(`Streaming message sent with ACK: ${userMessageId}`)

      // AI 캐릭터 스트리밍 응답 생성
      if (characterId) {
        const character = await this.getCharacterById(characterId)
        if (!character) {
          socket.emit('error', { message: 'Character not found' })
          return
        }

        const chatId = roomId
        const aiMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // 사용자 메시지 메모리 처리
        try {
          await memoryIntegration.afterMessageProcess(
            {
              id: userMessageId,
              chatId,
              userId,
              characterId,
              role: 'user',
              content
            },
            character.name
          )
        } catch (memError) {
          logger.warn('사용자 메시지 메모리 처리 실패:', memError)
        }

        // RAG 컨텍스트 가져오기
        let enhancedSystemPrompt = character.systemPrompt
        try {
          const ragResult = await memoryIntegration.beforeMessageProcess(
            userId,
            characterId,
            character.name,
            content,
            character.systemPrompt
          )
          enhancedSystemPrompt = ragResult.systemPrompt
        } catch (ragError) {
          logger.warn('RAG 컨텍스트 가져오기 실패:', ragError)
        }

        // 스트리밍 시작 알림
        this.io.to(roomId).emit('message:stream:start', {
          id: aiMessageId,
          characterId,
          characterName: character.name,
          roomId,
          timestamp: new Date().toISOString(),
        })

        this.io.to(roomId).emit('typing:start', {
          userId: 'ai',
          characterId,
          roomId,
          timestamp: new Date().toISOString(),
        })

        let fullResponse = ''

        try {
          const enhancedCharacter = {
            ...character,
            systemPrompt: enhancedSystemPrompt
          }

          const stream = this.aiService.generateCharacterResponseStream(
            enhancedCharacter,
            content,
            conversationHistory
          )

          for await (const chunk of stream) {
            fullResponse += chunk
            this.io.to(roomId).emit('message:stream:chunk', {
              id: aiMessageId,
              chunk,
              characterId,
              roomId,
              timestamp: new Date().toISOString(),
            })
          }

          // 스트리밍 완료
          this.io.to(roomId).emit('message:stream:end', {
            id: aiMessageId,
            content: fullResponse,
            senderId: 'system',
            characterId,
            characterName: character.name,
            role: 'assistant',
            roomId,
            timestamp: new Date().toISOString(),
            usage: {
              estimatedTokens: Math.ceil(fullResponse.length / 4),
            },
          })

          // AI 응답 메모리 저장
          try {
            await memoryIntegration.afterMessageProcess(
              {
                id: aiMessageId,
                chatId,
                userId,
                characterId,
                role: 'assistant',
                content: fullResponse,
                tokens: Math.ceil(fullResponse.length / 3)
              },
              character.name
            )
          } catch (memError) {
            logger.warn('AI 응답 메모리 처리 실패:', memError)
          }

          logger.info(`AI streaming completed: ${aiMessageId}`)

        } catch (streamError) {
          logger.error('AI streaming failed:', streamError)
          this.io.to(roomId).emit('message:stream:error', {
            id: aiMessageId,
            characterId,
            roomId,
            error: 'AI 응답 생성 중 오류가 발생했습니다.',
            timestamp: new Date().toISOString(),
          })
        }

        this.io.to(roomId).emit('typing:stop', {
          userId: 'ai',
          characterId,
          roomId,
          timestamp: new Date().toISOString(),
        })
      }

    } catch (error) {
      logger.error('Streaming message send error:', error)
      callback?.({ 
        success: false, 
        messageId: userMessageId,
        error: 'Failed to send streaming message' 
      })
    }
  }

  /**
   * AI 응답 생성 헬퍼
   */
  private async generateAIResponse(
    socket: Socket,
    roomId: string,
    characterId: string,
    userMessage: string,
    userId: string
  ) {
    try {
      const character = await this.getCharacterById(characterId)
      if (character) {
        const aiResponse = await this.aiService.generateCharacterResponse(
          character,
          userMessage,
          []
        )

        const aiMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const aiMessage = {
          id: aiMessageId,
          content: aiResponse,
          senderId: 'system',
          characterId,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          roomId,
        }

        this.io.to(roomId).emit('message', aiMessage)

        // AI 응답 DB 저장
        try {
          await ChatMessageModel.create({
            chatId: roomId,
            userId,
            characterId,
            role: 'assistant',
            content: aiResponse
          })
        } catch (dbError) {
          logger.warn('AI 응답 DB 저장 실패:', dbError)
        }

        logger.info(`AI response sent: ${aiMessageId}`)
      }
    } catch (error) {
      logger.error('AI response generation failed:', error)
      socket.emit('message', {
        id: `msg_${Date.now()}`,
        content: '죄송합니다. 지금은 응답을 생성할 수 없습니다.',
        senderId: 'system',
        characterId,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        roomId,
        isError: true,
      })
    }
  }

  // =====================================================
  // 🆕 재연결 및 히스토리 핸들러
  // =====================================================

  /**
   * 방 재참여 처리 (재연결 시)
   */
  private handleRoomRejoin(socket: Socket, userId: string, data: any) {
    try {
      const { roomId, characterId, lastMessageTimestamp } = data

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' })
        return
      }

      // 방 정보 가져오기 또는 생성
      let room = this.chatRooms.get(roomId)
      if (!room) {
        room = {
          id: roomId,
          users: [],
          characterId,
          createdAt: new Date(),
          lastActivity: new Date(),
        }
        this.chatRooms.set(roomId, room)
      }

      // 사용자를 방에 추가
      if (!room.users.includes(userId)) {
        room.users.push(userId)
      }

      // Socket.IO 방 참여
      socket.join(roomId)

      // 사용자 연결 정보 업데이트
      const userConnection = this.connectedUsers.get(userId)
      if (userConnection) {
        userConnection.roomId = roomId
        userConnection.characterId = characterId
        userConnection.lastActivity = new Date()
      }

      room.lastActivity = new Date()

      // 재참여 성공 이벤트
      socket.emit('room:rejoined', {
        roomId,
        characterId,
        users: room.users,
        timestamp: new Date().toISOString(),
        wasReconnection: true
      })

      // 다른 사용자들에게 재연결 알림
      socket.to(roomId).emit('user:reconnected', {
        userId,
        roomId,
        timestamp: new Date().toISOString(),
      })

      logger.info(`User ${userId} rejoined room ${roomId}`)

    } catch (error) {
      logger.error('Room rejoin error:', error)
      socket.emit('error', { message: 'Failed to rejoin room' })
    }
  }

  /**
   * 하트비트 처리 (연결 상태 확인)
   */
  private handleHeartbeat(socket: Socket, userId: string) {
    const userConnection = this.connectedUsers.get(userId)
    if (userConnection) {
      userConnection.lastActivity = new Date()
    }

    socket.emit('heartbeat:ack', {
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    })
  }

  /**
   * 메시지 히스토리 요청 처리
   */
  private async handleMessagesHistory(
    socket: Socket, 
    userId: string, 
    data: any,
    callback?: (result: any) => void
  ) {
    try {
      const { roomId, limit = 50, beforeTimestamp } = data

      if (!roomId) {
        callback?.({ success: false, error: 'Room ID is required' })
        return
      }

      // MongoDB에서 메시지 조회
      const query: any = { chatId: roomId }
      if (beforeTimestamp) {
        query.createdAt = { $lt: new Date(beforeTimestamp) }
      }

      const messages = await ChatMessageModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()

      // 시간순 정렬 (오래된 순)
      const sortedMessages = messages.reverse().map(msg => ({
        id: msg._id.toString(),
        content: msg.content,
        senderId: msg.role === 'user' ? userId : 'system',
        characterId: msg.characterId,
        role: msg.role,
        timestamp: msg.createdAt.toISOString(),
        roomId: msg.chatId
      }))

      callback?.({
        success: true,
        messages: sortedMessages,
        hasMore: messages.length === limit
      })

      logger.debug(`Messages history loaded: ${sortedMessages.length} messages for room ${roomId}`)

    } catch (error) {
      logger.error('Messages history error:', error)
      callback?.({ success: false, error: 'Failed to load messages' })
    }
  }

  // =====================================================
  // 기존 핸들러 (유지)
  // =====================================================

  // 타이핑 시작 처리
  private handleTypingStart(socket: Socket, userId: string, data: any) {
    try {
      const { roomId } = data

      if (!roomId) return

      // 다른 사용자들에게 타이핑 시작 알림
      socket.to(roomId).emit('typing:start', {
        userId,
        roomId,
        timestamp: new Date().toISOString(),
      })

    } catch (error) {
      logger.error('Typing start error:', error)
    }
  }

  // 타이핑 종료 처리
  private handleTypingStop(socket: Socket, userId: string, data: any) {
    try {
      const { roomId } = data

      if (!roomId) return

      // 다른 사용자들에게 타이핑 종료 알림
      socket.to(roomId).emit('typing:stop', {
        userId,
        roomId,
        timestamp: new Date().toISOString(),
      })

    } catch (error) {
      logger.error('Typing stop error:', error)
    }
  }

  // 상태 업데이트 처리
  private handleStatusUpdate(socket: Socket, userId: string, data: any) {
    try {
      const { status, roomId } = data

      // 방의 다른 사용자들에게 상태 알림
      if (roomId) {
        socket.to(roomId).emit('user:status', {
          userId,
          status,
          timestamp: new Date().toISOString(),
        })
      }

    } catch (error) {
      logger.error('Status update error:', error)
    }
  }

  // 연결 해제 처리
  private handleDisconnection(socket: Socket, userId: string, reason?: string) {
    logger.info(`User disconnected: ${userId}, reason: ${reason || 'unknown'}`)

    // 연결 정보 정리
    const userConnection = this.connectedUsers.get(userId)
    if (userConnection) {
      const { roomId, characterId } = userConnection

      // 🆕 세션 정보 저장 (재연결용) - 강제 종료(replaced)가 아닌 경우만
      if (reason !== 'server namespace disconnect') {
        this.userSessions.set(userId, {
          roomId,
          characterId,
          disconnectedAt: new Date()
        })
        logger.info(`세션 저장: ${userId}, room: ${roomId}`)
      }

      // 방에서 사용자 제거
      if (roomId) {
        const room = this.chatRooms.get(roomId)
        if (room) {
          room.users = room.users.filter(id => id !== userId)

          // 다른 사용자들에게 연결 해제 알림
          socket.to(roomId).emit('user:disconnected', {
            userId,
            roomId,
            timestamp: new Date().toISOString(),
            willReconnect: reason !== 'server namespace disconnect' // 재연결 가능 여부
          })

          // 방이 비었으면 정리 (세션 타임아웃 후에만)
          // 즉시 삭제하지 않고 유지
          if (room.users.length === 0) {
            // 5분 후 삭제 예약
            setTimeout(() => {
              const currentRoom = this.chatRooms.get(roomId)
              if (currentRoom && currentRoom.users.length === 0) {
                this.chatRooms.delete(roomId)
                logger.debug(`빈 방 정리: ${roomId}`)
              }
            }, SESSION_TIMEOUT_MS)
          }
        }
      }

      // 연결 정보 삭제
      this.connectedUsers.delete(userId)
    }
  }

  // 헬퍼 메서드: 캐릭터 정보 조회
  private async getCharacterById(characterId: string) {
    // 실제로는 데이터베이스에서 조회
    // 여기서는 샘플 데이터 반환
    const sampleCharacters = {
      'sample_char_1': {
        id: 'sample_char_1',
        name: '친절한 AI 어시스턴트',
        personality: '항상 친절하고 도움이 되는 AI 어시스턴트입니다.',
        systemPrompt: '당신은 친절하고 도움이 되는 AI 어시스턴트입니다. 사용자의 질문에 최대한 도움이 되는 답변을 제공하세요.',
        temperature: 0.7,
      },
      'sample_char_2': {
        id: 'sample_char_2',
        name: '창의적인 작가',
        personality: '다양한 주제로 창의적인 글을 쓰는 AI 작가입니다.',
        systemPrompt: '당신은 창의적인 작가입니다. 사용자의 요청에 따라 다양한 스타일의 글을 작성하세요.',
        temperature: 0.8,
      },
    }

    return sampleCharacters[characterId as keyof typeof sampleCharacters] || null
  }

  // 연결된 사용자 목록 조회
  getConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values())
  }

  // 채팅방 목록 조회
  getChatRooms(): ChatRoom[] {
    return Array.from(this.chatRooms.values())
  }

  // 특정 사용자의 연결 정보 조회
  getUserConnection(userId: string): ConnectedUser | null {
    return this.connectedUsers.get(userId) || null
  }

  // 특정 방의 정보 조회
  getRoomInfo(roomId: string): ChatRoom | null {
    return this.chatRooms.get(roomId) || null
  }
}
