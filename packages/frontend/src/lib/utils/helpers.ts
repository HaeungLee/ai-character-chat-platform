// 일반적인 헬퍼 함수들

// 날짜 포맷팅 함수들
export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }

  return new Intl.DateTimeFormat('ko-KR', { ...defaultOptions, ...options }).format(dateObj)
}

export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return '방금 전'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}시간 전`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}일 전`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks}주 전`
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths}개월 전`
  }

  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears}년 전`
}

// 문자열 조작 함수들
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export const camelToKebab = (text: string): string => {
  return text.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
}

export const kebabToCamel = (text: string): string => {
  return text.replace(/-./g, x => x[1].toUpperCase())
}

// 숫자 포맷팅 함수들
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(num)
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// URL 및 라우팅 헬퍼들
export const buildQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export const parseQueryString = (queryString: string): Record<string, string> => {
  const params: Record<string, string> = {}
  const searchParams = new URLSearchParams(queryString)

  searchParams.forEach((value, key) => {
    params[key] = value
  })

  return params
}

// 배열 헬퍼 함수들
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export const unique = <T>(array: T[]): T[] => {
  return [...new Set(array)]
}

export const shuffle = <T>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// 객체 헬퍼 함수들
export const pick = <T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

export const omit = <T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}

export const isEmpty = (obj: any): boolean => {
  if (obj === null || obj === undefined) return true
  if (typeof obj === 'string' || Array.isArray(obj)) return obj.length === 0
  if (typeof obj === 'object') return Object.keys(obj).length === 0
  return false
}

// 비동기 헬퍼 함수들
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const retry = async <T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delay: number = 1000
): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    if (attempts <= 1) {
      throw error
    }
    await sleep(delay)
    return retry(fn, attempts - 1, delay * 2)
  }
}

// 브라우저 호환성 헬퍼들
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined'
}

export const isMobile = (): boolean => {
  if (!isBrowser()) return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export const isIOS = (): boolean => {
  if (!isBrowser()) return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export const isAndroid = (): boolean => {
  if (!isBrowser()) return false
  return /Android/.test(navigator.userAgent)
}

// 로컬 스토리지 헬퍼들
export const safeLocalStorage = {
  get: (key: string, defaultValue: any = null) => {
    if (!isBrowser()) return defaultValue

    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  },

  set: (key: string, value: any): boolean => {
    if (!isBrowser()) return false

    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },

  remove: (key: string): boolean => {
    if (!isBrowser()) return false

    try {
      localStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  },
}

// 쿠키 헬퍼들
export const safeCookie = {
  get: (name: string): string | null => {
    if (!isBrowser()) return null

    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null
    }
    return null
  },

  set: (name: string, value: string, days: number = 7): void => {
    if (!isBrowser()) return

    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
  },

  remove: (name: string): void => {
    if (!isBrowser()) return

    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  },
}

// 디바운스 및 쓰로틀 함수들
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout

  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// UUID 생성
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// 클래스 이름 조합 헬퍼 (Tailwind CSS용)
export const cn = (...classes: (string | undefined | null | boolean)[]): string => {
  return classes.filter(Boolean).join(' ')
}

// 환경 변수 헬퍼
export const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`)
  }
  return value
}

// 개발 환경 확인
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development'
}

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

export const isTest = (): boolean => {
  return process.env.NODE_ENV === 'test'
}
