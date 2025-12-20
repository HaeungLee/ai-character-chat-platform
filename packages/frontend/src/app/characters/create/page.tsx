'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/context'
import { LorebookManager, LorebookEntryData } from '@/components/lorebook-manager'
import { ExampleDialogueManager, DialoguePair } from '@/components/example-dialogue-manager'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

  // 이미지 생성 관련
  const [imagePrompt, setImagePrompt] = useState('')
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  // 확장 기능 데이터
  const [lorebookEntries, setLorebookEntries] = useState<LorebookEntryData[]>([])
  const [exampleDialogues, setExampleDialogues] = useState<DialoguePair[]>([])

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

  // 이미지 생성 핸들러 (Mock)
  const handleGenerateImage = async () => {
    if (!imagePrompt) return
    setIsGeneratingImage(true)
    // TODO: 실제 API 연동 (OpenRouter/StableDiffusion)
    setTimeout(() => {
      setGeneratedImage(`https://api.dicebear.com/7.x/bottts/svg?seed=${imagePrompt}`) // 임시: Dicebear
      setIsGeneratingImage(false)
    }, 2000)
  }

  // 폼 제출
  const handleSubmit = async () => {
    setError('')
    setIsLoading(true)

    try {
      if (!token) {
        throw new Error('인증이 필요합니다. 다시 로그인해주세요.')
      }

      const payload = {
        name,
        personality,
        systemPrompt,
        greeting,
        isPublic,
        tags,
        avatar: generatedImage,
        lorebook: lorebookEntries,
        examples: exampleDialogues,
        // TODO: Backend should handle parsing examples into few-shot prompt
      }

      const response = await fetch(`${API_URL}/api/characters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || data?.message || '캐릭터 생성에 실패했습니다.')
      }

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
    if (step === 4) return true // Lorebook & Examples are optional
    return true
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20">
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
            <span className="text-sm font-medium text-[var(--muted-foreground)]">
              {step} / 5 단계
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* 진행 표시 */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex-1 flex items-center">
              <div className={`flex-1 h-2 rounded-full transition-all ${s <= step ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
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

        {/* Step 1: 기본 정보 & 이미지 */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                캐릭터의 모습을 상상해보세요
              </h2>
              <p className="text-[var(--muted-foreground)]">
                이름과 외모를 결정합니다. AI가 이미지를 그려줄 수 있습니다.
              </p>
            </div>

            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 space-y-6">
              {/* 이름 입력 */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  캐릭터 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 엘프 궁수, 친절한 옆집 누나..."
                  maxLength={30}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                    text-[var(--foreground)] placeholder-[var(--muted-foreground)] text-lg
                    focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                />
              </div>

              {/* 이미지 생성 */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  프로필 이미지 생성
                </label>
                <div className="flex gap-4 items-start">
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="이미지 묘사를 입력하세요 (예: 은발의 엘프, 숲 배경, 신비로운 분위기, 애니메이션 스타일)"
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                        text-[var(--foreground)] placeholder-[var(--muted-foreground)] text-sm
                        focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all resize-none"
                    />
                    <button
                      onClick={handleGenerateImage}
                      disabled={!imagePrompt || isGeneratingImage}
                      className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                    >
                      {isGeneratingImage ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          그리는 중...
                        </>
                      ) : (
                        <>🎨 AI로 그리기</>
                      )}
                    </button>
                  </div>

                  {/* 이미지 프리뷰 */}
                  <div className="w-32 h-32 rounded-xl bg-[var(--secondary)] border border-[var(--border)] overflow-hidden flex-shrink-0 relative group">
                    {generatedImage ? (
                      <img src={generatedImage} alt="Character" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[var(--muted-foreground)] text-xs p-2 text-center">
                        <span className="text-2xl mb-1">🖼️</span>
                        <span>이미지 없음</span>
                      </div>
                    )}
                    {generatedImage && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer text-white text-xs" onClick={() => setGeneratedImage(null)}>
                        삭제
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 성격 */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                어떤 성격인가요?
              </h2>
              <p className="text-[var(--muted-foreground)]">
                기본적인 성격 템플릿을 선택하거나 직접 설명해주세요.
              </p>
            </div>

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

            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                성격 상세 설명 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="캐릭터의 성격, 말투, 습관 등을 자세히 적어주세요."
                rows={6}
                className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                  text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 3: 프롬프트 & 인사말 */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                AI 행동 지침 (프롬프트)
              </h2>
              <p className="text-[var(--muted-foreground)]">
                AI모델에게 직접 전달될 명령(System Prompt)입니다. 가장 중요합니다.
              </p>
            </div>

            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  시스템 프롬프트 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={`예시:
당신은 "${name}"입니다. ${personality}

상황 설정을 여기에 적으세요.
대화체는 ~해요 체를 사용하세요.`}
                  rows={10}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                    text-[var(--foreground)] placeholder-[var(--muted-foreground)] font-mono text-sm
                    focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  첫 인사말
                </label>
                <textarea
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="대화방에 입장했을 때 캐릭터가 먼저 건네는 말"
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--secondary)] border border-[var(--border)]
                    text-[var(--foreground)] placeholder-[var(--muted-foreground)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: 지식 & 스타일 (Lorebook & Few-shot) */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                지식과 대화 스타일
              </h2>
              <p className="text-[var(--muted-foreground)]">
                캐릭터만의 세계관(Lorebook)과 말투 예시를 설정하여 퀄리티를 높입니다.
              </p>
            </div>

            <div className="space-y-6">
              {/* Lorebook */}
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
                <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                  📖 세계관 설정 (Lorebook)
                  <span className="text-xs font-normal px-2 py-0.5 rounded bg-[var(--primary)]/20 text-[var(--primary)]">
                    Trigger word 방식
                  </span>
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                  특정 단어가 대화에 나오면 AI에게 주입할 기억을 설정합니다. (예: '마법' 단어 → 마법 시스템 설명)
                </p>
                <LorebookManager entries={lorebookEntries} onChange={setLorebookEntries} />
              </div>

              {/* Few-shot Examples */}
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
                <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                  💬 대화 예제 (Few-shot)
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                  캐릭터가 어떻게 말해야 하는지 예시를 보여주세요. 말투 교정에 가장 효과적입니다.
                </p>
                <ExampleDialogueManager examples={exampleDialogues} onChange={setExampleDialogues} />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: 최종 확인 */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                거의 다 되었습니다!
              </h2>
              <p className="text-[var(--muted-foreground)]">
                마지막으로 설정을 확인하고 캐릭터를 생성합니다.
              </p>
            </div>

            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-[var(--primary)]/10 to-transparent border-b border-[var(--border)] flex items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-[var(--secondary)] border-4 border-[var(--card)] shadow-xl overflow-hidden flex-shrink-0">
                  {generatedImage ? (
                    <img src={generatedImage} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[var(--foreground)]">{name}</h3>
                  <div className="flex gap-2 mt-2">
                    {isPublic ? (
                      <span className="px-2 py-1 rounded bg-green-500/20 text-green-500 text-xs font-bold">PUBLIC</span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-500 text-xs font-bold">PRIVATE</span>
                    )}
                    <span className="px-2 py-1 rounded bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-bold">
                      {tags.length} Tags
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h4 className="font-bold text-[var(--muted-foreground)] text-sm uppercase mb-2">성격</h4>
                  <p className="text-[var(--foreground)]">{personality}</p>
                </div>

                <div>
                  <h4 className="font-bold text-[var(--muted-foreground)] text-sm uppercase mb-2">첫 인사</h4>
                  <p className="text-[var(--foreground)] italic">"{greeting}"</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-[var(--secondary)]">
                    <span className="block text-2xl font-bold text-[var(--foreground)]">{lorebookEntries.length}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">세계관 설정</span>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--secondary)]">
                    <span className="block text-2xl font-bold text-[var(--foreground)]">{exampleDialogues.length}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">대화 예제</span>
                  </div>
                </div>

                {/* 태그 입력 및 공개 설정 확인 */}
                <div className="pt-6 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold">공개 설정</span>
                    <button
                      onClick={() => setIsPublic(!isPublic)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${isPublic ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                        }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                    </button>
                  </div>

                  <div>
                    <span className="block font-bold mb-2">태그</span>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="px-3 py-1 bg-[var(--secondary)] rounded-full text-sm">#{tag}</span>
                      ))}
                      <input
                        type="text"
                        placeholder="+ 태그 추가"
                        className="bg-transparent text-sm focus:outline-none min-w-[100px]"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddTag()
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 네비게이션 버튼 */}
        <div className="flex gap-4 mt-12 sticky bottom-6 z-30">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 rounded-xl font-medium shadow-lg backdrop-blur-md
                bg-[var(--card)]/90 text-[var(--foreground)] border border-[var(--border)]
                hover:bg-[var(--accent)] transition-colors"
            >
              이전
            </button>
          )}

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 py-3 px-6 rounded-xl font-medium text-white shadow-lg shadow-indigo-500/20
                bg-gradient-to-r from-indigo-500 to-purple-600 
                hover:from-indigo-600 hover:to-purple-700
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              다음 단계로 ({step}/5)
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 py-3 px-6 rounded-xl font-bold text-white shadow-lg shadow-pink-500/20
                bg-gradient-to-r from-pink-500 to-indigo-600 
                hover:from-pink-600 hover:to-indigo-700
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? '캐릭터 생성 중...' : '✨ 캐릭터 완성하기'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
