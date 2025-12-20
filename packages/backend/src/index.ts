import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { AuthController } from './controllers/AuthController'
import { AIController } from './controllers/AIController'
import { ImageController } from './controllers/ImageController'
import { AdminController } from './controllers/AdminController'
import { memoryController } from './controllers/MemoryController'
import { startMemoryCleanupJob } from './jobs/memoryCleanup'
import { authenticateToken, requireAdmin } from './middleware/auth'
import { connectToMongoDB } from './config/mongodb'
import { createAIServiceFromEnv } from './services/AIService'
import { SocketService } from './services/SocketService'
import { getUsageTrackingService } from './services/billing'
import { prisma } from './config/database'
import { logger } from './utils/logger'

// 환경 변수 로드
dotenv.config()

// 데이터베이스 연결
connectToMongoDB().catch((error) => {
  logger.error('Failed to connect to MongoDB:', error)
  process.exit(1)
})

// AI 서비스 초기화
const aiService = createAIServiceFromEnv()

// Express 앱 생성
const app = express()
const server = createServer(app)

// CORS 설정 (개발 환경에서 모든 로컬 네트워크 허용)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000']

// 개발 환경에서는 로컬 네트워크 모든 IP 허용
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // origin이 없는 경우 (같은 도메인 요청) 허용
    if (!origin) return callback(null, true)

    // 허용된 origin 목록에 있는 경우
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    // 개발 환경에서 로컬 네트워크 IP 허용 (192.168.x.x, 10.x.x.x 등)
    if (process.env.NODE_ENV !== 'production') {
      const isLocalNetwork = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
      if (isLocalNetwork) {
        return callback(null, true)
      }
    }

    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}

// Socket.IO 설정
const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    credentials: true,
  },
})

// Socket 서비스 초기화
const socketService = new SocketService(io, aiService)

// 컨트롤러 초기화
const aiController = new AIController(aiService)
const imageController = new ImageController(aiService)
const adminController = new AdminController(prisma)

// UsageTracker를 AIService에 주입
const usageTracker = getUsageTrackingService(prisma)
aiService.setUsageTracker(usageTracker)

// 미들웨어 설정
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))
app.use(cors(corsOptions))
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15분
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // IP당 최대 요청 수
  message: {
    success: false,
    message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
  },
})
app.use('/api/', limiter)

// 인증 라우트 (rate limit 적용 안함)
app.post('/api/auth/register', AuthController.validateRegister, AuthController.register)
app.post('/api/auth/login', AuthController.validateLogin, AuthController.login)
app.post('/api/auth/refresh', AuthController.refreshToken)

// 보호된 인증 라우트
app.get('/api/auth/profile', authenticateToken, AuthController.getProfile)
app.put('/api/auth/profile', authenticateToken, AuthController.updateProfile)
app.put('/api/auth/password', authenticateToken, AuthController.changePassword)
app.post('/api/auth/logout', authenticateToken, AuthController.logout)
app.get('/api/auth/verify', authenticateToken, AuthController.verifyToken)

// AI API 라우트
app.post('/api/ai/chat', authenticateToken, aiController.generateCharacterResponse)
app.post('/api/ai/generate', authenticateToken, aiController.generateChatResponse)
app.get('/api/ai/status', aiController.getServiceStatus)

// 🆕 AI 스트리밍 라우트 (SSE - Server-Sent Events)
app.post('/api/ai/chat/stream', authenticateToken, aiController.generateCharacterResponseStream)
app.post('/api/ai/generate/stream', authenticateToken, aiController.generateChatResponseStream)

// 🆕 프로바이더 지정 AI 라우트 (OpenRouter 포함)
app.post('/api/ai/chat/provider', authenticateToken, aiController.generateChatWithProvider)
app.post('/api/ai/chat/provider/stream', authenticateToken, aiController.generateChatStreamWithProvider)

// 이미지 API 라우트
app.post('/api/images/generate', authenticateToken, imageController.generateImage)
app.get('/api/images', authenticateToken, imageController.getImages)
app.get('/api/images/:id', authenticateToken, imageController.getImageById)
app.delete('/api/images/:id', authenticateToken, imageController.deleteImage)
app.get('/api/images/models', imageController.getModels)

// 🆕 메모리 API 라우트 (장기 기억 시스템)
// 메모리 설정
app.get('/api/memory/:characterId/config', authenticateToken, memoryController.getMemoryConfig)
app.post('/api/memory/:characterId/capacity', authenticateToken, memoryController.increaseMemoryCapacity)

// 에피소드 메모리
app.get('/api/memory/:characterId/episodic', authenticateToken, memoryController.getEpisodicMemories)
app.put('/api/memory/:characterId/episodic/:memoryId', authenticateToken, memoryController.updateEpisodicMemory)

// 의미적 메모리
app.get('/api/memory/:characterId/semantic', authenticateToken, memoryController.getSemanticMemories)
app.post('/api/memory/:characterId/semantic', authenticateToken, memoryController.createSemanticMemory)

// 메모리 삭제
app.delete('/api/memory/:characterId/:type/:memoryId', authenticateToken, memoryController.deleteMemory)

// 요약
app.get('/api/memory/:characterId/chat/:chatId/context', authenticateToken, memoryController.checkContextUsage)
app.post('/api/memory/:characterId/chat/:chatId/summarize', authenticateToken, memoryController.triggerSummarization)

// RAG 검색
app.post('/api/memory/:characterId/search', authenticateToken, memoryController.searchMemories)

// 아카이브 열람
app.get('/api/memory/:characterId/archives', authenticateToken, memoryController.getSummaryArchives)

// 🆕 관리자 API 라우트
// 대시보드
app.get('/api/admin/dashboard/usage', authenticateToken, requireAdmin, adminController.getDashboardStats)
app.get('/api/admin/users/:userId/usage', authenticateToken, requireAdmin, adminController.getUserUsage)
app.get('/api/admin/usage/logs', authenticateToken, requireAdmin, adminController.getUsageLogs)

// 가격 정책
app.get('/api/admin/pricing', authenticateToken, requireAdmin, adminController.getAllPricing)
app.put('/api/admin/pricing/:provider/:model', authenticateToken, requireAdmin, adminController.updatePricing)

// 시스템 상태
app.get('/api/admin/system/status', authenticateToken, requireAdmin, adminController.getSystemStatus)
app.get('/api/admin/providers/status', authenticateToken, requireAdmin, adminController.getProvidersStatus)

// 기본 라우트
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      ai: aiService.getServiceStatus(),
      database: 'connected', // 실제로는 연결 상태 확인
      socket: 'active',
    },
  })
})

app.get('/', (req, res) => {
  res.json({
    message: 'AI Character Chat Platform API',
    version: '1.0.0',
    docs: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      ai: '/api/ai',
      images: '/api/images',
      chat: '/api/chat',
    },
  })
})

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
  })
})

// 서버 시작
const PORT = process.env.PORT || 8000

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`)
  
  // 메모리 정리 크론 작업 시작
  startMemoryCleanupJob()
  console.log(`🧠 Memory cleanup job scheduled`)
})

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...')

  server.close(async () => {
    console.log('✅ HTTP server closed')

    // Close database connections
    try {
      await prisma.$disconnect()
      console.log('✅ Prisma disconnected')
    } catch (error) {
      console.error('❌ Error disconnecting Prisma:', error)
    }

    try {
      await mongoose.connection.close()
      console.log('✅ MongoDB disconnected')
    } catch (error) {
      console.error('❌ Error disconnecting MongoDB:', error)
    }

    try {
      redis.disconnect()
      console.log('✅ Redis disconnected')
    } catch (error) {
      console.error('❌ Error disconnecting Redis:', error)
    }

    console.log('👋 Process terminated')
    process.exit(0)
  })

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)  // Ctrl+C
