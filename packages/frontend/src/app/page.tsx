'use client'

import Link from 'next/link'
import { useAuth, useTheme } from '@/lib/context'

export default function HomePage() {
  const { isAuthenticated, user } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* 배경 장식 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-500/5 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="relative z-10 border-b border-[var(--border)] bg-[var(--card)]/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* 로고 */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                flex items-center justify-center text-white font-bold text-sm sm:text-lg">
                AI
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[var(--foreground)]">
                Character Chat
              </h1>
            </div>

            {/* 네비게이션 */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* 테마 토글 */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] 
                  hover:bg-[var(--secondary)] transition-colors"
                aria-label="테마 변경"
              >
                {resolvedTheme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {isAuthenticated ? (
                <>
                  <Link
                    href="/chat"
                    className="hidden sm:inline-flex px-4 py-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-medium transition-colors"
                  >
                    채팅
                  </Link>
                  <Link
                    href="/characters"
                    className="hidden sm:inline-flex px-4 py-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-medium transition-colors"
                  >
                    캐릭터
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-lg
                      bg-[var(--secondary)] text-[var(--foreground)] font-medium
                      hover:bg-[var(--accent)] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                      flex items-center justify-center text-white text-xs font-bold">
                      {user?.username?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </div>
                    <span className="hidden sm:inline">{user?.username || '프로필'}</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="px-3 py-2 sm:px-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-medium transition-colors"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/auth/register"
                    className="px-3 py-2 sm:px-4 rounded-lg text-white font-medium
                      bg-gradient-to-r from-indigo-500 to-purple-600 
                      hover:from-indigo-600 hover:to-purple-700 transition-all"
                  >
                    시작하기
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 히어로 섹션 */}
      <section className="relative z-10 pt-16 sm:pt-24 lg:pt-32 pb-16 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* 배지 */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full 
              bg-[var(--primary)]/10 border border-[var(--primary)]/20 mb-6 sm:mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--primary)]"></span>
              </span>
              <span className="text-sm font-medium text-[var(--primary)]">
                새로운 AI 캐릭터 채팅 경험
              </span>
            </div>

            {/* 메인 타이틀 */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-[var(--foreground)] mb-6 sm:mb-8 leading-tight">
              AI 캐릭터와
              <br />
              <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                특별한 대화
              </span>
            </h1>

            {/* 설명 */}
            <p className="text-lg sm:text-xl text-[var(--muted-foreground)] mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed">
              다양한 성격의 AI 캐릭터와 실시간으로 대화하고,
              <br className="hidden sm:block" />
              나만의 캐릭터를 만들어보세요.
            </p>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12 sm:mb-16">
              <Link
                href={isAuthenticated ? '/chat' : '/auth/register'}
                className="px-8 py-4 rounded-xl font-medium text-white text-lg
                  bg-gradient-to-r from-indigo-500 to-purple-600 
                  hover:from-indigo-600 hover:to-purple-700
                  shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30
                  transform hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isAuthenticated ? '채팅 시작하기' : '무료로 시작하기'}
              </Link>
              <Link
                href="/characters"
                className="px-8 py-4 rounded-xl font-medium text-lg
                  bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]
                  hover:bg-[var(--accent)] hover:border-[var(--primary)]/50
                  transition-all"
              >
                캐릭터 둘러보기
              </Link>
            </div>

            {/* 통계 */}
            <div className="flex flex-wrap justify-center gap-8 sm:gap-12 text-center">
              {[
                { value: '10K+', label: '활성 사용자' },
                { value: '1M+', label: '대화 수' },
                { value: '500+', label: '캐릭터' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">{stat.value}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="relative z-10 py-16 sm:py-24 bg-[var(--card)]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] mb-4">
              주요 기능
            </h2>
            <p className="text-[var(--muted-foreground)] max-w-2xl mx-auto">
              AI 캐릭터 채팅의 모든 것을 경험해보세요
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                ),
                title: '실시간 스트리밍',
                description: '타자기처럼 실시간으로 AI 응답을 확인하세요. 자연스러운 대화 경험을 제공합니다.',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
                title: '장기 기억',
                description: '대화 내용을 기억하고 맥락을 유지합니다. 캐릭터가 당신을 기억합니다.',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                ),
                title: '커스텀 캐릭터',
                description: '나만의 AI 캐릭터를 만들고 성격을 설정하세요. 무한한 가능성이 펼쳐집니다.',
                color: 'from-orange-500 to-red-500',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                title: 'AI 이미지 생성',
                description: '대화 중 AI가 이미지를 생성합니다. 시각적인 경험을 더해보세요.',
                color: 'from-green-500 to-emerald-500',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                title: '안전한 대화',
                description: '모든 대화는 암호화되어 보호됩니다. 프라이버시를 최우선으로 생각합니다.',
                color: 'from-indigo-500 to-violet-500',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: '빠른 응답',
                description: '최적화된 인프라로 빠른 응답을 제공합니다. 대기 시간을 최소화했습니다.',
                color: 'from-yellow-500 to-orange-500',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group p-6 sm:p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)]
                  hover:border-[var(--primary)]/50 hover:shadow-xl hover:shadow-[var(--primary)]/5
                  transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color}
                  flex items-center justify-center text-white mb-4
                  group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-[var(--muted-foreground)]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="relative z-10 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              무료로 가입하고 AI 캐릭터와의 대화를 경험해보세요.
              매일 새로운 대화가 기다립니다.
            </p>
            <Link
              href={isAuthenticated ? '/chat' : '/auth/register'}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-medium text-lg
                bg-white text-indigo-600 
                hover:bg-white/90 shadow-lg
                transform hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {isAuthenticated ? '채팅하러 가기' : '무료로 시작하기'}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="relative z-10 border-t border-[var(--border)] bg-[var(--card)]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 
                flex items-center justify-center text-white font-bold text-sm">
                AI
              </div>
              <span className="font-medium text-[var(--foreground)]">Character Chat</span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm text-[var(--muted-foreground)]">
              <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
                개인정보처리방침
              </Link>
              <Link href="/contact" className="hover:text-[var(--foreground)] transition-colors">
                문의하기
              </Link>
            </div>

            <p className="text-sm text-[var(--muted-foreground)]">
              © 2024 AI Character Chat
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
