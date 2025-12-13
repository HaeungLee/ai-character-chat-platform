'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/context'

// 성격 프리셋
const PERSONALITY_PRESETS = [
  { id: 'friendly', label: '친근함', emoji: '😊', description: '따뜻하고 다정한 성격' },
  { id: 'professional', label: '전문적', emoji: '💼', description: '격식있고 정중한 성격' },
  { id: 'playful', label: '장난스러움', emoji: '😜', description: '유머러스하고 활발한 성격' },
  { id: 'mysterious', label: '신비로움', emoji: '🔮', description: '차분하고 깊이있는 성격' },
  { id: 'tsundere', label: '츤데레', emoji: '😤', description: '겉으로는 시크하지만 속은 따뜻' },
  { id: 'romantic', label: '로맨틱', emoji: '💕', description: '감성적이고 다정한 성격' },
]

export default function CreateCharacterPage() {
  const router = useRouter()
  const { isAuthenticated, token } = useAuth()
  
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 폼 데이터
  const [name, setName] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [personality, setPersonality] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [greeting, setGreeting] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // 프리셋 선택 시 기본값 설정
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId)
    const preset = PERSONALITY_PRESETS.find(p => p.id === presetId)
    if (preset) {
      setPersonality(preset.description)
    }
  }

  // 태그 추가
  const handleAddTag = () => {
    if (tagInput.trim() && tags.length < 5 && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  // 태그 삭제
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  // 폼 제출
  const handleSubmit = async () => {
    setError('')
    setIsLoading(true)

    try {
      // TODO: 실제 API 호출
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      router.push('/characters')
    } catch (err) {
      setError(err instanceof Error ? err.message : '캐릭터 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 다음 단계 검증
  const canProceed = () => {
    if (step === 1) return name.trim().length >= 2
    if (step === 2) return personality.trim().length >= 10
    if (step === 3) return systemPrompt.trim().length >= 20
    return true
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-[var(--card)]/80 backdrop-blur-lg border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/characters" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              돌아가기
            </Link>
            <span className="text-sm text-[var(--muted-foreground)]">
              {step} / 4 단계
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* 진행 표시 */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex-1 flex items-center">
              <div className={`flex-1 h-2 rounded-full transition-all ${
                s <= step ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
              }`} />
            </div>
          ))}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: 기본 정보 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                캐릭터 이름을 정해주세요
              </h2>
              <p className="text-[var(--muted-foreground)]">
                AI 캐릭터의 이름은 대화에서 사용됩니다.
              </p>
            </div>

            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                캐릭터 이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 친절한 비서, 판타지 기사, 귀여운 고양이..."
                maxLength={30}
                className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                  text-[var(--foreground)] placeholder-[var(--muted-foreground)] text-lg
                  focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
              />
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                {name.length}/30자
              </p>
            </div>

            {/* 캐릭터 아바타 미리보기 */}
            {name && (
              <div className="flex items-center gap-4 p-4 bg-[var(--secondary)] rounded-lg">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                  flex items-center justify-center text-white text-2xl font-bold">
                  {name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-[var(--foreground)]">{name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">AI 캐릭터</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 성격 */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                성격을 선택해주세요
              </h2>
              <p className="text-[var(--muted-foreground)]">
                프리셋을 선택하거나 직접 작성할 수 있습니다.
              </p>
            </div>

            {/* 성격 프리셋 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PERSONALITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-4 rounded-xl border text-left transition-all
                    ${selectedPreset === preset.id 
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]' 
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50'
                    }`}
                >
                  <span className="text-2xl mb-2 block">{preset.emoji}</span>
                  <span className="font-medium text-[var(--foreground)] block">{preset.label}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">{preset.description}</span>
                </button>
              ))}
            </div>

            {/* 커스텀 성격 */}
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                성격 설명
              </label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="캐릭터의 성격을 자세히 설명해주세요..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                  text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all resize-none"
              />
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                최소 10자 이상 작성해주세요
              </p>
            </div>
          </div>
        )}

        {/* Step 3: 시스템 프롬프트 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                행동 지침을 작성해주세요
              </h2>
              <p className="text-[var(--muted-foreground)]">
                AI가 어떻게 행동할지 상세한 지침을 작성합니다.
              </p>
            </div>

            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  시스템 프롬프트
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={`예시:
당신은 "${name}"입니다. ${personality}

대화 규칙:
- 항상 한국어로 답변합니다
- 이모지를 적절히 사용합니다
- 사용자의 감정에 공감합니다`}
                  rows={8}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                    text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all resize-none
                    font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  첫 인사말 <span className="text-[var(--muted-foreground)]">(선택)</span>
                </label>
                <textarea
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="대화 시작 시 캐릭터가 먼저 건네는 인사말..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                    text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all resize-none"
                />
              </div>
            </div>

            {/* 팁 */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <h4 className="font-medium text-blue-400 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                작성 팁
              </h4>
              <ul className="text-sm text-blue-300 space-y-1">
                <li>• 캐릭터의 말투와 성격을 구체적으로 작성하세요</li>
                <li>• 대화 상황별 행동 규칙을 정해주면 좋습니다</li>
                <li>• 캐릭터의 배경 스토리를 추가하면 더 생동감있습니다</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 4: 공개 설정 */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                마지막 설정
              </h2>
              <p className="text-[var(--muted-foreground)]">
                공개 여부와 태그를 설정합니다.
              </p>
            </div>

            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 space-y-6">
              {/* 공개 설정 */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--foreground)]">공개 캐릭터</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    다른 사용자들이 이 캐릭터와 대화할 수 있습니다
                  </p>
                </div>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    isPublic ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                  }`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    isPublic ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* 태그 */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  태그 <span className="text-[var(--muted-foreground)]">(최대 5개)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm
                        bg-[var(--primary)]/20 text-[var(--primary)]"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-400"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="태그 입력..."
                    maxLength={15}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                      text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!tagInput.trim() || tags.length >= 5}
                    className="px-4 py-2 rounded-lg bg-[var(--secondary)] text-[var(--foreground)]
                      hover:bg-[var(--accent)] transition-colors disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>

            {/* 최종 미리보기 */}
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
              <h4 className="font-medium text-[var(--foreground)] mb-4">미리보기</h4>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                  flex items-center justify-center text-white text-3xl font-bold">
                  {name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--foreground)]">{name}</h3>
                  <p className="text-[var(--muted-foreground)]">{personality}</p>
                  <div className="flex gap-2 mt-2">
                    {isPublic && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        공개
                      </span>
                    )}
                    {tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 네비게이션 버튼 */}
        <div className="flex gap-4 mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 rounded-lg font-medium
                bg-[var(--secondary)] text-[var(--foreground)]
                hover:bg-[var(--accent)] transition-colors"
            >
              이전
            </button>
          )}
          
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 py-3 px-6 rounded-lg font-medium text-white
                bg-gradient-to-r from-indigo-500 to-purple-600 
                hover:from-indigo-600 hover:to-purple-700
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all"
            >
              다음
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 py-3 px-6 rounded-lg font-medium text-white
                bg-gradient-to-r from-pink-500 to-indigo-600 
                hover:from-pink-600 hover:to-indigo-700
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  생성 중...
                </span>
              ) : (
                '캐릭터 생성'
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

