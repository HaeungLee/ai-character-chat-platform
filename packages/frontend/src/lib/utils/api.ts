// API 관련 유틸리티 함수들

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  status: number
  message: string
  code?: string
}

export class ApiClient {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    // JWT 토큰 추가
    const token = this.getAuthToken()
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new ApiError(response.status, data.message || 'API request failed', data.code)
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }

      throw new ApiError(500, 'Network error or server unavailable')
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint
    return this.request<T>(url)
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null

    try {
      const token = localStorage.getItem('auth_token')
      return token
    } catch {
      return null
    }
  }

  setAuthToken(token: string): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem('auth_token', token)
    } catch (error) {
      console.error('Failed to save auth token:', error)
    }
  }

  removeAuthToken(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem('auth_token')
    } catch (error) {
      console.error('Failed to remove auth token:', error)
    }
  }
}

// 기본 API 클라이언트 인스턴스
export const apiClient = new ApiClient()

// 커스텀 훅용 API 함수들
export const api = {
  // 인증
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }),
    register: (data: { email: string; password: string; name: string }) =>
      apiClient.post('/auth/register', data),
    refresh: (refreshToken: string) =>
      apiClient.post('/auth/refresh', { refresh_token: refreshToken }),
    logout: () => apiClient.post('/auth/logout'),
  },

  // 사용자
  users: {
    getProfile: () => apiClient.get('/users/me'),
    updateProfile: (data: any) => apiClient.put('/users/me', data),
    searchUsers: (query: string) => apiClient.get('/users/search', { q: query }),
  },

  // 캐릭터
  characters: {
    getAll: (params?: any) => apiClient.get('/characters', params),
    getById: (id: string) => apiClient.get(`/characters/${id}`),
    create: (data: any) => apiClient.post('/characters', data),
    update: (id: string, data: any) => apiClient.put(`/characters/${id}`, data),
    delete: (id: string) => apiClient.delete(`/characters/${id}`),
  },

  // 채팅
  chat: {
    getRooms: () => apiClient.get('/chat/rooms'),
    getRoomById: (id: string) => apiClient.get(`/chat/rooms/${id}`),
    createRoom: (data: any) => apiClient.post('/chat/rooms', data),
    deleteRoom: (id: string) => apiClient.delete(`/chat/rooms/${id}`),
    getMessages: (roomId: string, params?: any) =>
      apiClient.get(`/chat/rooms/${roomId}/messages`, params),
  },

  // 이미지 생성
  images: {
    generate: (data: any) => apiClient.post('/images/generate', data),
    getAll: (params?: any) => apiClient.get('/images', params),
    getById: (id: string) => apiClient.get(`/images/${id}`),
    delete: (id: string) => apiClient.delete(`/images/${id}`),
  },
}
