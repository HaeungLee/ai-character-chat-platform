import bcrypt from 'bcryptjs'
import jwt, { Secret, SignOptions } from 'jsonwebtoken'
import { User } from '@prisma/client'

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export class AuthUtils {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'default-secret'
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret'
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'
  private static readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  private static readonly BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12')

  /**
   * 비밀번호 해싱
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS)
  }

  /**
   * 비밀번호 검증
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  /**
   * JWT 액세스 토큰 생성
   */
  static generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const options: SignOptions = {
      expiresIn: this.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    }

    return jwt.sign(payload, this.JWT_SECRET as Secret, options)
  }

  /**
   * JWT 리프레시 토큰 생성
   */
  static generateRefreshToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const options: SignOptions = {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    }

    return jwt.sign(payload, this.JWT_REFRESH_SECRET as Secret, options)
  }

  /**
   * 토큰 쌍 생성 (액세스 + 리프레시)
   */
  static generateTokenPair(user: User): TokenPair {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
    }
  }

  /**
   * JWT 토큰 검증
   */
  static verifyToken(token: string, isRefreshToken = false): JWTPayload {
    const secret = isRefreshToken ? this.JWT_REFRESH_SECRET : this.JWT_SECRET

    try {
      const decoded = jwt.verify(token, secret) as JWTPayload
      return decoded
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  /**
   * JWT 토큰에서 페이로드 추출 (검증하지 않음)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload
    } catch (error) {
      return null
    }
  }

  /**
   * Bearer 토큰에서 JWT 추출
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    return authHeader.substring(7)
  }

  /**
   * 랜덤 비밀번호 생성 (초기 설정용)
   */
  static generateRandomPassword(length = 12): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''

    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }

    return password
  }

  /**
   * 이메일 형식 검증
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * 비밀번호 강도 검증
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push('비밀번호는 최소 8자 이상이어야 합니다')
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('비밀번호에 소문자가 포함되어야 합니다')
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('비밀번호에 대문자가 포함되어야 합니다')
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('비밀번호에 숫자가 포함되어야 합니다')
    }

    if (!/(?=.*[!@#$%^&*])/.test(password)) {
      errors.push('비밀번호에 특수문자가 포함되어야 합니다')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
