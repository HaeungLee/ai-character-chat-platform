'use client'

import React, { useState } from 'react'

export interface MessageProps {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    characterName?: string
    isStreaming?: boolean
    onEdit?: (id: string, newContent: string) => void
    onRegenerate?: (id: string) => void
}

export function MessageBubble({
    id,
    role,
    content,
    timestamp,
    characterName,
    isStreaming,
    onEdit,
    onRegenerate
}: MessageProps) {
    const [isHovered, setIsHovered] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editContent, setEditContent] = useState(content)

    const handleSaveEdit = () => {
        if (editContent.trim() !== content) {
            onEdit?.(id, editContent)
        }
        setIsEditing(false)
    }

    const handleCancelEdit = () => {
        setEditContent(content)
        setIsEditing(false)
    }

    return (
        <div
            className={`group flex w-full mb-4 ${role === 'user' ? 'justify-end' : 'justify-start'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`relative max-w-[85%] sm:max-w-[75%] flex gap-3 ${role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar (Placeholder) */}
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm mt-1
          ${role === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                        : 'bg-gradient-to-br from-rose-400 to-orange-400 text-white'
                    }`}
                >
                    {role === 'user' ? 'U' : characterName?.charAt(0) || 'A'}
                </div>

                {/* Bubble */}
                <div className="flex flex-col gap-1 min-w-0">
                    <div className={`flex items-baseline gap-2 ${role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-sm font-medium text-[var(--foreground)] opacity-90">
                            {role === 'user' ? 'You' : characterName || 'Character'}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    <div
                        className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap transition-shadow shadow-sm
              ${role === 'user'
                                ? 'bg-[var(--primary)] text-white rounded-tr-sm'
                                : 'bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-tl-sm'
                            }
              ${isEditing ? 'ring-2 ring-[var(--ring)]' : ''}
            `}
                    >
                        {isEditing ? (
                            <div className="min-w-[200px]">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-inherit resize-none"
                                    rows={Math.max(2, editContent.split('\n').length)}
                                    autoFocus
                                />
                                <div className="flex gap-2 justify-end mt-2">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="text-xs opacity-70 hover:opacity-100"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30"
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {content}
                                {isStreaming && (
                                    <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current animate-pulse" />
                                )}
                            </>
                        )}
                    </div>

                    {/* Action Buttons (Visible on Hover) */}
                    {!isEditing && !isStreaming && (
                        <div className={`flex gap-2 text-[var(--muted-foreground)] text-xs transition-opacity duration-200 px-1
              ${isHovered ? 'opacity-100' : 'opacity-0'}
              ${role === 'user' ? 'justify-end' : 'justify-start'}
            `}>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="hover:text-[var(--foreground)] flex items-center gap-1"
                                title="메시지 수정"
                            >
                                ✎ 수정
                            </button>
                            {role === 'assistant' && onRegenerate && (
                                <button
                                    onClick={() => onRegenerate(id)}
                                    className="hover:text-[var(--foreground)] flex items-center gap-1"
                                    title="다른 답변 받기"
                                >
                                    ↻ 재생성
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
