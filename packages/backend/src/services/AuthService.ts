import { User, UserRole, UserStatus } from '@prisma/client'
import { prisma } from '../config/database'
import { AuthUtils, TokenPair } from '../utils/auth'

export interface RegisterData {
  email: string
  username?: string
  password: string
}

export interface LoginData {
  email: string
  password: string
}

export interface AuthResult {
  success: boolean
  user?: Partial<User>
  tokens?: TokenPair
  message?: string
}

export class AuthService {
  /**
   * 사용자 등록
   */
  static async register(data: RegisterData): Promise<AuthResult> {
    try {
      // 이메일 중복 확인
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      })

      if (existingUser) {
        return {
          success: false,
          message: '이미 존재하는 이메일입니다',
        }
      }

      // 사용자명 중복 확인 (제공된 경우)
      if (data.username) {
        const existingUsername = await prisma.user.findUnique({
          where: { username: data.username },
        })

        if (existingUsername) {
          return {
            success: false,
            message: '이미 존재하는 사용자명입니다',
          }
        }
      }

      // 비밀번호 유효성 검증
      const passwordValidation = AuthUtils.validatePasswordStrength(data.password)
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.errors.join(', '),
        }
      }

      // 비밀번호 해싱
      const hashedPassword = await AuthUtils.hashPassword(data.password)

      // 사용자 생성
      const user = await prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          password: hashedPassword,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          createdAt: true,
        },
      })

      // 토큰 생성
      const tokens = AuthUtils.generateTokenPair(user as User)

      return {
        success: true,
        user,
        tokens,
        message: '회원가입이 완료되었습니다',
      }
    } catch (error) {
      console.error('Registration error:', error)
      return {
        success: false,
        message: '회원가입 처리 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 사용자 로그인
   */
  static async login(data: LoginData): Promise<AuthResult> {
    try {
      // 사용자 조회
      const user = await prisma.user.findUnique({
        where: { email: data.email },
      })

      if (!user) {
        return {
          success: false,
          message: '존재하지 않는 이메일입니다',
        }
      }

      // 계정 상태 확인
      if (user.status !== UserStatus.ACTIVE) {
        return {
          success: false,
          message: '비활성화된 계정입니다',
        }
      }

      // 비밀번호 검증
      const isValidPassword = await AuthUtils.verifyPassword(data.password, user.password)
      if (!isValidPassword) {
        return {
          success: false,
          message: '잘못된 비밀번호입니다',
        }
      }

      // 마지막 로그인 시간 업데이트
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      // 토큰 생성
      const tokens = AuthUtils.generateTokenPair(user)

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
        },
        tokens,
        message: '로그인이 완료되었습니다',
      }
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        message: '로그인 처리 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 토큰 갱신
   */
  static async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // 리프레시 토큰 검증
      const decoded = AuthUtils.verifyToken(refreshToken, true)

      // 사용자 조회
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      })

      if (!user || user.status !== UserStatus.ACTIVE) {
        return {
          success: false,
          message: '유효하지 않은 토큰입니다',
        }
      }

      // 새로운 토큰 쌍 생성
      const tokens = AuthUtils.generateTokenPair(user)

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        tokens,
        message: '토큰이 갱신되었습니다',
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      return {
        success: false,
        message: '토큰 갱신 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 사용자 프로필 조회
   */
  static async getProfile(userId: string): Promise<AuthResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          bio: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          subscription: {
            select: {
              id: true,
              name: true,
              credits: true,
            },
          },
        },
      })

      if (!user) {
        return {
          success: false,
          message: '사용자를 찾을 수 없습니다',
        }
      }

      return {
        success: true,
        user,
      }
    } catch (error) {
      console.error('Get profile error:', error)
      return {
        success: false,
        message: '프로필 조회 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 비밀번호 변경
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<AuthResult> {
    try {
      // 사용자 조회
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        return {
          success: false,
          message: '사용자를 찾을 수 없습니다',
        }
      }

      // 현재 비밀번호 검증
      const isValidPassword = await AuthUtils.verifyPassword(currentPassword, user.password)
      if (!isValidPassword) {
        return {
          success: false,
          message: '현재 비밀번호가 일치하지 않습니다',
        }
      }

      // 새 비밀번호 유효성 검증
      const passwordValidation = AuthUtils.validatePasswordStrength(newPassword)
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.errors.join(', '),
        }
      }

      // 비밀번호 해싱 및 업데이트
      const hashedPassword = await AuthUtils.hashPassword(newPassword)
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      })

      return {
        success: true,
        message: '비밀번호가 변경되었습니다',
      }
    } catch (error) {
      console.error('Change password error:', error)
      return {
        success: false,
        message: '비밀번호 변경 중 오류가 발생했습니다',
      }
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  static async updateProfile(
    userId: string,
    updates: {
      username?: string
      bio?: string
      avatar?: string
    }
  ): Promise<AuthResult> {
    try {
      // 사용자명 중복 확인
      if (updates.username) {
        const existingUser = await prisma.user.findFirst({
          where: {
            username: updates.username,
            id: { not: userId },
          },
        })

        if (existingUser) {
          return {
            success: false,
            message: '이미 존재하는 사용자명입니다',
          }
        }
      }

      // 사용자 정보 업데이트
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          bio: true,
          role: true,
          status: true,
          updatedAt: true,
        },
      })

      return {
        success: true,
        user,
        message: '프로필이 업데이트되었습니다',
      }
    } catch (error) {
      console.error('Update profile error:', error)
      return {
        success: false,
        message: '프로필 업데이트 중 오류가 발생했습니다',
      }
    }
  }
}
