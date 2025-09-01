// 애플리케이션 상수들

export const APP_CONFIG = {
  name: 'AI Character Chat Platform',
  description: 'AI 캐릭터와 실시간 채팅하고 이미지를 생성하세요',
  version: '1.0.0',
  author: 'AI Character Chat Platform Team',
}

// API 관련 상수들
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },
  USERS: {
    PROFILE: '/users/profile',
    SEARCH: '/users/search',
    UPDATE: '/users/update',
  },
  CHARACTERS: {
    LIST: '/characters',
    CREATE: '/characters',
    UPDATE: '/characters/:id',
    DELETE: '/characters/:id',
  },
  CHAT: {
    ROOMS: '/chat/rooms',
    MESSAGES: '/chat/rooms/:roomId/messages',
  },
  IMAGES: {
    GENERATE: '/images/generate',
    LIST: '/images',
    DELETE: '/images/:id',
  },
}

// 사용자 역할
export const USER_ROLES = {
  GUEST: 'guest',
  USER: 'user',
  PREMIUM: 'premium',
  CREATOR: 'creator',
  ADMIN: 'admin',
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

// 메시지 타입
export const MESSAGE_TYPES = {
  USER: 'user',
  CHARACTER: 'character',
  SYSTEM: 'system',
} as const

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES]

// 이미지 생성 모델
export const IMAGE_MODELS = {
  DALL_E_3: 'dall-e-3',
  REPLICATE: 'replicate',
  STABILITY: 'stability',
  STABLE_DIFFUSION: 'stable-diffusion',
} as const

export type ImageModel = typeof IMAGE_MODELS[keyof typeof IMAGE_MODELS]

// 파일 업로드 설정
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_FILES: 5,
}

// 채팅 설정
export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 2000,
  TYPING_TIMEOUT: 3000,
  MESSAGE_PAGE_SIZE: 50,
}

// AI 모델 설정
export const AI_CONFIG = {
  TEMPERATURE_MIN: 0,
  TEMPERATURE_MAX: 2,
  TEMPERATURE_DEFAULT: 0.7,
  MAX_TOKENS_MIN: 100,
  MAX_TOKENS_MAX: 4000,
  MAX_TOKENS_DEFAULT: 1000,
}

// 로컬 스토리지 키들
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
  LANGUAGE: 'language',
}

// 테마 설정
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto',
} as const

export type Theme = typeof THEMES[keyof typeof THEMES]

// 언어 설정
export const LANGUAGES = {
  KO: 'ko',
  EN: 'en',
} as const

export type Language = typeof LANGUAGES[keyof typeof LANGUAGES]

// 에러 코드들
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

// 성공 메시지들
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: '로그인되었습니다.',
  REGISTER_SUCCESS: '회원가입이 완료되었습니다.',
  LOGOUT_SUCCESS: '로그아웃되었습니다.',
  PROFILE_UPDATE_SUCCESS: '프로필이 업데이트되었습니다.',
  CHARACTER_CREATE_SUCCESS: '캐릭터가 생성되었습니다.',
  CHARACTER_UPDATE_SUCCESS: '캐릭터가 업데이트되었습니다.',
  CHARACTER_DELETE_SUCCESS: '캐릭터가 삭제되었습니다.',
  IMAGE_GENERATE_SUCCESS: '이미지가 생성되었습니다.',
  IMAGE_DELETE_SUCCESS: '이미지가 삭제되었습니다.',
} as const

// WebSocket 이벤트들
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE_SEND: 'message:send',
  MESSAGE_RECEIVE: 'message',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  ERROR: 'error',
} as const

// 정규식 패턴들
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
}

// 시간 관련 상수들
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
}

// 페이지네이션 설정
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1,
}

// 캐시 설정
export const CACHE_CONFIG = {
  DEFAULT_TTL: 5 * 60 * 1000, // 5분
  USER_PROFILE_TTL: 10 * 60 * 1000, // 10분
  CHARACTERS_TTL: 15 * 60 * 1000, // 15분
  MESSAGES_TTL: 30 * 60 * 1000, // 30분
}
