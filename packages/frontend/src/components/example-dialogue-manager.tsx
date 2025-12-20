'use client'

import React, { useState } from 'react'

export interface DialoguePair {
    id: string
    user: string
    assistant: string
}

interface ExampleDialogueManagerProps {
    examples: DialoguePair[]
    onChange: (examples: DialoguePair[]) => void
}

export function ExampleDialogueManager({ examples, onChange }: ExampleDialogueManagerProps) {
    const handleAdd = () => {
        onChange([...examples, { id: crypto.randomUUID(), user: '', assistant: '' }])
    }

    const handleChange = (id: string, field: 'user' | 'assistant', value: string) => {
        onChange(examples.map(ex => ex.id === id ? { ...ex, [field]: value } : ex))
    }

    const handleRemove = (id: string) => {
        onChange(examples.filter(ex => ex.id !== id))
    }

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                {examples.map((ex, index) => (
                    <div key={ex.id} className="relative bg-[var(--secondary)]/50 rounded-xl p-4 border border-[var(--border)]">
                        <div className="absolute top-2 right-2">
                            <button
                                onClick={() => handleRemove(ex.id)}
                                className="text-[var(--muted-foreground)] hover:text-red-500 p-1"
                                title="삭제"
                            >
                                ✕
                            </button>
                        </div>

                        <span className="text-xs font-mono text-[var(--muted-foreground)] mb-2 block">
                            Example #{index + 1}
                        </span>

                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0">
                                    👤
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={ex.user}
                                        onChange={(e) => handleChange(ex.id, 'user', e.target.value)}
                                        placeholder="사용자 질문 (예: 안녕?)"
                                        className="w-full bg-transparent border-b border-[var(--border)] focus:border-[var(--primary)] focus:outline-none py-1 text-[var(--foreground)]"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 text-white text-xs">
                                    AI
                                </div>
                                <div className="flex-1">
                                    <textarea
                                        value={ex.assistant}
                                        onChange={(e) => handleChange(ex.id, 'assistant', e.target.value)}
                                        placeholder="캐릭터 답변 (예: 반가워요! 무엇을 도와드릴까요?)"
                                        rows={2}
                                        className="w-full bg-transparent border-b border-[var(--border)] focus:border-[var(--primary)] focus:outline-none py-1 text-[var(--foreground)] resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={handleAdd}
                className="w-full py-3 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors flex items-center justify-center gap-2"
            >
                <span>+ 대화 예시 추가</span>
            </button>

            {examples.length === 0 && (
                <p className="text-center text-sm text-[var(--muted-foreground)]">
                    예제 대화를 추가하면 캐릭터가 말투를 더 잘 학습합니다.
                </p>
            )}
        </div>
    )
}
