// API 관련 타입 정의

// 공통 API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: PaginationMeta
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// API 에러 타입
export interface ApiError {
  status: number
  message: string
  code?: string
  details?: Record<string, any>
}

// 인증 API 타입들
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface RegisterResponse {
  user: User
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

// 사용자 API 타입들
export interface UpdateProfileRequest {
  name?: string
  bio?: string
  avatar?: string
  preferences?: UserPreferences
}

export interface UserSearchRequest {
  query?: string
  page?: number
  limit?: number
}

export interface UserSearchResponse {
  users: User[]
  pagination: PaginationMeta
}

// 캐릭터 API 타입들
export interface CreateCharacterRequest {
  name: string
  description: string
  personality?: string
  systemPrompt: string
  temperature?: number
  maxTokens?: number
  category?: string
  tags?: string[]
  avatar?: string
}

export interface UpdateCharacterRequest {
  name?: string
  description?: string
  personality?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  category?: string
  tags?: string[]
  avatar?: string
}

export interface CharacterListRequest {
  page?: number
  limit?: number
  category?: string
  tags?: string[]
  sortBy?: 'name' | 'created' | 'usage' | 'rating'
  sortOrder?: 'asc' | 'desc'
  userId?: string
}

export interface CharacterListResponse {
  characters: Character[]
  pagination: PaginationMeta
}

// 채팅 API 타입들
export interface CreateChatRoomRequest {
  characterId: string
  title?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface SendMessageRequest {
  content: string
  type?: 'user' | 'system'
}

export interface ChatMessagesRequest {
  page?: number
  limit?: number
  before?: string
  after?: string
}

export interface ChatMessagesResponse {
  messages: Message[]
  pagination: PaginationMeta
}

// 이미지 생성 API 타입들
export interface GenerateImageRequest {
  prompt: string
  negativePrompt?: string
  model: 'dall-e-3' | 'replicate' | 'stability' | 'stable-diffusion'
  style?: string
  aspectRatio?: string
  guidanceScale?: number
  numInferenceSteps?: number
  size?: string
}

export interface GenerateImageResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  imageUrl?: string
  estimatedTime?: number
}

export interface ImageListRequest {
  page?: number
  limit?: number
  model?: string
  status?: string
  sortBy?: 'created' | 'updated'
  sortOrder?: 'asc' | 'desc'
}

export interface ImageListResponse {
  images: ImageGeneration[]
  pagination: PaginationMeta
}

// 결제 API 타입들
export interface CreatePaymentIntentRequest {
  planId: string
  paymentMethodId?: string
}

export interface CreatePaymentIntentResponse {
  clientSecret: string
  paymentIntentId: string
  amount: number
  currency: string
}

export interface CreateSubscriptionRequest {
  planId: string
  paymentMethodId: string
}

export interface SubscriptionResponse {
  subscription: Subscription
  clientSecret: string
}

export interface PaymentHistoryRequest {
  page?: number
  limit?: number
  status?: string
  startDate?: string
  endDate?: string
}

export interface PaymentHistoryResponse {
  payments: Payment[]
  pagination: PaginationMeta
}

// 파일 업로드 타입들
export interface UploadResponse {
  url: string
  filename: string
  size: number
  mimeType: string
}

// 공통 타입들 (다른 파일에서 import)
interface User {
  id: string
  email: string
  name: string
  avatar?: string
  bio?: string
  role: string
  status: string
  preferences: UserPreferences
  stats: UserStats
  subscription: SubscriptionInfo
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: 'ko' | 'en'
  notifications: NotificationSettings
  privacy: PrivacySettings
}

interface NotificationSettings {
  email: boolean
  push: boolean
  chatMessages: boolean
  characterUpdates: boolean
  systemAnnouncements: boolean
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends'
  showOnlineStatus: boolean
  allowDirectMessages: boolean
}

interface UserStats {
  totalChats: number
  totalMessages: number
  totalImages: number
  charactersCreated: number
  accountAge: number
}

interface SubscriptionInfo {
  plan: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

interface Character {
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

interface Message {
  id: string
  chatId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  tokens?: number
  metadata?: Record<string, any>
  createdAt: string
}

interface ImageGeneration {
  id: string
  prompt: string
  negativePrompt?: string
  model: string
  style?: string
  size: string
  aspectRatio?: string
  guidanceScale?: number
  numInferenceSteps?: number
  imageUrl: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  cost?: number
  tokens?: number
  userId: string
  createdAt: string
  completedAt?: string
}

interface Subscription {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  interval: 'monthly' | 'yearly'
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

interface Payment {
  id: string
  userId: string
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'
  stripePaymentIntentId?: string
  stripeCustomerId?: string
  subscriptionId?: string
  metadata?: Record<string, any>
  createdAt: string
  completedAt?: string
}
