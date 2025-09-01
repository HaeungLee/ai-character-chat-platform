import { PrismaClient } from '@prisma/client'
import { MongoClient } from 'mongodb'
import Redis from 'ioredis'

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
})

export const mongoClient = new MongoClient(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_chat_platform'
)

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0'),
})

// 연결 관리
export const connectDatabases = async () => {
  try {
    await mongoClient.connect()
    console.log('✅ MongoDB connected')

    await redis.ping()
    console.log('✅ Redis connected')

    console.log('✅ All databases connected')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
}

export const disconnectDatabases = async () => {
  try {
    await mongoClient.close()
    await redis.quit()
    await prisma.$disconnect()
    console.log('✅ All databases disconnected')
  } catch (error) {
    console.error('❌ Database disconnection error:', error)
  }
}
