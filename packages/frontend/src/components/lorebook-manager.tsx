'use client'

import React, { useState } from 'react'

export interface LorebookEntryData {
    id: string
    keys: string[]
    content: string
}

interface LorebookManagerProps {
    entries: LorebookEntryData[]
    onChange: (entries: LorebookEntryData[]) => void
}

export function LorebookManager({ entries, onChange }: LorebookManagerProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [currentEntry, setCurrentEntry] = useState<LorebookEntryData>({
        id: '',
        keys: [],
        content: ''
    })
    const [keyInput, setKeyInput] = useState('')

    const handleAddKey = () => {
        if (keyInput.trim() && !currentEntry.keys.includes(keyInput.trim())) {
            setCurrentEntry(prev => ({
                ...prev,
                keys: [...prev.keys, keyInput.trim()]
            }))
            setKeyInput('')
        }
    }

    const handleRemoveKey = (keyToRemove: string) => {
        setCurrentEntry(prev => ({
            ...prev,
            keys: prev.keys.filter(k => k !== keyToRemove)
        }))
    }

    const handleSaveEntry = () => {
        if (!currentEntry.content.trim()) return

        if (currentEntry.id) {
            // Edit existing
            onChange(entries.map(e => e.id === currentEntry.id ? currentEntry : e))
        } else {
            // Add new
            onChange([...entries, { ...currentEntry, id: crypto.randomUUID() }])
        }

        resetForm()
    }

    const handleDeleteEntry = (id: string) => {
        onChange(entries.filter(e => e.id !== id))
    }

    const handleEditEntry = (entry: LorebookEntryData) => {
        setCurrentEntry(entry)
        setIsEditing(true)
    }

    const resetForm = () => {
        setCurrentEntry({ id: '', keys: [], content: '' })
        setKeyInput('')
        setIsEditing(false)
    }

    return (
        <div className="space-y-6">
            {/* List of existing entries */}
            <div className="space-y-3">
                {entries.map(entry => (
                    <div key={entry.id} className="bg-[var(--secondary)] rounded-lg p-4 border border-[var(--border)] group relative">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button
                                onClick={() => handleEditEntry(entry)}
                                className="p-1 hover:text-[var(--primary)]"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="p-1 hover:text-red-500"
                            >
                                🗑️
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {entry.keys.map(key => (
                                <span key={key} className="text-xs px-2 py-1 rounded bg-[var(--primary)]/20 text-[var(--primary)] font-medium">
                                    {key}
                                </span>
                            ))}
                        </div>
                        <p className="text-sm text-[var(--foreground)] line-clamp-2">{entry.content}</p>
                    </div>
                ))}

                {entries.length === 0 && !isEditing && (
                    <div className="text-center py-8 text-[var(--muted-foreground)] bg-[var(--secondary)]/50 rounded-lg border-dashed border-2 border-[var(--border)]">
                        등록된 세계관 설정이 없습니다.
                        <br />
                        아래 버튼을 눌러 추가해주세요.
                    </div>
                )}
            </div>

            {/* Add/Edit Form */}
            {isEditing ? (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 animate-in fade-in slide-in-from-bottom-2">
                    <h3 className="font-bold text-[var(--foreground)] mb-4">{currentEntry.id ? '설정 편집' : '새 설정 추가'}</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                발동 키워드 <span className="text-[var(--muted-foreground)]">(엔터로 추가)</span>
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {currentEntry.keys.map(key => (
                                    <span key={key} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--primary)]/20 text-[var(--primary)] text-sm">
                                        {key}
                                        <button onClick={() => handleRemoveKey(key)} className="hover:text-red-500">×</button>
                                    </span>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={keyInput}
                                onChange={e => setKeyInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddKey()
                                    }
                                }}
                                placeholder="예: 마법학교, 교장선생님..."
                                className="w-full px-3 py-2 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                                설정 내용
                            </label>
                            <textarea
                                value={currentEntry.content}
                                onChange={e => setCurrentEntry(prev => ({ ...prev, content: e.target.value }))}
                                placeholder="키워드가 대화에 등장했을 때 AI가 기억해야 할 내용을 적어주세요."
                                rows={4}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
                            />
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                onClick={resetForm}
                                className="px-4 py-2 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveEntry}
                                disabled={!currentEntry.content || currentEntry.keys.length === 0}
                                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-3 border-2 border-dashed border-[var(--border)] rounded-xl text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all flex items-center justify-center gap-2"
                >
                    <span>+ 새로운 세계관 설정 추가</span>
                </button>
            )}
        </div>
    )
}
