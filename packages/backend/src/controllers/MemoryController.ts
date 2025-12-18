/**
 * 메모리 컨트롤러
 * 장기 기억 관련 API 엔드포인트
 */

import { Request, Response } from 'express'
import { memoryService, summarizationService, ragService } from '../services/memory'
import { SemanticCategory } from '../models/memory/types'
import { logger } from '../utils/logger'

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    email: string
  }
}

export class MemoryController {
  // =====================================================
  // 메모리 설정
  // =====================================================

  /**
   * 캐릭터별 메모리 설정 조회
   */
  getMemoryConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId } = req.params

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      const config = await memoryService.getOrCreateConfig(userId, characterId)
      
      res.json({
        success: true,
        data: config
      })
    } catch (error) {
      logger.error('메모리 설정 조회 실패:', error)
      res.status(500).json({ 
        error: '메모리 설정을 불러오는데 실패했습니다' 
      })
    }
  }

  /**
   * 메모리 용량 증가
   */
  increaseMemoryCapacity = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId } = req.params
      const { additionalSlots } = req.body

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      if (!additionalSlots || additionalSlots < 1) {
        return res.status(400).json({ error: '유효한 슬롯 수를 입력하세요' })
      }

      // TODO: 포인트 차감 로직 추가
      
      const config = await memoryService.increaseMemoryCapacity(
        userId,
        characterId,
        additionalSlots
      )

      res.json({
        success: true,
        data: config,
        message: `메모리 용량이 ${additionalSlots}개 증가했습니다`
      })
    } catch (error) {
      logger.error('메모리 용량 증가 실패:', error)
      res.status(500).json({ error: '메모리 용량 증가에 실패했습니다' })
    }
  }

  // =====================================================
  // 에피소드 메모리
  // =====================================================

  /**
   * 에피소드 메모리 목록 조회
   */
  getEpisodicMemories = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId } = req.params
      const { page, limit, sortBy, sortOrder } = req.query

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      const result = await memoryService.getEpisodicMemories(userId, characterId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sortBy: sortBy as 'importance' | 'createdAt' | 'lastAccessed',
        sortOrder: sortOrder as 'asc' | 'desc'
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('에피소드 메모리 조회 실패:', error)
      res.status(500).json({ error: '메모리를 불러오는데 실패했습니다' })
    }
  }

  /**
   * 에피소드 메모리 수정
   */
  updateEpisodicMemory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { memoryId } = req.params
      const { summary, importance } = req.body

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      const memory = await memoryService.updateEpisodicMemory(memoryId, userId, {
        summary,
        importance
      })

      res.json({
        success: true,
        data: memory,
        message: '메모리가 수정되었습니다'
      })
    } catch (error) {
      logger.error('에피소드 메모리 수정 실패:', error)
      res.status(500).json({ error: '메모리 수정에 실패했습니다' })
    }
  }

  // =====================================================
  // 의미적 메모리
  // =====================================================

  /**
   * 의미적 메모리 목록 조회
   */
  getSemanticMemories = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId } = req.params
      const { category, page, limit } = req.query

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      const result = await memoryService.getSemanticMemories(userId, characterId, {
        category: category as SemanticCategory,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('의미적 메모리 조회 실패:', error)
      res.status(500).json({ error: '메모리를 불러오는데 실패했습니다' })
    }
  }

  /**
   * 의미적 메모리 수동 추가
   */
  createSemanticMemory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId } = req.params
      const { category, key, value, context } = req.body

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      if (!category || !key || !value) {
        return res.status(400).json({ 
          error: 'category, key, value는 필수입니다' 
        })
      }

      const memory = await memoryService.createSemanticMemory(userId, characterId, {
        category,
        key,
        value,
        context,
        importance: 0.8  // 수동 추가는 높은 중요도
      })

      res.json({
        success: true,
        data: memory,
        message: '메모리가 추가되었습니다'
      })
    } catch (error) {
      logger.error('의미적 메모리 생성 실패:', error)
      res.status(500).json({ error: '메모리 추가에 실패했습니다' })
    }
  }

  // =====================================================
  // 메모리 삭제
  // =====================================================

  /**
   * 메모리 삭제
   */
  deleteMemory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { memoryId, type } = req.params

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      if (!['episodic', 'semantic', 'emotional'].includes(type)) {
        return res.status(400).json({ error: '유효하지 않은 메모리 타입입니다' })
      }

      await memoryService.deleteMemory(
        memoryId,
        type as 'episodic' | 'semantic' | 'emotional',
        userId
      )

      res.json({
        success: true,
        message: '메모리가 삭제되었습니다'
      })
    } catch (error) {
      logger.error('메모리 삭제 실패:', error)
      res.status(500).json({ error: '메모리 삭제에 실패했습니다' })
    }
  }

  // =====================================================
  // 요약
  // =====================================================

  /**
   * 컨텍스트 사용량 체크
   */
  checkContextUsage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId, chatId } = req.params
      const { model } = req.query

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      const usage = await summarizationService.checkContextUsage(
        userId,
        characterId,
        chatId,
        model as string
      )

      res.json({
        success: true,
        data: usage
      })
    } catch (error) {
      logger.error('컨텍스트 체크 실패:', error)
      res.status(500).json({ error: '컨텍스트 체크에 실패했습니다' })
    }
  }

  /**
   * 수동 요약 트리거
   */
  triggerSummarization = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId, chatId } = req.params

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      const jobId = await summarizationService.createSummarizationJob(
        userId,
        characterId,
        chatId
      )

      res.json({
        success: true,
        data: { jobId },
        message: '요약 작업이 시작되었습니다'
      })
    } catch (error) {
      logger.error('요약 트리거 실패:', error)
      res.status(500).json({ error: '요약 시작에 실패했습니다' })
    }
  }

  // =====================================================
  // RAG 검색
  // =====================================================

  /**
   * 관련 메모리 검색
   */
  searchMemories = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId } = req.params
      const { query, types, limit, minSimilarity } = req.body

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      if (!query) {
        return res.status(400).json({ error: '검색어를 입력하세요' })
      }

      const results = await ragService.searchRelevantMemories(
        userId,
        characterId,
        query,
        {
          memoryTypes: types,
          limit,
          minSimilarity
        }
      )

      res.json({
        success: true,
        data: {
          results,
          total: results.length
        }
      })
    } catch (error) {
      logger.error('메모리 검색 실패:', error)
      res.status(500).json({ error: '메모리 검색에 실패했습니다' })
    }
  }

  // =====================================================
  // 아카이브 열람
  // =====================================================

  /**
   * 요약 아카이브 열람 (원본 대화 포함)
   */
  getSummaryArchives = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId
      const { characterId } = req.params
      const { page = '1', limit = '20', includeDeleted = 'false' } = req.query

      if (!userId) {
        return res.status(401).json({ error: '인증이 필요합니다' })
      }

      const { MemorySummaryArchiveModel } = await import('../models/memory')
      
      const query: Record<string, unknown> = { userId, characterId }
      if (includeDeleted !== 'true') {
        query.isDeleted = { $ne: true }
      }

      const [archives, total] = await Promise.all([
        MemorySummaryArchiveModel.find(query)
          .sort({ createdAt: -1 })
          .skip((parseInt(page as string) - 1) * parseInt(limit as string))
          .limit(parseInt(limit as string))
          .lean(),
        MemorySummaryArchiveModel.countDocuments(query)
      ])

      res.json({
        success: true,
        data: {
          archives,
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string)
        }
      })
    } catch (error) {
      logger.error('아카이브 조회 실패:', error)
      res.status(500).json({ error: '아카이브를 불러오는데 실패했습니다' })
    }
  }
}

export const memoryController = new MemoryController()



