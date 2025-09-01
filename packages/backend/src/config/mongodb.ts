// MongoDB 연결 설정
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mongoose = require('mongoose')
import { logger } from '../utils/logger'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_chat_platform'

interface MongoConnection {
  isConnected: boolean
}

const connection: MongoConnection = {
  isConnected: false,
}

export async function connectToMongoDB(): Promise<void> {
  if (connection.isConnected) {
    logger.info('MongoDB already connected')
    return
  }

  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      // MongoDB 연결 옵션
      maxPoolSize: 10, // 최대 연결 수
      serverSelectionTimeoutMS: 5000, // 서버 선택 타임아웃
      socketTimeoutMS: 45000, // 소켓 타임아웃
      bufferCommands: false, // 연결 전 버퍼링 비활성화
    })

    connection.isConnected = true
    logger.info(`MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`)

    // 연결 이벤트 리스너
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully')
    })

    mongoose.connection.on('error', (err: Error) => {
      logger.error('MongoDB connection error:', err)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected')
      connection.isConnected = false
    })

    // 프로세스 종료 시 연결 해제
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      logger.info('MongoDB connection closed due to app termination')
      process.exit(0)
    })

  } catch (error) {
    logger.error('MongoDB connection failed:', error)
    throw error
  }
}

export async function disconnectFromMongoDB(): Promise<void> {
  if (connection.isConnected) {
    await mongoose.connection.close()
    connection.isConnected = false
    logger.info('MongoDB disconnected')
  }
}

export function getMongoConnectionStatus(): boolean {
  return connection.isConnected && mongoose.connection.readyState === 1
}

export { mongoose }
