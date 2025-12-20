'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/context'
import { useRouter } from 'next/navigation'

interface Character {
  id: string
  name: string
  avatar?: string
  personality: string
  description?: string
  isPublic: boolean
  createdAt: string
  chatCount?: number
}

export default function CharactersPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, token } = useAuth()

  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'my' | 'public'>('all')

  // 인증 체크
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [authLoading, isAuthenticated, router])

  // 캐릭터 목록 로드
  useEffect(() => {
    const loadCharacters = async () => {
      // TODO: 실제 API 호출
      // 샘플 데이터
      setCharacters([
        {
          id: '1',
          name: '친절한 비서',
          personality: '항상 친절하고 도움이 되는 AI 비서입니다.',
          description: '업무, 일정 관리, 질문 답변 등을 도와드립니다.',
          isPublic: true,
          createdAt: '2024-12-01',
          chatCount: 156,
        },
        {
          id: '2',
          name: '판타지 기사',
          personality: '명예를 중시하는 중세 기사 캐릭터입니다.',
          description: '모험과 전투 이야기를 나눌 수 있습니다.',
          isPublic: true,
          createdAt: '2024-12-05',
          chatCount: 89,
        },
        {
          id: '3',
          name: '츤데레 고양이',
          personality: '겉으로는 시크하지만 속으로는 다정한 고양이입니다.',
          description: '귀여운 대화를 나눠보세요.',
          isPublic: false,
          createdAt: '2024-12-10',
          chatCount: 42,
        },
      ])
      setIsLoading(false)
    }

    if (isAuthenticated) {
      loadCharacters()
    }
  }, [isAuthenticated, token])

  const filteredCharacters = characters.filter(char => {
    const matchesSearch = char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      char.personality.toLowerCase().includes(searchQuery.toLowerCase())

    if (filter === 'my') return matchesSearch && !char.isPublic
    if (filter === 'public') return matchesSearch && char.isPublic
    return matchesSearch
  })

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-[var(--card)]/80 backdrop-blur-lg border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-[var(--foreground)]">
              AI Character Chat
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/chat" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                채팅
              </Link>
              <Link href="/characters" className="text-[var(--primary)] font-medium">
                캐릭터
              </Link>
              <Link href="/settings" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                설정
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 페이지 제목 & 생성 버튼 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">캐릭터</h1>
            <p className="mt-1 text-[var(--muted-foreground)]">
              AI 캐릭터를 만들고 관리하세요
            </p>
          </div>
          <Link
            href="/characters/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white
              bg-gradient-to-r from-indigo-500 to-purple-600 
              hover:from-indigo-600 hover:to-purple-700
              transition-all duration-200 transform hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 캐릭터 만들기
          </Link>
        </div>

        {/* 검색 & 필터 */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* 검색 */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="캐릭터 검색..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
            />
          </div>

          {/* 필터 버튼 */}
          <div className="flex rounded-lg bg-[var(--secondary)] p-1 border border-[var(--border)]">
            {[
              { value: 'all', label: '전체' },
              { value: 'my', label: '내 캐릭터' },
              { value: 'public', label: '공개' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value as typeof filter)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all
                  ${filter === option.value
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 캐릭터 그리드 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[var(--muted)]" />
                  <div className="flex-1">
                    <div className="h-5 bg-[var(--muted)] rounded w-2/3 mb-2" />
                    <div className="h-4 bg-[var(--muted)] rounded w-1/3" />
                  </div>
                </div>
                <div className="h-4 bg-[var(--muted)] rounded mb-2" />
                <div className="h-4 bg-[var(--muted)] rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : filteredCharacters.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">캐릭터가 없습니다</h3>
            <p className="text-[var(--muted-foreground)] mb-6">
              첫 번째 AI 캐릭터를 만들어보세요!
            </p>
            <Link
              href="/characters/create"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
                bg-[var(--primary)] text-[var(--primary-foreground)]
                hover:opacity-90 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              캐릭터 만들기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCharacters.map((character) => (
              <div
                key={character.id}
                className="group bg-[var(--card)] rounded-xl border border-[var(--border)] p-6
                  hover:border-[var(--primary)]/50 hover:shadow-lg hover:shadow-[var(--primary)]/5
                  transition-all duration-300"
              >
                {/* 캐릭터 정보 */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                      flex items-center justify-center text-white text-2xl font-bold">
                      {character.avatar ? (
                        <img src={character.avatar} alt={character.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        character.name.charAt(0)
                      )}
                    </div>
                    {character.isPublic && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 
                        flex items-center justify-center border-2 border-[var(--card)]"
                        title="공개 캐릭터"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-[var(--foreground)] truncate">
                      {character.name}
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {character.chatCount || 0}회 대화
                    </p>
                  </div>
                </div>

                {/* 설명 */}
                <p className="text-sm text-[var(--muted-foreground)] line-clamp-2 mb-4">
                  {character.personality}
                </p>

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <Link
                    href={`/chat/${character.id}`}
                    className="flex-1 py-2 px-3 rounded-lg text-sm font-medium text-center
                      bg-[var(--primary)] text-[var(--primary-foreground)]
                      hover:opacity-90 transition-opacity"
                  >
                    대화하기
                  </Link>
                  <Link
                    href={`/characters/${character.id}/edit`}
                    className="py-2 px-3 rounded-lg text-sm font-medium
                      bg-[var(--secondary)] text-[var(--foreground)]
                      hover:bg-[var(--accent)] transition-colors"
                  >
                    수정
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}


