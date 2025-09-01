// 메인 타입 정의 파일

// 사용자 관련 타입들
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  bio?: string
  role: UserRole
  status: UserStatus
  preferences: UserPreferences
  stats: UserStats
  subscription: SubscriptionInfo
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export type UserRole = 'guest' | 'user' | 'premium' | 'creator' | 'admin'

export type UserStatus = 'active' | 'inactive' | 'banned' | 'suspended'

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: 'ko' | 'en'
  notifications: NotificationSettings
  privacy: PrivacySettings
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  chatMessages: boolean
  characterUpdates: boolean
  systemAnnouncements: boolean
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends'
  showOnlineStatus: boolean
  allowDirectMessages: boolean
}

export interface UserStats {
  totalChats: number
  totalMessages: number
  totalImages: number
  charactersCreated: number
  accountAge: number
}

export interface SubscriptionInfo {
  plan: UserRole
  status: 'active' | 'inactive' | 'cancelled' | 'past_due'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

// 캐릭터 관련 타입들
export interface Character {
  id: string
  name: string
  avatar?: string
  description?: string
  personality?: string
  systemPrompt: string
  voice?: string
  appearance?: string
  background?: string
  category?: string
  tags: string[]
  usageCount: number
  rating?: number
  reviewCount: number
  temperature?: number
  maxTokens?: number
  userId: string
  createdAt: string
  updatedAt: string
  isActive: boolean
}

// 채팅 관련 타입들
export interface ChatRoom {
  id: string
  title?: string
  userId: string
  characterId: string
  user: User
  character: Character
  model: string
  temperature?: number
  maxTokens?: number
  messageCount: number
  totalTokens: number
  createdAt: string
  updatedAt: string
  lastActivity: string
}

export interface Message {
  id: string
  chatId: string
  content: string
  role: MessageRole
  tokens?: number
  metadata?: Record<string, any>
  createdAt: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

// 이미지 생성 관련 타입들
export interface ImageGeneration {
  id: string
  prompt: string
  negativePrompt?: string
  model: ImageModel
  style?: string
  size: string
  aspectRatio?: string
  guidanceScale?: number
  numInferenceSteps?: number
  imageUrl: string
  status: GenerationStatus
  cost?: number
  tokens?: number
  userId: string
  createdAt: string
  completedAt?: string
}

export type ImageModel = 'dall-e-3' | 'replicate' | 'stability' | 'stable-diffusion'

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed'

// 결제 관련 타입들
export interface Payment {
  id: string
  userId: string
  amount: number
  currency: string
  status: PaymentStatus
  stripePaymentIntentId?: string
  stripeCustomerId?: string
  subscriptionId?: string
  metadata?: Record<string, any>
  createdAt: string
  completedAt?: string
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'

// 구독 플랜 관련 타입들
export interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  interval: SubscriptionInterval
  credits: number
  maxChats?: number
  maxImages?: number
  priority: boolean
  features: string[]
  stripePriceId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type SubscriptionInterval = 'monthly' | 'yearly'

// API 응답 타입들
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: PaginationInfo
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// 폼 데이터 타입들
export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  email: string
  password: string
  confirmPassword: string
  name: string
}

export interface CharacterFormData {
  name: string
  description: string
  personality?: string
  systemPrompt: string
  temperature?: number
  maxTokens?: number
  category?: string
  tags: string[]
}

export interface ImageGenerationFormData {
  prompt: string
  negativePrompt?: string
  model: ImageModel
  style?: string
  aspectRatio?: string
  guidanceScale?: number
  numInferenceSteps?: number
}

export interface UserProfileFormData {
  name: string
  bio?: string
  avatar?: File | string
  preferences: UserPreferences
}

// 에러 타입들
export interface ApiError {
  status: number
  message: string
  code?: string
  details?: Record<string, any>
}

export interface ValidationError {
  field: string
  message: string
}

// WebSocket 이벤트 타입들
export interface SocketMessage {
  type: 'message' | 'typing' | 'error' | 'status'
  data: any
  timestamp: string
}

// 테마 및 UI 타입들
export type Theme = 'light' | 'dark' | 'auto'
export type Language = 'ko' | 'en'

// 파일 업로드 타입들
export interface UploadFile {
  file: File
  preview: string
  id: string
}

export interface UploadProgress {
  id: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
}

// 검색 및 필터 타입들
export interface SearchFilters {
  query?: string
  category?: string
  tags?: string[]
  sortBy?: 'name' | 'created' | 'usage' | 'rating'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 로딩 및 상태 타입들
export interface LoadingState {
  isLoading: boolean
  message?: string
}

export interface AsyncState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
}

// 모달 및 팝업 타입들
export interface ModalState {
  isOpen: boolean
  type?: string
  data?: any
}

// 알림 타입들
export interface NotificationItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}
