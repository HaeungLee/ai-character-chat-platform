'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/context'

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading: authLoading } = useAuth()
  
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 비밀번호 강도 체크
  const getPasswordStrength = (pass: string): { strength: number; label: string; color: string } => {
    let strength = 0
    if (pass.length >= 8) strength++
    if (/[A-Z]/.test(pass)) strength++
    if (/[a-z]/.test(pass)) strength++
    if (/[0-9]/.test(pass)) strength++
    if (/[^A-Za-z0-9]/.test(pass)) strength++

    if (strength <= 2) return { strength, label: '약함', color: 'bg-red-500' }
    if (strength <= 3) return { strength, label: '보통', color: 'bg-yellow-500' }
    if (strength <= 4) return { strength, label: '강함', color: 'bg-green-500' }
    return { strength, label: '매우 강함', color: 'bg-emerald-500' }
  }

  const passwordStrength = getPasswordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 유효성 검사
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    if (!agreeTerms) {
      setError('이용약관에 동의해주세요.')
      return
    }

    setIsLoading(true)

    try {
      await register(email, password, username || undefined)
      router.push('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-12">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* 로고 & 제목 */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-indigo-600 bg-clip-text text-transparent">
              AI Character Chat
            </h1>
          </Link>
          <p className="mt-2 text-[var(--muted-foreground)]">
            새 계정을 만드세요
          </p>
        </div>

        {/* 회원가입 폼 */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 에러 메시지 */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                {error}
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)] 
                  text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent
                  transition-all duration-200"
              />
            </div>

            {/* 사용자명 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                사용자명 <span className="text-[var(--muted-foreground)]">(선택)</span>
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="닉네임"
                className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)] 
                  text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent
                  transition-all duration-200"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="8자 이상"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)] 
                    text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent
                    transition-all duration-200 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* 비밀번호 강도 표시 */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i < passwordStrength.strength ? passwordStrength.color : 'bg-[var(--muted)]'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.strength <= 2 ? 'text-red-500' : 
                    passwordStrength.strength <= 3 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    비밀번호 강도: {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="비밀번호 재입력"
                className={`w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border 
                  text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent
                  transition-all duration-200
                  ${confirmPassword && password !== confirmPassword 
                    ? 'border-red-500' 
                    : confirmPassword && password === confirmPassword 
                      ? 'border-green-500' 
                      : 'border-[var(--border)]'
                  }`}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            {/* 이용약관 동의 */}
            <div className="flex items-start gap-3">
              <input
                id="agreeTerms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] 
                  focus:ring-[var(--ring)] focus:ring-offset-0"
              />
              <label htmlFor="agreeTerms" className="text-sm text-[var(--muted-foreground)]">
                <Link href="/terms" className="text-[var(--primary)] hover:underline">이용약관</Link> 및{' '}
                <Link href="/privacy" className="text-[var(--primary)] hover:underline">개인정보처리방침</Link>에 동의합니다.
              </label>
            </div>

            {/* 회원가입 버튼 */}
            <button
              type="submit"
              disabled={isLoading || authLoading}
              className="w-full py-3 px-4 rounded-lg font-medium text-white
                bg-gradient-to-r from-pink-500 to-indigo-600 
                hover:from-pink-600 hover:to-indigo-700
                focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--background)]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  가입 중...
                </span>
              ) : (
                '회원가입'
              )}
            </button>
          </form>
        </div>

        {/* 로그인 링크 */}
        <p className="mt-6 text-center text-[var(--muted-foreground)]">
          이미 계정이 있으신가요?{' '}
          <Link href="/auth/login" className="text-[var(--primary)] font-medium hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}


