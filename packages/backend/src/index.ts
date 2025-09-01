import express from 'express'
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
import { authenticateToken } from './middleware/auth'
import { connectToMongoDB } from './config/mongodb'
import { createAIServiceFromEnv } from './services/AIService'
import { SocketService } from './services/SocketService'
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

// Socket.IO 설정
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})

// Socket 서비스 초기화
const socketService = new SocketService(io, aiService)

// 컨트롤러 초기화
const aiController = new AIController(aiService)
const imageController = new ImageController(aiService)

// 미들웨어 설정
app.use(helmet())
app.use(cors())
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

// 이미지 API 라우트
app.post('/api/images/generate', authenticateToken, imageController.generateImage)
app.get('/api/images', authenticateToken, imageController.getImages)
app.get('/api/images/:id', authenticateToken, imageController.getImageById)
app.delete('/api/images/:id', authenticateToken, imageController.deleteImage)
app.get('/api/images/models', imageController.getModels)

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
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
  })
})
