'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageBubble } from '@/components/chat/message-bubble'
import { useAuth } from '@/lib/context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Mock Data Types
interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    isStreaming?: boolean
}

interface CharacterInfo {
    id: string
    name: string
    avatar?: string | null
    personality?: string
    description?: string | null
    greeting?: string | null
}

export default function CharacterChatPage() {
    const params = useParams()
    const router = useRouter()
    const { isAuthenticated, isLoading: authLoading, token } = useAuth()
    const characterId = params.characterId as string

    const [character, setCharacter] = useState<CharacterInfo | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)

    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const activeStreamAbortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        return () => {
            activeStreamAbortRef.current?.abort()
            activeStreamAbortRef.current = null
        }
    }, [])

    const streamSse = async (args: {
        characterId: string
        message: string
        token: string
        conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
        onStart?: () => void
        onChunk: (chunk: string) => void
        onDone?: (full: string) => void
    }) => {
        // Cancel any in-flight stream to avoid interleaved UI updates.
        activeStreamAbortRef.current?.abort()
        const abortController = new AbortController()
        activeStreamAbortRef.current = abortController

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        const MAX_RETRIES = 1
        const RETRY_DELAY_MS = 400

        let started = false
        let lastError: unknown = null

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (abortController.signal.aborted) {
                args.onDone?.('')
                return
            }

            let emittedAnyChunk = false
            let response: Response
            try {
                response = await fetch(`${API_URL}/api/ai/chat/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${args.token}`,
                    },
                    body: JSON.stringify({
                        characterId: args.characterId,
                        message: args.message,
                        conversationHistory: args.conversationHistory,
                        provider: 'openrouter',
                    }),
                    signal: abortController.signal,
                })
            } catch (e) {
                const err = e as unknown as { name?: string }
                if (err?.name === 'AbortError') {
                    args.onDone?.('')
                    return
                }
                lastError = e
                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS)
                    continue
                }
                throw e
            }

            try {
                if (!response.ok) {
                    const text = await response.text().catch(() => '')
                    throw new Error(text || `스트리밍 요청 실패 (${response.status})`)
                }

                if (!response.body) {
                    throw new Error('스트리밍 응답을 받을 수 없습니다.')
                }

                if (!started) {
                    started = true
                    args.onStart?.()
                }

                const reader = response.body.getReader()
                const decoder = new TextDecoder('utf-8')
                let buffer = ''
                let full = ''

        const extractEventPayloads = (evtBlock: string): string[] => {
            // Supports multiline `data:` fields per SSE spec.
            const lines = evtBlock.split('\n')
            const dataLines: string[] = []
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trimStart())
                }
            }
            if (dataLines.length === 0) return []
            return [dataLines.join('\n')]
        }

                try {
                    while (true) {
                        const { value, done } = await reader.read()
                        if (done) break

                        buffer += decoder.decode(value, { stream: true })
                        buffer = buffer.replace(/\r\n/g, '\n')

                        // SSE event delimiter: blank line
                        const events = buffer.split('\n\n')
                        buffer = events.pop() ?? ''

                        for (const evt of events) {
                            const payloads = extractEventPayloads(evt)
                            for (const payloadRaw of payloads) {
                                const payload = payloadRaw.trim()
                                if (!payload) continue

                                if (payload === '[DONE]') {
                                    args.onDone?.(full)
                                    return
                                }

                                try {
                                    const parsed = JSON.parse(payload)
                                    if (parsed?.type === 'chunk' && typeof parsed?.content === 'string') {
                                        full += parsed.content
                                        emittedAnyChunk = true
                                        args.onChunk(parsed.content)
                                        continue
                                    }
                                    if (parsed?.type === 'done' && typeof parsed?.fullResponse === 'string') {
                                        args.onDone?.(parsed.fullResponse)
                                        return
                                    }
                                    if (parsed?.type === 'error') {
                                        throw new Error(parsed?.error || '스트리밍 중 오류가 발생했습니다.')
                                    }
                                } catch (e) {
                                    // Fallback: treat as raw text chunk (some servers send plain text)
                                    if (payload && payload !== '[DONE]') {
                                        full += payload
                                        emittedAnyChunk = true
                                        args.onChunk(payload)
                                    }
                                }
                            }
                        }
                    }

                    args.onDone?.(full)
                    return
                } catch (e) {
                    const err = e as unknown as { name?: string }
                    if (err?.name === 'AbortError') {
                        args.onDone?.(full)
                        return
                    }

                    // UX: only auto-retry if we haven't shown any partial output yet.
                    lastError = e
                    if (!emittedAnyChunk && attempt < MAX_RETRIES) {
                        await sleep(RETRY_DELAY_MS)
                        continue
                    }

                    throw e
                }
            } catch (e) {
                // Handle per-attempt errors (including non-OK response) with the same retry rule.
                lastError = e
                if (abortController.signal.aborted) {
                    args.onDone?.('')
                    return
                }
                if (attempt < MAX_RETRIES) {
                    await sleep(RETRY_DELAY_MS)
                    continue
                }
                throw e
            }
        }

        throw lastError ?? new Error('스트리밍 실패')
    }

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isTyping])

    // 인증 체크
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/auth/login')
        }
    }, [authLoading, isAuthenticated, router])

    // 캐릭터 로드
    useEffect(() => {
        const loadCharacter = async () => {
            if (!token || !characterId) return
            setLoadError(null)
            try {
                const response = await fetch(`${API_URL}/api/characters/${characterId}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    }
                })
                const data = await response.json()
                if (!response.ok) throw new Error(data?.error || data?.message || '캐릭터를 불러오지 못했습니다.')

                setCharacter(data.data)

                // 초기 인사 메시지 1회 세팅
                setMessages(prev => {
                    if (prev.length) return prev
                    return [
                        {
                            id: crypto.randomUUID(),
                            role: 'assistant',
                            content: data?.data?.greeting || '안녕하세요! 무엇을 도와드릴까요?',
                            timestamp: new Date().toISOString(),
                        }
                    ]
                })
            } catch (e) {
                setLoadError(e instanceof Error ? e.message : '캐릭터 로드 실패')
            }
        }

        if (isAuthenticated) {
            loadCharacter()
        }
    }, [isAuthenticated, token, characterId])

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!input.trim() || isTyping) return
        if (!token) return

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        }

        // If anything was streaming, stop the cursor before sending a new request.
        setMessages(prev => [...prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m), userMsg])
        setInput('')
        setIsTyping(true)

        const assistantId = crypto.randomUUID()
        setMessages(prev => [...prev, {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: true,
        }])

        try {
            const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = messages
                .slice(-20)
                .map((m): { role: 'user' | 'assistant'; content: string } => ({ role: m.role, content: m.content }))

            await streamSse({
                characterId,
                message: userMsg.content,
                token,
                conversationHistory,
                onChunk: (chunk) => {
                    setMessages(prev => prev.map(m => m.id === assistantId
                        ? { ...m, content: (m.content || '') + chunk }
                        : m
                    ))
                },
                onDone: () => {
                    setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, isStreaming: false } : m))
                }
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'AI 호출 실패'
            setMessages(prev => prev.map(m => m.id === assistantId
                ? { ...m, content: `오류: ${msg}`, isStreaming: false }
                : m
            ))
        } finally {
            setIsTyping(false)
        }
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
        if (isTyping) return

        const msgIndex = messages.findIndex(m => m.id === id)
        if (msgIndex === -1) return

        if (!token) {
            setMessages(prev => prev.map(m => m.id === id ? { ...m, content: '오류: 인증이 필요합니다. 다시 로그인해주세요.' } : m))
            return
        }

        // Cancel any in-flight stream before starting a new one.
        activeStreamAbortRef.current?.abort()

        // 재생성은 "바로 직전 user 메시지"를 기준으로 다시 생성합니다.
        // (해당 AI 메시지 이후의 대화는 무효화될 수 있으므로 기본적으로 잘라냅니다.)
        const prevUserIndex = (() => {
            for (let i = msgIndex - 1; i >= 0; i--) {
                if (messages[i]?.role === 'user') return i
            }
            return -1
        })()

        if (prevUserIndex === -1) {
            setMessages(prev => prev.map(m => m.id === id ? { ...m, content: '오류: 재생성할 기준 사용자 메시지를 찾을 수 없습니다.' } : m))
            return
        }

        const userMessage = messages[prevUserIndex].content

        // 이 AI 메시지까지는 유지하고, 그 뒤는 잘라내는 UX
        setIsTyping(true)
        setMessages(prev => {
            const indexInPrev = prev.findIndex(m => m.id === id)
            if (indexInPrev === -1) return prev
            const truncated = prev.slice(0, indexInPrev + 1)
            truncated[indexInPrev] = { ...truncated[indexInPrev], content: '', isStreaming: true }
            return truncated
        })

        ;(async () => {
            try {
                // 재생성 시 히스토리는 해당 user 메시지 이전까지(최대 20개)
                const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = messages
                    .slice(0, prevUserIndex)
                    .slice(-20)
                    .map((m): { role: 'user' | 'assistant'; content: string } => ({ role: m.role, content: m.content }))

                await streamSse({
                    characterId,
                    message: userMessage,
                    token,
                    conversationHistory,
                    onChunk: (chunk) => {
                        setMessages(prev => prev.map(m => m.id === id
                            ? { ...m, content: (m.content || '') + chunk }
                            : m
                        ))
                    },
                    onDone: () => {
                        setMessages(prev => prev.map(m => m.id === id ? { ...m, isStreaming: false } : m))
                    }
                })
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'AI 재생성 실패'
                setMessages(prev => prev.map(m => m.id === id ? { ...m, content: `오류: ${msg}`, isStreaming: false } : m))
            } finally {
                setIsTyping(false)
            }
        })()
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
                        {character?.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={character.avatar} alt={character.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            (character?.name || 'A').charAt(0)
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-center text-[var(--foreground)]">{character?.name || 'AI Character'}</h2>
                    <p className="text-sm text-[var(--muted-foreground)] text-center mt-1">
                        {character?.description ? `"${character.description}"` : '"안녕하세요! 친절한 AI입니다."'}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="p-3 bg-[var(--secondary)] rounded-lg text-sm">
                        <h3 className="font-bold mb-2">기억 (Memory)</h3>
                        <p className="text-[var(--muted-foreground)] text-xs">아직 생성된 기억이 없습니다.</p>
                    </div>

                    {loadError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-500">
                            {loadError}
                        </div>
                    )}
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
                    <span className="font-bold">{character?.name || 'AI Character'}</span>
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
                                characterName={character?.name || 'AI Character'}
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
