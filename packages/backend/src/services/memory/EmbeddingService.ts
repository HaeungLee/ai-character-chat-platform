/**
 * 임베딩 서비스
 * OpenAI API를 사용하여 텍스트를 벡터로 변환
 */

import OpenAI from 'openai'
import { prisma } from '../../config/database'
import { EmbeddingCacheModel } from '../../models/memory'
import { logger } from '../../utils/logger'
import crypto from 'crypto'

const EMBEDDING_MODEL = 'text-embedding-ada-002'
const EMBEDDING_DIMENSIONS = 1536

export interface EmbeddingResult {
  embedding: number[]
  tokensUsed: number
}

export class EmbeddingService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  /**
   * 텍스트를 임베딩 벡터로 변환
   */
  async createEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.trim()
      })

      return {
        embedding: response.data[0].embedding,
        tokensUsed: response.usage.total_tokens
      }
    } catch (error) {
      logger.error('임베딩 생성 실패:', error)
      throw new Error('임베딩 생성에 실패했습니다')
    }
  }

  /**
   * 여러 텍스트를 배치로 임베딩
   */
  async createBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts.map(t => t.trim())
      })

      const tokensPerItem = Math.ceil(response.usage.total_tokens / texts.length)

      return response.data.map(item => ({
        embedding: item.embedding,
        tokensUsed: tokensPerItem
      }))
    } catch (error) {
      logger.error('배치 임베딩 생성 실패:', error)
      throw new Error('배치 임베딩 생성에 실패했습니다')
    }
  }

  /**
   * 메모리 임베딩 저장 (PostgreSQL pgvector)
   */
  async saveMemoryEmbedding(
    memoryId: string,
    memoryType: 'episodic' | 'semantic' | 'emotional',
    text: string
  ): Promise<string> {
    const textHash = this.hashText(text)
    
    // 캐시 확인
    const cached = await EmbeddingCacheModel.findOne({ textHash })
    if (cached?.pgEmbeddingId) {
      return cached.pgEmbeddingId
    }

    // 임베딩 생성
    const { embedding } = await this.createEmbedding(text)

    // PostgreSQL에 벡터 저장 (Raw SQL 사용)
    const vectorStr = `[${embedding.join(',')}]`
    
    const result = await prisma.$executeRaw`
      INSERT INTO memory_embeddings (id, memory_id, memory_type, embedding, text, created_at)
      VALUES (
        gen_random_uuid()::text,
        ${memoryId},
        ${memoryType},
        ${vectorStr}::vector,
        ${text},
        NOW()
      )
      RETURNING id
    `

    // embeddingId 조회
    const embeddingRecord = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM memory_embeddings 
      WHERE memory_id = ${memoryId} 
      ORDER BY created_at DESC 
      LIMIT 1
    `
    
    const embeddingId = embeddingRecord[0]?.id

    // MongoDB 캐시 저장
    await EmbeddingCacheModel.findOneAndUpdate(
      { memoryId },
      {
        memoryId,
        memoryType,
        text,
        textHash,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        pgEmbeddingId: embeddingId,
        isSynced: true,
        syncedAt: new Date()
      },
      { upsert: true }
    )

    return embeddingId || memoryId
  }

  /**
   * 유사 메모리 검색 (pgvector cosine similarity)
   */
  async searchSimilarMemories(
    queryText: string,
    configId: string,
    options: {
      memoryTypes?: ('episodic' | 'semantic' | 'emotional')[]
      limit?: number
      minSimilarity?: number
    } = {}
  ): Promise<Array<{ memoryId: string; memoryType: string; similarity: number }>> {
    const { 
      memoryTypes = ['episodic', 'semantic', 'emotional'],
      limit = 10,
      minSimilarity = 0.7
    } = options

    // 쿼리 텍스트 임베딩
    const { embedding } = await this.createEmbedding(queryText)
    const vectorStr = `[${embedding.join(',')}]`

    // pgvector 유사도 검색
    const results = await prisma.$queryRaw<Array<{
      memory_id: string
      memory_type: string
      similarity: number
    }>>`
      SELECT 
        me.memory_id,
        me.memory_type,
        1 - (me.embedding <=> ${vectorStr}::vector) as similarity
      FROM memory_embeddings me
      JOIN episodic_memories em ON me.memory_id = em.id AND me.memory_type = 'episodic'
      JOIN character_memory_configs cmc ON em.config_id = cmc.id
      WHERE cmc.id = ${configId}
        AND me.memory_type = ANY(${memoryTypes})
        AND 1 - (me.embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
      
      UNION ALL
      
      SELECT 
        me.memory_id,
        me.memory_type,
        1 - (me.embedding <=> ${vectorStr}::vector) as similarity
      FROM memory_embeddings me
      JOIN semantic_memories sm ON me.memory_id = sm.id AND me.memory_type = 'semantic'
      JOIN character_memory_configs cmc ON sm.config_id = cmc.id
      WHERE cmc.id = ${configId}
        AND me.memory_type = ANY(${memoryTypes})
        AND 1 - (me.embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
      
      UNION ALL
      
      SELECT 
        me.memory_id,
        me.memory_type,
        1 - (me.embedding <=> ${vectorStr}::vector) as similarity
      FROM memory_embeddings me
      JOIN emotional_memories emo ON me.memory_id = emo.id AND me.memory_type = 'emotional'
      JOIN character_memory_configs cmc ON emo.config_id = cmc.id
      WHERE cmc.id = ${configId}
        AND me.memory_type = ANY(${memoryTypes})
        AND 1 - (me.embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
      
      ORDER BY similarity DESC
      LIMIT ${limit}
    `

    return results.map(r => ({
      memoryId: r.memory_id,
      memoryType: r.memory_type,
      similarity: r.similarity
    }))
  }

  /**
   * 임베딩 삭제
   */
  async deleteEmbedding(memoryId: string): Promise<void> {
    // PostgreSQL에서 삭제
    await prisma.$executeRaw`
      DELETE FROM memory_embeddings WHERE memory_id = ${memoryId}
    `

    // MongoDB 캐시 삭제
    await EmbeddingCacheModel.deleteOne({ memoryId })
  }

  /**
   * 텍스트 해시 생성
   */
  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex')
  }
}

export const embeddingService = new EmbeddingService()

