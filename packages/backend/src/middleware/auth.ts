import { Request, Response, NextFunction } from 'express'
import { AuthUtils, JWTPayload } from '../utils/auth'
import { prisma } from '../config/database'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    username?: string
  }
}

/**
 * JWT 토큰 인증 미들웨어
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = AuthUtils.extractTokenFromHeader(authHeader)

    if (!token) {
      res.status(401).json({
        success: false,
        message: '액세스 토큰이 필요합니다',
      })
      return
    }

    // 토큰 검증
    const decoded = AuthUtils.verifyToken(token)

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
      },
    })

    if (!user) {
      res.status(401).json({
        success: false,
        message: '사용자를 찾을 수 없습니다',
      })
      return
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        message: '계정이 비활성화되었습니다',
      })
      return
    }

    // 요청 객체에 사용자 정보 추가
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username || undefined,
    }

    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다',
    })
  }
}

/**
 * 선택적 인증 미들웨어 (토큰이 있으면 사용자 정보 추가)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = AuthUtils.extractTokenFromHeader(authHeader)

    if (token) {
      const decoded = AuthUtils.verifyToken(token)
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
        },
      })

      if (user && user.status === 'ACTIVE') {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          username: user.username || undefined,
        }
      }
    }

    next()
  } catch (error) {
    // 선택적 인증이므로 에러 무시하고 다음으로 진행
    next()
  }
}

/**
 * 관리자 권한 확인 미들웨어
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '인증이 필요합니다',
    })
    return
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      message: '관리자 권한이 필요합니다',
    })
    return
  }

  next()
}

/**
 * 프리미엄 권한 확인 미들웨어
 */
export const requirePremium = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '인증이 필요합니다',
    })
    return
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'PREMIUM') {
    res.status(403).json({
      success: false,
      message: '프리미엄 권한이 필요합니다',
    })
    return
  }

  next()
}

/**
 * 소유자 확인 미들웨어 (자원 소유자인지 확인)
 */
export const requireOwnership = (resourceUserId: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '인증이 필요합니다',
      })
      return
    }

    if (req.user.id !== resourceUserId && req.user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다',
      })
      return
    }

    next()
  }
}
