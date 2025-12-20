'use client'

/**
 * 인증 컨텍스트
 * - 로그인 상태 관리
 * - 토큰 관리
 * - 사용자 정보
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// =====================================================
// 타입 정의
// =====================================================

interface User {
  id: string
  email: string
  username?: string
  avatar?: string
  role: 'USER' | 'ADMIN'
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, username?: string) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// =====================================================
// 컨텍스트 생성
// =====================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// =====================================================
// Provider 컴포넌트
// =====================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // 초기화: 저장된 토큰 확인
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('auth_token')
      
      if (savedToken) {
        try {
          const response = await fetch(`${API_URL}/api/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            setState({
              user: data.user,
              token: savedToken,
              isLoading: false,
              isAuthenticated: true,
            })
            return
          }
        } catch (error) {
          console.error('Auth init failed:', error)
        }
        
        // 토큰이 유효하지 않으면 삭제
        localStorage.removeItem('auth_token')
      }

      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }

    initAuth()
  }, [])

  // 로그인
  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || '로그인에 실패했습니다.')
    }

    // 백엔드는 tokens 객체로 반환 (accessToken, refreshToken)
    const accessToken = data.tokens?.accessToken || data.token

    localStorage.setItem('auth_token', accessToken)

    setState({
      user: data.user,
      token: accessToken,
      isLoading: false,
      isAuthenticated: true,
    })
  }, [])

  // 회원가입
  const register = useCallback(async (email: string, password: string, username?: string) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    })

    const data = await response.json()

    if (!response.ok) {
      // 상세 에러 정보 출력
      console.error('Registration error:', data)

      // 검증 에러가 있으면 상세 메시지 표시
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessages = data.errors.map((err: any) => `${err.field}: ${err.message}`).join('\n')
        throw new Error(errorMessages || data.message || '회원가입에 실패했습니다.')
      }

      throw new Error(data.message || '회원가입에 실패했습니다.')
    }

    // 백엔드는 tokens 객체로 반환 (accessToken, refreshToken)
    const accessToken = data.tokens?.accessToken || data.token

    localStorage.setItem('auth_token', accessToken)

    setState({
      user: data.user,
      token: accessToken,
      isLoading: false,
      isAuthenticated: true,
    })
  }, [])

  // 로그아웃
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    })
  }, [])

  // 프로필 업데이트
  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!state.token) {
      throw new Error('인증이 필요합니다.')
    }

    const response = await fetch(`${API_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || '프로필 업데이트에 실패했습니다.')
    }

    setState(prev => ({
      ...prev,
      user: { ...prev.user!, ...result.user },
    }))
  }, [state.token])

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// =====================================================
// Hook
// =====================================================

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export type { User, AuthState, AuthContextType }


