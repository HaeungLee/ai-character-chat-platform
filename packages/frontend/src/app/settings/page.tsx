'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth, useTheme } from '@/lib/context'

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, updateProfile, logout } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'account'>('profile')
  
  // 프로필 폼
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 알림 설정
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    marketing: false,
  })

  // 인증 체크
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [authLoading, isAuthenticated, router])

  // 사용자 정보 로드
  useEffect(() => {
    if (user) {
      setUsername(user.username || '')
    }
  }, [user])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    
    try {
      await updateProfile({ username: username || undefined })
      setSaveMessage({ type: 'success', text: '프로필이 저장되었습니다.' })
    } catch (err) {
      setSaveMessage({ type: 'error', text: err instanceof Error ? err.message : '저장에 실패했습니다.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]" />
      </div>
    )
  }

  const tabs = [
    { id: 'profile', label: '프로필', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
    { id: 'appearance', label: '외관', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    )},
    { id: 'notifications', label: '알림', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )},
    { id: 'account', label: '계정', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
  ]

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-[var(--card)]/80 backdrop-blur-lg border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-[var(--foreground)]">
              AI Character Chat
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/chat" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                채팅
              </Link>
              <Link href="/characters" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                캐릭터
              </Link>
              <Link href="/settings" className="text-[var(--primary)] font-medium">
                설정
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 사이드바 */}
          <aside className="lg:w-64 shrink-0">
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
              {/* 사용자 정보 */}
              <div className="p-6 border-b border-[var(--border)]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                    flex items-center justify-center text-white text-xl font-bold">
                    {user?.username?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">
                      {user?.username || '사용자'}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)] truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* 탭 메뉴 */}
              <nav className="p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                      ${activeTab === tab.id 
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)]' 
                        : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'
                      }`}
                  >
                    {tab.icon}
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="flex-1">
            {/* 프로필 탭 */}
            {activeTab === 'profile' && (
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
                <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">프로필 설정</h2>
                
                {saveMessage && (
                  <div className={`mb-6 p-4 rounded-lg text-sm ${
                    saveMessage.type === 'success' 
                      ? 'bg-green-500/10 border border-green-500/30 text-green-500'
                      : 'bg-red-500/10 border border-red-500/30 text-red-500'
                  }`}>
                    {saveMessage.text}
                  </div>
                )}

                <div className="space-y-6">
                  {/* 아바타 */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                      프로필 이미지
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                        flex items-center justify-center text-white text-2xl font-bold">
                        {user?.username?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </div>
                      <button className="px-4 py-2 rounded-lg bg-[var(--secondary)] text-[var(--foreground)]
                        hover:bg-[var(--accent)] transition-colors">
                        이미지 변경
                      </button>
                    </div>
                  </div>

                  {/* 사용자명 */}
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                      사용자명
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="닉네임"
                      className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                        text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                        focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                    />
                  </div>

                  {/* 이메일 (읽기 전용) */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                      이메일
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-3 rounded-lg bg-[var(--muted)] border border-[var(--border)]
                        text-[var(--muted-foreground)] cursor-not-allowed"
                    />
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      이메일은 변경할 수 없습니다.
                    </p>
                  </div>

                  {/* 자기소개 */}
                  <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                      자기소개
                    </label>
                    <textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="자기소개를 작성해주세요..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                        text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                        focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-6 py-3 rounded-lg font-medium text-white
                      bg-gradient-to-r from-indigo-500 to-purple-600 
                      hover:from-indigo-600 hover:to-purple-700
                      disabled:opacity-50 transition-all"
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            )}

            {/* 외관 탭 */}
            {activeTab === 'appearance' && (
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
                <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">외관 설정</h2>
                
                <div className="space-y-6">
                  {/* 테마 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-4">
                      테마
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { value: 'light', label: '라이트', icon: '☀️' },
                        { value: 'dark', label: '다크', icon: '🌙' },
                        { value: 'system', label: '시스템', icon: '💻' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                          className={`p-4 rounded-xl border text-center transition-all
                            ${theme === option.value 
                              ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]' 
                              : 'border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--primary)]/50'
                            }`}
                        >
                          <span className="text-2xl mb-2 block">{option.icon}</span>
                          <span className="font-medium text-[var(--foreground)]">{option.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      현재 적용된 테마: {resolvedTheme === 'dark' ? '다크' : '라이트'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 알림 탭 */}
            {activeTab === 'notifications' && (
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
                <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">알림 설정</h2>
                
                <div className="space-y-4">
                  {[
                    { key: 'email', label: '이메일 알림', description: '중요한 업데이트를 이메일로 받습니다' },
                    { key: 'push', label: '푸시 알림', description: '브라우저 알림을 받습니다' },
                    { key: 'marketing', label: '마케팅 알림', description: '이벤트 및 프로모션 정보를 받습니다' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-lg bg-[var(--secondary)]">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{item.label}</p>
                        <p className="text-sm text-[var(--muted-foreground)]">{item.description}</p>
                      </div>
                      <button
                        onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof notifications] }))}
                        className={`relative w-14 h-8 rounded-full transition-colors ${
                          notifications[item.key as keyof typeof notifications] ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                        }`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                          notifications[item.key as keyof typeof notifications] ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 계정 탭 */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                {/* 비밀번호 변경 */}
                <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
                  <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">비밀번호 변경</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                        현재 비밀번호
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                          text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                          focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                        새 비밀번호
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                          text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                          focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                      />
                    </div>
                    <button className="px-6 py-3 rounded-lg font-medium
                      bg-[var(--secondary)] text-[var(--foreground)]
                      hover:bg-[var(--accent)] transition-colors">
                      비밀번호 변경
                    </button>
                  </div>
                </div>

                {/* 로그아웃 & 계정 삭제 */}
                <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
                  <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">계정</h2>
                  <div className="space-y-4">
                    <button
                      onClick={handleLogout}
                      className="w-full py-3 px-4 rounded-lg font-medium
                        bg-[var(--secondary)] text-[var(--foreground)]
                        hover:bg-[var(--accent)] transition-colors"
                    >
                      로그아웃
                    </button>
                    <button className="w-full py-3 px-4 rounded-lg font-medium
                      bg-red-500/10 text-red-500 border border-red-500/30
                      hover:bg-red-500/20 transition-colors">
                      계정 삭제
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

