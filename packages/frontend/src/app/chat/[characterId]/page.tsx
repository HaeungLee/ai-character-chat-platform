'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageBubble } from '@/components/chat/message-bubble'
import { useAuth } from '@/lib/context'

// Mock Data Types
interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
}

export default function CharacterChatPage() {
    const params = useParams()
    const router = useRouter()
    const { isAuthenticated } = useAuth()
    const characterId = params.characterId as string

    // Mock State
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '안녕하세요! 당신과 대화하게 되어 기뻐요. 오늘 하루는 어떠셨나요?',
            timestamp: new Date().toISOString()
        }
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isTyping])

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!input.trim() || isTyping) return

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        }

        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsTyping(true)

        // Mock AI Response
        setTimeout(() => {
            const aiMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `[Mock Response] "${userMsg.content}"에 대한 반응입니다. \n\n(실제 LLM 연동 시 이곳에 답변이 스트리밍됩니다.)`,
                timestamp: new Date().toISOString()
            }
            setMessages(prev => [...prev, aiMsg])
            setIsTyping(false)
        }, 1500)
    }

    const handleEditMessage = (id: string, newContent: string) => {
        setMessages(prev => prev.map(msg =>
            msg.id === id ? { ...msg, content: newContent } : msg
        ))
        // If edited user message, technically we might want to regenerate the response after it.
        // implementing that logic here simply:
        const msgIndex = messages.findIndex(m => m.id === id)
        if (msgIndex !== -1 && messages[msgIndex].role === 'user') {
            const nextMsg = messages[msgIndex + 1]
            if (nextMsg && nextMsg.role === 'assistant') {
                // Option: Ask user if they want to regenerate? Or just do it?
                // For now, let's just update the text history. Use "Regenerate" on the AI msg to update response.
            }
        }
    }

    const handleRegenerate = (id: string) => {
        const msgIndex = messages.findIndex(m => m.id === id)
        if (msgIndex === -1) return

        // Remove this message and any following it? Or just replace content?
        // Standard UX: Replace content with loading state, then stream new.

        // For Mock:
        setIsTyping(true)
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content: '' } : m)) // Clear content

        setTimeout(() => {
            setMessages(prev => prev.map(m =>
                m.id === id ? { ...m, content: '(재생성된 답변) 이전보다 더 창의적인 답변입니다!' } : m
            ))
            setIsTyping(false)
        }, 1500)
    }

    return (
        <div className="flex h-screen bg-[var(--background)] overflow-hidden">
            {/* Sidebar (Optional/Collapsible) */}
            <aside className="w-80 border-r border-[var(--border)] bg-[var(--card)] hidden md:flex flex-col">
                <div className="p-4 border-b border-[var(--border)]">
                    <Link href="/characters" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-2 mb-4">
                        ← 나가기
                    </Link>
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mx-auto mb-4 flex items-center justify-center text-4xl text-white">
                        A
                    </div>
                    <h2 className="text-xl font-bold text-center text-[var(--foreground)]">AI Character</h2>
                    <p className="text-sm text-[var(--muted-foreground)] text-center mt-1">
                        "안녕하세요! 친절한 AI입니다."
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="p-3 bg-[var(--secondary)] rounded-lg text-sm">
                        <h3 className="font-bold mb-2">기억 (Memory)</h3>
                        <p className="text-[var(--muted-foreground)] text-xs">아직 생성된 기억이 없습니다.</p>
                    </div>
                </div>

                <div className="p-4 border-t border-[var(--border)] text-xs text-center text-[var(--muted-foreground)]">
                    User: {isAuthenticated ? 'LoggedIn' : 'Guest'}
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col relative">
                {/* Mobile Header */}
                <header className="md:hidden h-14 border-b border-[var(--border)] flex items-center px-4 justify-between bg-[var(--card)]">
                    <Link href="/characters" className="text-[var(--muted-foreground)]">←</Link>
                    <span className="font-bold">AI Character</span>
                    <div className="w-6" /> {/* Spacer */}
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                    <div className="flex-1" /> {/* Spacer to push messages down if few */}
                    <div className="max-w-3xl w-full mx-auto space-y-2">
                        {messages.map(msg => (
                            <MessageBubble
                                key={msg.id}
                                {...msg}
                                characterName="AI Character"
                                onEdit={handleEditMessage}
                                onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
                            />
                        ))}
                        {isTyping && (
                            <div className="flex justify-start w-full">
                                <div className="bg-[var(--card)] border border-[var(--border)] px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-[var(--muted-foreground)] flex items-center gap-2">
                                    <span className="animate-bounce">●</span>
                                    <span className="animate-bounce delay-100">●</span>
                                    <span className="animate-bounce delay-200">●</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[var(--background)]/80 backdrop-blur border-t border-[var(--border)]">
                    <div className="max-w-3xl mx-auto relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSendMessage()
                                }
                            }}
                            placeholder="메시지를 입력하세요... (Enter로 전송)"
                            className="w-full bg-[var(--secondary)] text-[var(--foreground)] rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] max-h-32 min-h-[52px]"
                            rows={1}
                        />
                        <button
                            onClick={() => handleSendMessage()}
                            disabled={!input.trim() || isTyping}
                            className="absolute right-2 bottom-2 p-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:bg-[var(--muted)] transition-all"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-[var(--muted-foreground)] mt-2">
                        AI는 부정확한 정보를 말할 수 있습니다.
                    </p>
                </div>
            </main>
        </div>
    )
}
