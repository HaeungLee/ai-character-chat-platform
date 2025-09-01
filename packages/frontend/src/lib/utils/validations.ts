// 유효성 검사 함수들

import { REGEX_PATTERNS } from './constants'

// 이메일 유효성 검사
export const validateEmail = (email: string): { isValid: boolean; message?: string } => {
  if (!email.trim()) {
    return { isValid: false, message: '이메일을 입력해주세요.' }
  }

  if (!REGEX_PATTERNS.EMAIL.test(email)) {
    return { isValid: false, message: '올바른 이메일 형식이 아닙니다.' }
  }

  return { isValid: true }
}

// 비밀번호 유효성 검사
export const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (!password) {
    return { isValid: false, message: '비밀번호를 입력해주세요.' }
  }

  if (password.length < 8) {
    return { isValid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' }
  }

  if (!REGEX_PATTERNS.PASSWORD.test(password)) {
    return {
      isValid: false,
      message: '비밀번호는 대소문자, 숫자, 특수문자를 각각 최소 1개씩 포함해야 합니다.'
    }
  }

  return { isValid: true }
}

// 비밀번호 확인 유효성 검사
export const validatePasswordConfirm = (
  password: string,
  confirmPassword: string
): { isValid: boolean; message?: string } => {
  if (!confirmPassword) {
    return { isValid: false, message: '비밀번호 확인을 입력해주세요.' }
  }

  if (password !== confirmPassword) {
    return { isValid: false, message: '비밀번호가 일치하지 않습니다.' }
  }

  return { isValid: true }
}

// 이름 유효성 검사
export const validateName = (name: string): { isValid: boolean; message?: string } => {
  if (!name.trim()) {
    return { isValid: false, message: '이름을 입력해주세요.' }
  }

  if (name.trim().length < 2) {
    return { isValid: false, message: '이름은 최소 2자 이상이어야 합니다.' }
  }

  if (name.trim().length > 50) {
    return { isValid: false, message: '이름은 최대 50자까지 입력할 수 있습니다.' }
  }

  return { isValid: true }
}

// 메시지 유효성 검사
export const validateMessage = (message: string): { isValid: boolean; message?: string } => {
  if (!message.trim()) {
    return { isValid: false, message: '메시지를 입력해주세요.' }
  }

  if (message.length > 2000) {
    return { isValid: false, message: '메시지는 최대 2000자까지 입력할 수 있습니다.' }
  }

  return { isValid: true }
}

// 캐릭터 이름 유효성 검사
export const validateCharacterName = (name: string): { isValid: boolean; message?: string } => {
  if (!name.trim()) {
    return { isValid: false, message: '캐릭터 이름을 입력해주세요.' }
  }

  if (name.trim().length < 2) {
    return { isValid: false, message: '캐릭터 이름은 최소 2자 이상이어야 합니다.' }
  }

  if (name.trim().length > 100) {
    return { isValid: false, message: '캐릭터 이름은 최대 100자까지 입력할 수 있습니다.' }
  }

  return { isValid: true }
}

// 캐릭터 설명 유효성 검사
export const validateCharacterDescription = (description: string): { isValid: boolean; message?: string } => {
  if (!description.trim()) {
    return { isValid: false, message: '캐릭터 설명을 입력해주세요.' }
  }

  if (description.length < 10) {
    return { isValid: false, message: '캐릭터 설명은 최소 10자 이상이어야 합니다.' }
  }

  if (description.length > 1000) {
    return { isValid: false, message: '캐릭터 설명은 최대 1000자까지 입력할 수 있습니다.' }
  }

  return { isValid: true }
}

// 프롬프트 유효성 검사
export const validatePrompt = (prompt: string): { isValid: boolean; message?: string } => {
  if (!prompt.trim()) {
    return { isValid: false, message: '프롬프트를 입력해주세요.' }
  }

  if (prompt.length < 10) {
    return { isValid: false, message: '프롬프트는 최소 10자 이상이어야 합니다.' }
  }

  if (prompt.length > 1000) {
    return { isValid: false, message: '프롬프트는 최대 1000자까지 입력할 수 있습니다.' }
  }

  return { isValid: true }
}

// 파일 유효성 검사
export const validateFile = (file: File): { isValid: boolean; message?: string } => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  if (!file) {
    return { isValid: false, message: '파일을 선택해주세요.' }
  }

  if (file.size > maxSize) {
    return { isValid: false, message: '파일 크기는 최대 10MB까지 업로드할 수 있습니다.' }
  }

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, message: '지원하지 않는 파일 형식입니다. JPG, PNG, GIF, WebP 파일만 업로드할 수 있습니다.' }
  }

  return { isValid: true }
}

// URL 유효성 검사
export const validateUrl = (url: string): { isValid: boolean; message?: string } => {
  if (!url.trim()) {
    return { isValid: true } // 선택사항인 경우
  }

  if (!REGEX_PATTERNS.URL.test(url)) {
    return { isValid: false, message: '올바른 URL 형식이 아닙니다.' }
  }

  return { isValid: true }
}

// 폼 데이터 전체 유효성 검사
export const validateLoginForm = (data: { email: string; password: string }) => {
  const errors: Record<string, string> = {}

  const emailValidation = validateEmail(data.email)
  if (!emailValidation.isValid) {
    errors.email = emailValidation.message!
  }

  const passwordValidation = validatePassword(data.password)
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.message!
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export const validateRegisterForm = (data: {
  email: string
  password: string
  confirmPassword: string
  name: string
}) => {
  const errors: Record<string, string> = {}

  const emailValidation = validateEmail(data.email)
  if (!emailValidation.isValid) {
    errors.email = emailValidation.message!
  }

  const passwordValidation = validatePassword(data.password)
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.message!
  }

  const confirmPasswordValidation = validatePasswordConfirm(data.password, data.confirmPassword)
  if (!confirmPasswordValidation.isValid) {
    errors.confirmPassword = confirmPasswordValidation.message!
  }

  const nameValidation = validateName(data.name)
  if (!nameValidation.isValid) {
    errors.name = nameValidation.message!
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export const validateCharacterForm = (data: {
  name: string
  description: string
  personality?: string
  temperature?: number
}) => {
  const errors: Record<string, string> = {}

  const nameValidation = validateCharacterName(data.name)
  if (!nameValidation.isValid) {
    errors.name = nameValidation.message!
  }

  const descriptionValidation = validateCharacterDescription(data.description)
  if (!descriptionValidation.isValid) {
    errors.description = descriptionValidation.message!
  }

  if (data.temperature !== undefined) {
    if (data.temperature < 0 || data.temperature > 2) {
      errors.temperature = 'Temperature는 0에서 2 사이의 값이어야 합니다.'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export const validateImageGenerationForm = (data: {
  prompt: string
  negativePrompt?: string
  model?: string
  style?: string
}) => {
  const errors: Record<string, string> = {}

  const promptValidation = validatePrompt(data.prompt)
  if (!promptValidation.isValid) {
    errors.prompt = promptValidation.message!
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
