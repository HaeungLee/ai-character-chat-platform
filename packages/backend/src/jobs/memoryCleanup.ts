/**
 * 메모리 정리 크론 작업
 * 비활성 계정 메모리 아카이브 및 만료된 메모리 정리
 */

import cron from 'node-cron'
import { memoryService } from '../services/memory'
import { prisma } from '../config/database'
import { logger } from '../utils/logger'

// 매일 새벽 3시에 실행
const CLEANUP_SCHEDULE = '0 3 * * *'

// 메모리 만료 기반 정리 (중요도 낮은 메모리)
const IMPORTANCE_EXPIRY_DAYS: Record<string, number> = {
  low: 30,      // 중요도 0.0-0.3: 30일
  medium: 60,   // 중요도 0.3-0.6: 60일
  high: 120     // 중요도 0.6-0.8: 120일
  // 중요도 0.8 이상: 만료 없음
}

/**
 * 비활성 계정 메모리 정리
 */
async function cleanupInactiveAccounts(): Promise<number> {
  try {
    const count = await memoryService.cleanupInactiveMemories()
    logger.info(`비활성 계정 메모리 정리 완료: ${count}개 아카이브됨`)
    return count
  } catch (error) {
    logger.error('비활성 계정 메모리 정리 실패:', error)
    return 0
  }
}

/**
 * 중요도 기반 메모리 만료 처리
 */
async function cleanupExpiredMemories(): Promise<number> {
  let totalExpired = 0

  try {
    const now = new Date()

    // 낮은 중요도 메모리 (0.0-0.3)
    const lowImportanceExpiry = new Date(now.getTime() - IMPORTANCE_EXPIRY_DAYS.low * 24 * 60 * 60 * 1000)
    const lowExpired = await prisma.episodicMemory.updateMany({
      where: {
        importance: { lt: 0.3 },
        lastAccessed: { lt: lowImportanceExpiry },
        expiresAt: null
      },
      data: {
        expiresAt: now
      }
    })
    totalExpired += lowExpired.count

    // 중간 중요도 메모리 (0.3-0.6)
    const mediumImportanceExpiry = new Date(now.getTime() - IMPORTANCE_EXPIRY_DAYS.medium * 24 * 60 * 60 * 1000)
    const mediumExpired = await prisma.episodicMemory.updateMany({
      where: {
        importance: { gte: 0.3, lt: 0.6 },
        lastAccessed: { lt: mediumImportanceExpiry },
        expiresAt: null
      },
      data: {
        expiresAt: now
      }
    })
    totalExpired += mediumExpired.count

    // 높은 중요도 메모리 (0.6-0.8)
    const highImportanceExpiry = new Date(now.getTime() - IMPORTANCE_EXPIRY_DAYS.high * 24 * 60 * 60 * 1000)
    const highExpired = await prisma.episodicMemory.updateMany({
      where: {
        importance: { gte: 0.6, lt: 0.8 },
        lastAccessed: { lt: highImportanceExpiry },
        expiresAt: null
      },
      data: {
        expiresAt: now
      }
    })
    totalExpired += highExpired.count

    logger.info(`중요도 기반 메모리 만료 처리: ${totalExpired}개`)
    return totalExpired

  } catch (error) {
    logger.error('메모리 만료 처리 실패:', error)
    return 0
  }
}

/**
 * 실제 만료된 메모리 삭제
 */
async function deleteExpiredMemories(): Promise<number> {
  try {
    const now = new Date()
    
    // 만료된 에피소드 메모리 삭제
    const deleted = await prisma.episodicMemory.deleteMany({
      where: {
        expiresAt: { lte: now }
      }
    })

    if (deleted.count > 0) {
      logger.info(`만료된 메모리 삭제: ${deleted.count}개`)
    }

    return deleted.count

  } catch (error) {
    logger.error('만료된 메모리 삭제 실패:', error)
    return 0
  }
}

/**
 * 완료된 요약 작업 정리 (30일 이상)
 */
async function cleanupOldJobs(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const deleted = await prisma.summarizationJob.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
        completedAt: { lt: thirtyDaysAgo }
      }
    })

    if (deleted.count > 0) {
      logger.info(`오래된 요약 작업 정리: ${deleted.count}개`)
    }

    return deleted.count

  } catch (error) {
    logger.error('오래된 작업 정리 실패:', error)
    return 0
  }
}

/**
 * 전체 정리 작업 실행
 */
async function runCleanupJob(): Promise<void> {
  logger.info('메모리 정리 작업 시작...')

  const startTime = Date.now()

  const [
    inactiveCount,
    expiredCount,
    deletedCount,
    jobsCount
  ] = await Promise.all([
    cleanupInactiveAccounts(),
    cleanupExpiredMemories(),
    deleteExpiredMemories(),
    cleanupOldJobs()
  ])

  const duration = Date.now() - startTime

  logger.info(`메모리 정리 작업 완료 (${duration}ms)`, {
    inactiveAccountsArchived: inactiveCount,
    memoriesMarkedExpired: expiredCount,
    memoriesDeleted: deletedCount,
    oldJobsCleaned: jobsCount
  })
}

/**
 * 크론 작업 시작
 */
export function startMemoryCleanupJob(): void {
  logger.info(`메모리 정리 크론 작업 등록: ${CLEANUP_SCHEDULE}`)
  
  cron.schedule(CLEANUP_SCHEDULE, async () => {
    await runCleanupJob()
  })

  // 서버 시작 시 한 번 실행 (옵션)
  if (process.env.RUN_CLEANUP_ON_START === 'true') {
    logger.info('서버 시작 시 메모리 정리 실행...')
    runCleanupJob().catch(error => {
      logger.error('초기 메모리 정리 실패:', error)
    })
  }
}

/**
 * 수동 정리 실행 (API용)
 */
export async function runManualCleanup(): Promise<{
  inactiveAccountsArchived: number
  memoriesMarkedExpired: number
  memoriesDeleted: number
  oldJobsCleaned: number
}> {
  const [
    inactiveAccountsArchived,
    memoriesMarkedExpired,
    memoriesDeleted,
    oldJobsCleaned
  ] = await Promise.all([
    cleanupInactiveAccounts(),
    cleanupExpiredMemories(),
    deleteExpiredMemories(),
    cleanupOldJobs()
  ])

  return {
    inactiveAccountsArchived,
    memoriesMarkedExpired,
    memoriesDeleted,
    oldJobsCleaned
  }
}

