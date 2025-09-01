// 인증 관련 유틸리티 함수들

import { User, UserRole } from '../types'

// JWT 토큰 관리
export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'access_token'
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token'

  // Access Token 관리
  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.ACCESS_TOKEN_KEY)
  }

  static setAccessToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token)
  }

  static removeAccessToken(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.ACCESS_TOKEN_KEY)
  }

  // Refresh Token 관리
  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.REFRESH_TOKEN_KEY)
  }

  static setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token)
  }

  static removeRefreshToken(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.REFRESH_TOKEN_KEY)
  }

  // 모든 토큰 제거
  static clearTokens(): void {
    this.removeAccessToken()
    this.removeRefreshToken()
  }

  // 토큰 존재 여부 확인
  static hasTokens(): boolean {
    return !!(this.getAccessToken() && this.getRefreshToken())
  }

  // 토큰 만료 확인 (간단한 확인)
  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Date.now() / 1000
      return payload.exp < currentTime
    } catch {
      return true
    }
  }
}

// 사용자 권한 관리
export class PermissionManager {
  // 역할별 권한 매핑
  private static readonly ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    admin: [
      'user:read',
      'user:create',
      'user:update',
      'user:delete',
      'character:read',
      'character:create',
      'character:update',
      'character:delete',
      'character:publish',
      'chat:read',
      'chat:create',
      'chat:delete',
      'image:generate',
      'image:read',
      'image:delete',
      'subscription:manage',
      'payment:read',
      'analytics:read',
      'system:config',
    ],
    creator: [
      'user:read',
      'user:update',
      'character:read',
      'character:create',
      'character:update',
      'character:delete',
      'character:publish',
      'chat:read',
      'chat:create',
      'chat:delete',
      'image:generate',
      'image:read',
      'image:delete',
      'subscription:manage',
      'payment:read',
      'analytics:read',
    ],
    premium: [
      'user:read',
      'user:update',
      'character:read',
      'character:create',
      'character:update',
      'character:delete',
      'chat:read',
      'chat:create',
      'chat:delete',
      'image:generate',
      'image:read',
      'image:delete',
    ],
    user: [
      'user:read',
      'user:update',
      'character:read',
      'character:create',
      'character:update',
      'character:delete',
      'chat:read',
      'chat:create',
      'chat:delete',
      'image:generate',
      'image:read',
      'image:delete',
    ],
    guest: [
      'character:read',
      'image:generate', // 제한적 사용
    ],
  }

  // 권한 확인
  static hasPermission(user: User | null, permission: string): boolean {
    if (!user) return false
    const userPermissions = this.ROLE_PERMISSIONS[user.role] || []
    return userPermissions.includes(permission)
  }

  // 여러 권한 중 하나라도 있는지 확인
  static hasAnyPermission(user: User | null, permissions: string[]): boolean {
    if (!user) return false
    return permissions.some(permission => this.hasPermission(user, permission))
  }

  // 모든 권한이 있는지 확인
  static hasAllPermissions(user: User | null, permissions: string[]): boolean {
    if (!user) return false
    return permissions.every(permission => this.hasPermission(user, permission))
  }

  // 역할 확인
  static hasRole(user: User | null, role: UserRole): boolean {
    if (!user) return false
    return user.role === role
  }

  // 최소 역할 레벨 확인
  static hasMinimumRole(user: User | null, minimumRole: UserRole): boolean {
    if (!user) return false

    const roleHierarchy: Record<UserRole, number> = {
      guest: 0,
      user: 1,
      premium: 2,
      creator: 3,
      admin: 4,
    }

    return roleHierarchy[user.role] >= roleHierarchy[minimumRole]
  }
}

// 인증 상태 관리
export class AuthManager {
  private static currentUser: User | null = null
  private static listeners: ((user: User | null) => void)[] = []

  // 현재 사용자 설정
  static setCurrentUser(user: User | null): void {
    this.currentUser = user
    this.notifyListeners()
  }

  // 현재 사용자 가져오기
  static getCurrentUser(): User | null {
    return this.currentUser
  }

  // 로그인 상태 확인
  static isAuthenticated(): boolean {
    return !!(this.currentUser && TokenManager.hasTokens())
  }

  // 로그아웃
  static async logout(): Promise<void> {
    try {
      // API 호출로 서버-side 로그아웃
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
        },
      })

      if (!response.ok) {
        console.warn('Server logout failed, proceeding with client logout')
      }
    } catch (error) {
      console.warn('Server logout failed, proceeding with client logout', error)
    }

    // 클라이언트-side 정리
    TokenManager.clearTokens()
    this.setCurrentUser(null)
    localStorage.removeItem('user_preferences')
  }

  // 토큰 갱신
  static async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = TokenManager.getRefreshToken()
      if (!refreshToken) {
        return false
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      TokenManager.setAccessToken(data.access_token)
      TokenManager.setRefreshToken(data.refresh_token)

      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  // 리스너 관리
  static addListener(callback: (user: User | null) => void): void {
    this.listeners.push(callback)
  }

  static removeListener(callback: (user: User | null) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback)
  }

  private static notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentUser)
      } catch (error) {
        console.error('Auth listener error:', error)
      }
    })
  }
}

// 사용자 세션 관리
export class SessionManager {
  private static readonly SESSION_KEY = 'user_session'
  private static readonly LAST_ACTIVITY_KEY = 'last_activity'

  // 세션 저장
  static saveSession(user: User): void {
    if (typeof window === 'undefined') return

    const session = {
      user,
      timestamp: Date.now(),
    }

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session))
    this.updateLastActivity()
  }

  // 세션 불러오기
  static loadSession(): User | null {
    if (typeof window === 'undefined') return null

    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY)
      if (!sessionData) return null

      const session = JSON.parse(sessionData)

      // 세션 만료 확인 (24시간)
      const SESSION_TIMEOUT = 24 * 60 * 60 * 1000
      if (Date.now() - session.timestamp > SESSION_TIMEOUT) {
        this.clearSession()
        return null
      }

      return session.user
    } catch (error) {
      console.error('Session load error:', error)
      this.clearSession()
      return null
    }
  }

  // 세션 정리
  static clearSession(): void {
    if (typeof window === 'undefined') return

    localStorage.removeItem(this.SESSION_KEY)
    localStorage.removeItem(this.LAST_ACTIVITY_KEY)
  }

  // 마지막 활동 업데이트
  static updateLastActivity(): void {
    if (typeof window === 'undefined') return

    localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString())
  }

  // 마지막 활동 가져오기
  static getLastActivity(): number | null {
    if (typeof window === 'undefined') return null

    const lastActivity = localStorage.getItem(this.LAST_ACTIVITY_KEY)
    return lastActivity ? parseInt(lastActivity) : null
  }

  // 비활성 시간 확인
  static getInactiveTime(): number {
    const lastActivity = this.getLastActivity()
    return lastActivity ? Date.now() - lastActivity : 0
  }

  // 세션 유효성 확인
  static isSessionValid(): boolean {
    const user = this.loadSession()
    if (!user) return false

    const inactiveTime = this.getInactiveTime()
    const MAX_INACTIVE_TIME = 30 * 60 * 1000 // 30분

    return inactiveTime < MAX_INACTIVE_TIME
  }
}
