// Socket.IO 서비스
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { AIService } from './AIService'
import { logger } from '../utils/logger'

interface ConnectedUser {
  id: string
  socketId: string
  roomId?: string
  lastActivity: Date
}

interface ChatRoom {
  id: string
  users: string[]
  createdAt: Date
  lastActivity: Date
}

export class SocketService {
  private io: Server
  private aiService: AIService
  private connectedUsers: Map<string, ConnectedUser> = new Map()
  private chatRooms: Map<string, ChatRoom> = new Map()

  constructor(io: Server, aiService: AIService) {
    this.io = io
    this.aiService = aiService
    this.setupSocketHandlers()
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
    const userId = socket.data.user.id
    const userName = socket.data.user.email

    logger.info(`User connected: ${userId} (${userName})`)

    // 사용자 연결 정보 저장
    this.connectedUsers.set(userId, {
      id: userId,
      socketId: socket.id,
      lastActivity: new Date(),
    })

    // 연결 이벤트 브로드캐스트
    socket.broadcast.emit('user:connected', {
      userId,
      timestamp: new Date().toISOString(),
    })

    // 이벤트 핸들러 등록
    this.setupEventHandlers(socket)

    // 연결 해제 처리
    socket.on('disconnect', () => {
      this.handleDisconnection(socket, userId)
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

    // 메시지 전송
    socket.on('message:send', (data) => {
      this.handleMessageSend(socket, userId, data)
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
  private handleDisconnection(socket: Socket, userId: string) {
    logger.info(`User disconnected: ${userId}`)

    // 연결 정보 정리
    const userConnection = this.connectedUsers.get(userId)
    if (userConnection) {
      const { roomId } = userConnection

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
          })

          // 방이 비었으면 정리
          if (room.users.length === 0) {
            this.chatRooms.delete(roomId)
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
