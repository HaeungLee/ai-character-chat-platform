/**
 * AI 사용량 추적 서비스
 * - Provider별 사용량 기록
 * - 비용 계산
 * - 집계 데이터 생성
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { logger } from '../../utils/logger'

// =====================================================
// 타입 정의
// =====================================================

export type AIProvider = 'openai' | 'openrouter' | 'replicate' | 'stability'
export type RequestType = 'chat' | 'chat_stream' | 'image' | 'embedding' | 'summarization'

export interface UsageRecord {
  userId: string
  provider: AIProvider
  model: string
  promptTokens: number
  completionTokens: number
  requestType: RequestType
  characterId?: string
  chatId?: string
  latencyMs?: number
  isSuccess?: boolean
  errorMessage?: string
}

export interface ImageUsageRecord {
  userId: string
  provider: AIProvider
  model: string
  imageCount: number
  characterId?: string
  latencyMs?: number
  isSuccess?: boolean
  errorMessage?: string
}

interface PricingInfo {
  inputPricePerK: number
  outputPricePerK: number
  imagePricePerUnit?: number
}

// =====================================================
// 기본 가격 정책 (DB에 없을 경우 폴백)
// =====================================================

const DEFAULT_PRICING: Record<string, PricingInfo> = {
  // OpenAI
  'openai:gpt-4o': { inputPricePerK: 0.0025, outputPricePerK: 0.01 },
  'openai:gpt-4o-mini': { inputPricePerK: 0.00015, outputPricePerK: 0.0006 },
  'openai:gpt-4-turbo': { inputPricePerK: 0.01, outputPricePerK: 0.03 },
  'openai:gpt-4': { inputPricePerK: 0.03, outputPricePerK: 0.06 },
  'openai:gpt-3.5-turbo': { inputPricePerK: 0.0005, outputPricePerK: 0.0015 },
  'openai:text-embedding-ada-002': { inputPricePerK: 0.0001, outputPricePerK: 0 },
  'openai:text-embedding-3-small': { inputPricePerK: 0.00002, outputPricePerK: 0 },
  'openai:text-embedding-3-large': { inputPricePerK: 0.00013, outputPricePerK: 0 },
  'openai:dall-e-3': { inputPricePerK: 0, outputPricePerK: 0, imagePricePerUnit: 0.04 },
  'openai:dall-e-2': { inputPricePerK: 0, outputPricePerK: 0, imagePricePerUnit: 0.02 },
  
  // OpenRouter - 무료 모델
  'openrouter:meta-llama/llama-3.3-70b-instruct:free': { inputPricePerK: 0, outputPricePerK: 0 },
  'openrouter:google/gemini-2.0-flash-exp:free': { inputPricePerK: 0, outputPricePerK: 0 },
  'openrouter:mistralai/mistral-7b-instruct:free': { inputPricePerK: 0, outputPricePerK: 0 },
  'openrouter:huggingfaceh4/zephyr-7b-beta:free': { inputPricePerK: 0, outputPricePerK: 0 },
  
  // OpenRouter - 유료 모델
  'openrouter:anthropic/claude-3.5-sonnet': { inputPricePerK: 0.003, outputPricePerK: 0.015 },
  'openrouter:anthropic/claude-3-opus': { inputPricePerK: 0.015, outputPricePerK: 0.075 },
  'openrouter:google/gemini-pro-1.5': { inputPricePerK: 0.00125, outputPricePerK: 0.005 },
  'openrouter:openai/gpt-4o': { inputPricePerK: 0.0025, outputPricePerK: 0.01 },
  'openrouter:cognitivecomputations/dolphin-mixtral-8x22b': { inputPricePerK: 0.0009, outputPricePerK: 0.0009 },
  
  // Replicate
  'replicate:sdxl': { inputPricePerK: 0, outputPricePerK: 0, imagePricePerUnit: 0.0023 },
  'replicate:flux': { inputPricePerK: 0, outputPricePerK: 0, imagePricePerUnit: 0.003 },
  
  // Stability AI
  'stability:stable-diffusion-xl': { inputPricePerK: 0, outputPricePerK: 0, imagePricePerUnit: 0.002 },
  'stability:stable-diffusion-3': { inputPricePerK: 0, outputPricePerK: 0, imagePricePerUnit: 0.035 },
}

// =====================================================
// 서비스 구현
// =====================================================

export class UsageTrackingService {
  private prisma: PrismaClient
  private pricingCache: Map<string, PricingInfo> = new Map()
  private cacheLoadedAt: Date | null = null
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5분

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  // =====================================================
  // 사용량 기록
  // =====================================================

  /**
   * 텍스트 생성 사용량 기록
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    try {
      const cost = await this.calculateTokenCost(
        record.provider,
        record.model,
        record.promptTokens,
        record.completionTokens
      )

      await this.prisma.aIUsageLog.create({
        data: {
          userId: record.userId,
          provider: record.provider,
          model: record.model,
          promptTokens: record.promptTokens,
          completionTokens: record.completionTokens,
          totalTokens: record.promptTokens + record.completionTokens,
          costUsd: new Prisma.Decimal(cost),
          requestType: record.requestType,
          characterId: record.characterId,
          chatId: record.chatId,
          latencyMs: record.latencyMs,
          isSuccess: record.isSuccess ?? true,
          errorMessage: record.errorMessage,
        },
      })

      logger.debug(`Usage recorded: ${record.provider}/${record.model} - $${cost.toFixed(6)}`)
    } catch (error) {
      logger.error('Failed to record usage:', error)
      // 사용량 기록 실패는 메인 로직에 영향 주지 않음
    }
  }

  /**
   * 이미지 생성 사용량 기록
   */
  async recordImageUsage(record: ImageUsageRecord): Promise<void> {
    try {
      const cost = await this.calculateImageCost(
        record.provider,
        record.model,
        record.imageCount
      )

      await this.prisma.aIUsageLog.create({
        data: {
          userId: record.userId,
          provider: record.provider,
          model: record.model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: new Prisma.Decimal(cost),
          requestType: 'image',
          characterId: record.characterId,
          latencyMs: record.latencyMs,
          isSuccess: record.isSuccess ?? true,
          errorMessage: record.errorMessage,
        },
      })

      logger.debug(`Image usage recorded: ${record.provider}/${record.model} x${record.imageCount} - $${cost.toFixed(6)}`)
    } catch (error) {
      logger.error('Failed to record image usage:', error)
    }
  }

  // =====================================================
  // 비용 계산
  // =====================================================

  /**
   * 토큰 비용 계산
   */
  async calculateTokenCost(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number
  ): Promise<number> {
    const pricing = await this.getPricing(provider, model)
    
    const inputCost = (promptTokens / 1000) * pricing.inputPricePerK
    const outputCost = (completionTokens / 1000) * pricing.outputPricePerK
    
    return inputCost + outputCost
  }

  /**
   * 이미지 비용 계산
   */
  async calculateImageCost(
    provider: string,
    model: string,
    imageCount: number
  ): Promise<number> {
    const pricing = await this.getPricing(provider, model)
    return (pricing.imagePricePerUnit || 0) * imageCount
  }

  /**
   * 가격 정보 조회 (캐시 + DB + 기본값)
   */
  private async getPricing(provider: string, model: string): Promise<PricingInfo> {
    const key = `${provider}:${model}`
    
    // 캐시 확인
    await this.ensurePricingCache()
    
    if (this.pricingCache.has(key)) {
      return this.pricingCache.get(key)!
    }
    
    // 기본값 폴백
    if (DEFAULT_PRICING[key]) {
      return DEFAULT_PRICING[key]
    }
    
    // 알 수 없는 모델 - 기본 가격 적용
    logger.warn(`Unknown pricing for ${key}, using default`)
    return { inputPricePerK: 0.001, outputPricePerK: 0.002 }
  }

  /**
   * 가격 캐시 로드
   */
  private async ensurePricingCache(): Promise<void> {
    const now = new Date()
    
    if (this.cacheLoadedAt && (now.getTime() - this.cacheLoadedAt.getTime()) < this.CACHE_TTL_MS) {
      return // 캐시 유효
    }

    try {
      const pricings = await this.prisma.aIProviderPricing.findMany({
        where: { isActive: true },
      })

      this.pricingCache.clear()
      for (const pricing of pricings) {
        this.pricingCache.set(`${pricing.provider}:${pricing.model}`, {
          inputPricePerK: Number(pricing.inputPricePerK),
          outputPricePerK: Number(pricing.outputPricePerK),
          imagePricePerUnit: pricing.imagePricePerUnit ? Number(pricing.imagePricePerUnit) : undefined,
        })
      }

      this.cacheLoadedAt = now
    } catch (error) {
      logger.error('Failed to load pricing cache:', error)
    }
  }

  // =====================================================
  // 집계 조회 (대시보드용)
  // =====================================================

  /**
   * 대시보드 통계 조회
   */
  async getDashboardStats(period: 'today' | 'week' | 'month' = 'week') {
    const { startDate, endDate } = this.getPeriodDates(period)

    // 병렬로 여러 쿼리 실행
    const [summary, byProvider, byModel, trend, topUsers] = await Promise.all([
      this.getSummary(startDate, endDate),
      this.getByProvider(startDate, endDate),
      this.getByModel(startDate, endDate),
      this.getTrend(startDate, endDate, period),
      this.getTopUsers(startDate, endDate),
    ])

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary,
      byProvider,
      byModel,
      trend,
      topUsers,
    }
  }

  /**
   * 전체 요약
   */
  private async getSummary(startDate: Date, endDate: Date) {
    const result = await this.prisma.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: {
        totalTokens: true,
        costUsd: true,
      },
    })

    const successCount = await this.prisma.aIUsageLog.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        isSuccess: true,
      },
    })

    const uniqueUsers = await this.prisma.aIUsageLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    })

    return {
      totalRequests: result._count.id || 0,
      successRequests: successCount,
      failedRequests: (result._count.id || 0) - successCount,
      totalTokens: result._sum.totalTokens || 0,
      totalCostUsd: Number(result._sum.costUsd || 0),
      uniqueUsers: uniqueUsers.length,
    }
  }

  /**
   * Provider별 집계
   */
  private async getByProvider(startDate: Date, endDate: Date) {
    const results = await this.prisma.aIUsageLog.groupBy({
      by: ['provider'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: {
        totalTokens: true,
        costUsd: true,
      },
    })

    return results.map(r => ({
      provider: r.provider,
      requests: r._count.id,
      tokens: r._sum.totalTokens || 0,
      costUsd: Number(r._sum.costUsd || 0),
    }))
  }

  /**
   * 모델별 Top N
   */
  private async getByModel(startDate: Date, endDate: Date, limit = 10) {
    const results = await this.prisma.aIUsageLog.groupBy({
      by: ['provider', 'model'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: {
        totalTokens: true,
        costUsd: true,
      },
      orderBy: {
        _count: { id: 'desc' },
      },
      take: limit,
    })

    return results.map(r => ({
      provider: r.provider,
      model: r.model,
      requests: r._count.id,
      tokens: r._sum.totalTokens || 0,
      costUsd: Number(r._sum.costUsd || 0),
    }))
  }

  /**
   * 시간별 트렌드
   */
  private async getTrend(startDate: Date, endDate: Date, period: string) {
    // 일별 집계
    const logs = await this.prisma.aIUsageLog.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        createdAt: true,
        totalTokens: true,
        costUsd: true,
        isSuccess: true,
      },
    })

    // 날짜별로 그룹화
    const dailyMap = new Map<string, { requests: number; tokens: number; cost: number }>()
    
    for (const log of logs) {
      const dateKey = log.createdAt.toISOString().split('T')[0]
      const existing = dailyMap.get(dateKey) || { requests: 0, tokens: 0, cost: 0 }
      
      dailyMap.set(dateKey, {
        requests: existing.requests + 1,
        tokens: existing.tokens + log.totalTokens,
        cost: existing.cost + Number(log.costUsd),
      })
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Top 사용자
   */
  private async getTopUsers(startDate: Date, endDate: Date, limit = 10) {
    const results = await this.prisma.aIUsageLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: {
        totalTokens: true,
        costUsd: true,
      },
      orderBy: {
        _sum: { costUsd: 'desc' },
      },
      take: limit,
    })

    // 사용자 정보 조회
    const userIds = results.map(r => r.userId)
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, username: true },
    })

    const userMap = new Map(users.map(u => [u.id, u]))

    return results.map(r => ({
      userId: r.userId,
      email: userMap.get(r.userId)?.email || 'Unknown',
      username: userMap.get(r.userId)?.username,
      requests: r._count.id,
      tokens: r._sum.totalTokens || 0,
      costUsd: Number(r._sum.costUsd || 0),
    }))
  }

  /**
   * 사용자별 사용량 조회
   */
  async getUserUsage(userId: string, period: 'today' | 'week' | 'month' = 'month') {
    const { startDate, endDate } = this.getPeriodDates(period)

    const result = await this.prisma.aIUsageLog.aggregate({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: {
        totalTokens: true,
        costUsd: true,
      },
    })

    const byProvider = await this.prisma.aIUsageLog.groupBy({
      by: ['provider'],
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: {
        totalTokens: true,
        costUsd: true,
      },
    })

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalRequests: result._count.id || 0,
      totalTokens: result._sum.totalTokens || 0,
      totalCostUsd: Number(result._sum.costUsd || 0),
      byProvider: byProvider.map(r => ({
        provider: r.provider,
        requests: r._count.id,
        tokens: r._sum.totalTokens || 0,
        costUsd: Number(r._sum.costUsd || 0),
      })),
    }
  }

  // =====================================================
  // 유틸리티
  // =====================================================

  private getPeriodDates(period: 'today' | 'week' | 'month'): { startDate: Date; endDate: Date } {
    const endDate = new Date()
    let startDate: Date

    switch (period) {
      case 'today':
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        startDate = new Date()
        startDate.setMonth(startDate.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
        break
    }

    return { startDate, endDate }
  }

  /**
   * 가격 정보 업데이트 (관리자용)
   */
  async updatePricing(
    provider: string,
    model: string,
    pricing: Partial<PricingInfo> & { displayName?: string }
  ) {
    await this.prisma.aIProviderPricing.upsert({
      where: {
        provider_model: { provider, model },
      },
      create: {
        provider,
        model,
        displayName: pricing.displayName,
        inputPricePerK: new Prisma.Decimal(pricing.inputPricePerK || 0),
        outputPricePerK: new Prisma.Decimal(pricing.outputPricePerK || 0),
        imagePricePerUnit: pricing.imagePricePerUnit 
          ? new Prisma.Decimal(pricing.imagePricePerUnit) 
          : null,
      },
      update: {
        displayName: pricing.displayName,
        inputPricePerK: pricing.inputPricePerK !== undefined 
          ? new Prisma.Decimal(pricing.inputPricePerK) 
          : undefined,
        outputPricePerK: pricing.outputPricePerK !== undefined 
          ? new Prisma.Decimal(pricing.outputPricePerK) 
          : undefined,
        imagePricePerUnit: pricing.imagePricePerUnit !== undefined
          ? (pricing.imagePricePerUnit ? new Prisma.Decimal(pricing.imagePricePerUnit) : null)
          : undefined,
      },
    })

    // 캐시 무효화
    this.cacheLoadedAt = null
  }

  /**
   * 모든 가격 정보 조회
   */
  async getAllPricing() {
    const dbPricing = await this.prisma.aIProviderPricing.findMany({
      orderBy: [{ provider: 'asc' }, { model: 'asc' }],
    })

    // DB 가격 + 기본 가격 병합
    const result: Array<{
      provider: string
      model: string
      displayName?: string
      inputPricePerK: number
      outputPricePerK: number
      imagePricePerUnit?: number
      source: 'db' | 'default'
    }> = []

    // DB 가격
    for (const p of dbPricing) {
      result.push({
        provider: p.provider,
        model: p.model,
        displayName: p.displayName || undefined,
        inputPricePerK: Number(p.inputPricePerK),
        outputPricePerK: Number(p.outputPricePerK),
        imagePricePerUnit: p.imagePricePerUnit ? Number(p.imagePricePerUnit) : undefined,
        source: 'db',
      })
    }

    // 기본 가격 (DB에 없는 것만)
    for (const [key, pricing] of Object.entries(DEFAULT_PRICING)) {
      const [provider, model] = key.split(':')
      const exists = result.some(r => r.provider === provider && r.model === model)
      
      if (!exists) {
        result.push({
          provider,
          model,
          ...pricing,
          source: 'default',
        })
      }
    }

    return result
  }
}

// 싱글톤 인스턴스 (나중에 초기화)
let usageTrackingService: UsageTrackingService | null = null

export function getUsageTrackingService(prisma: PrismaClient): UsageTrackingService {
  if (!usageTrackingService) {
    usageTrackingService = new UsageTrackingService(prisma)
  }
  return usageTrackingService
}

export { UsageTrackingService as default }


