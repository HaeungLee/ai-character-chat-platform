/**
 * 관리자 대시보드 컨트롤러
 * - AI 사용량 통계
 * - 가격 정책 관리
 * - 시스템 상태
 */

import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { getUsageTrackingService } from '../services/billing'
import { logger } from '../utils/logger'

export class AdminController {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  // =====================================================
  // AI 사용량 대시보드
  // =====================================================

  /**
   * 대시보드 통계 조회
   * GET /api/admin/dashboard/usage
   */
  getDashboardStats = async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as 'today' | 'week' | 'month') || 'week'
      
      const usageTracker = getUsageTrackingService(this.prisma)
      const stats = await usageTracker.getDashboardStats(period)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('대시보드 통계 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '통계 조회에 실패했습니다.'
      })
    }
  }

  /**
   * 특정 사용자 사용량 조회
   * GET /api/admin/users/:userId/usage
   */
  getUserUsage = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const period = (req.query.period as 'today' | 'week' | 'month') || 'month'
      
      const usageTracker = getUsageTrackingService(this.prisma)
      const usage = await usageTracker.getUserUsage(userId, period)

      res.json({
        success: true,
        data: usage
      })
    } catch (error) {
      logger.error('사용자 사용량 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '사용량 조회에 실패했습니다.'
      })
    }
  }

  /**
   * 사용량 로그 조회 (페이지네이션)
   * GET /api/admin/usage/logs
   */
  getUsageLogs = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
      const skip = (page - 1) * limit

      const { provider, userId, startDate, endDate } = req.query

      // 필터 조건
      const where: any = {}
      if (provider) where.provider = provider
      if (userId) where.userId = userId
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = new Date(startDate as string)
        if (endDate) where.createdAt.lte = new Date(endDate as string)
      }

      const [logs, total] = await Promise.all([
        this.prisma.aIUsageLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            user: {
              select: { id: true, email: true, username: true }
            }
          }
        }),
        this.prisma.aIUsageLog.count({ where })
      ])

      res.json({
        success: true,
        data: {
          logs: logs.map(log => ({
            ...log,
            costUsd: Number(log.costUsd)
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      })
    } catch (error) {
      logger.error('사용량 로그 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '로그 조회에 실패했습니다.'
      })
    }
  }

  // =====================================================
  // 가격 정책 관리
  // =====================================================

  /**
   * 모든 가격 정책 조회
   * GET /api/admin/pricing
   */
  getAllPricing = async (req: Request, res: Response) => {
    try {
      const usageTracker = getUsageTrackingService(this.prisma)
      const pricing = await usageTracker.getAllPricing()

      res.json({
        success: true,
        data: pricing
      })
    } catch (error) {
      logger.error('가격 정책 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '가격 정책 조회에 실패했습니다.'
      })
    }
  }

  /**
   * 가격 정책 업데이트
   * PUT /api/admin/pricing/:provider/:model
   */
  updatePricing = async (req: Request, res: Response) => {
    try {
      const { provider, model } = req.params
      const { inputPricePerK, outputPricePerK, imagePricePerUnit, displayName } = req.body

      const usageTracker = getUsageTrackingService(this.prisma)
      await usageTracker.updatePricing(provider, decodeURIComponent(model), {
        inputPricePerK,
        outputPricePerK,
        imagePricePerUnit,
        displayName
      })

      res.json({
        success: true,
        message: '가격 정책이 업데이트되었습니다.'
      })
    } catch (error) {
      logger.error('가격 정책 업데이트 실패:', error)
      res.status(500).json({
        success: false,
        error: '가격 정책 업데이트에 실패했습니다.'
      })
    }
  }

  // =====================================================
  // 시스템 상태
  // =====================================================

  /**
   * 시스템 상태 조회
   * GET /api/admin/system/status
   */
  getSystemStatus = async (req: Request, res: Response) => {
    try {
      // 오늘 통계
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [
        totalUsers,
        activeUsersToday,
        requestsToday,
        costToday
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.aIUsageLog.groupBy({
          by: ['userId'],
          where: { createdAt: { gte: today } }
        }).then(r => r.length),
        this.prisma.aIUsageLog.count({
          where: { createdAt: { gte: today } }
        }),
        this.prisma.aIUsageLog.aggregate({
          where: { createdAt: { gte: today } },
          _sum: { costUsd: true }
        }).then(r => Number(r._sum.costUsd || 0))
      ])

      res.json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            activeToday: activeUsersToday
          },
          usage: {
            requestsToday,
            costToday
          },
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version
          }
        }
      })
    } catch (error) {
      logger.error('시스템 상태 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: '시스템 상태 조회에 실패했습니다.'
      })
    }
  }

  /**
   * Provider별 잔액/상태 조회
   * GET /api/admin/providers/status
   */
  getProvidersStatus = async (req: Request, res: Response) => {
    try {
      // 최근 24시간 성공률 계산
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const stats = await this.prisma.aIUsageLog.groupBy({
        by: ['provider'],
        where: {
          createdAt: { gte: yesterday }
        },
        _count: { id: true },
        _sum: { costUsd: true }
      })

      const successCounts = await this.prisma.aIUsageLog.groupBy({
        by: ['provider'],
        where: {
          createdAt: { gte: yesterday },
          isSuccess: true
        },
        _count: { id: true }
      })

      const successMap = new Map(successCounts.map(s => [s.provider, s._count.id]))

      const providers = stats.map(stat => ({
        provider: stat.provider,
        totalRequests: stat._count.id,
        successRequests: successMap.get(stat.provider) || 0,
        successRate: stat._count.id > 0 
          ? ((successMap.get(stat.provider) || 0) / stat._count.id * 100).toFixed(2)
          : '100.00',
        cost24h: Number(stat._sum.costUsd || 0)
      }))

      res.json({
        success: true,
        data: providers
      })
    } catch (error) {
      logger.error('Provider 상태 조회 실패:', error)
      res.status(500).json({
        success: false,
        error: 'Provider 상태 조회에 실패했습니다.'
      })
    }
  }
}

export default AdminController


