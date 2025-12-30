'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth, useTheme } from '@/lib/context'
import { useState, useEffect } from 'react'

export function Sidebar() {
    const pathname = usePathname()
    const { isAuthenticated } = useAuth()
    const { resolvedTheme, toggleTheme } = useTheme()
    const [isExpanded, setIsExpanded] = useState(false)
    const [mounted, setMounted] = useState(false)

    // Don't show on landing page or auth pages
    const isExcluded = pathname === '/' || pathname.startsWith('/auth')

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null
    if (!isAuthenticated || isExcluded) return null

    const navItems = [
        { name: '홈', href: '/characters', icon: '🏠' },
        { name: '채팅', href: '/chats', icon: '💬' },
        { name: '캐릭터 생성', href: '/characters/create', icon: '✨' },
        { name: '설정', href: '/settings', icon: '⚙️' },
    ]

    return (
        <motion.div
            initial={{ width: 80 }}
            animate={{ width: isExpanded ? 240 : 80 }}
            className="fixed left-0 top-0 h-full z-40 hidden md:flex flex-col
        glass-panel border-r border-[var(--border)]
        text-[var(--foreground)] transition-all duration-300"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            {/* Brand */}
            <div className="h-20 flex items-center justify-center border-b border-[var(--border)]/50">
                <div className={`
          flex items-center gap-3 transition-all duration-300
          ${isExpanded ? 'px-6 w-full' : 'justify-center'}
        `}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)]
            flex items-center justify-center text-white font-bold shrink-0 shadow-lg shadow-[var(--primary)]/20">
                        AI
                    </div>
                    {isExpanded && (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="font-bold text-lg whitespace-nowrap text-gradient"
                        >
                            Character Chat
                        </motion.span>
                    )}
                </div>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 flex flex-col gap-2 p-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                relative flex items-center gap-4 p-3 rounded-xl transition-all duration-200
                group overflow-hidden
                ${isActive
                                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50'}
              `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeNav"
                                    className="absolute left-0 w-1 h-6 bg-[var(--primary)] rounded-r-full"
                                />
                            )}

                            <span className="text-xl shrink-0 filter drop-shadow-sm">{item.icon}</span>

                            {isExpanded && (
                                <motion.span
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="font-medium whitespace-nowrap"
                                >
                                    {item.name}
                                </motion.span>
                            )}

                            {/* Glow effect for nebula theme */}
                            <div className="absolute inset-0 bg-[var(--primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                    )
                })}
            </nav>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[var(--border)]/50 flex flex-col gap-2">
                <button
                    onClick={toggleTheme}
                    className={`
                        flex items-center gap-3 w-full p-2 rounded-xl
                        text-[var(--muted-foreground)] hover:text-[var(--foreground)]
                        hover:bg-[var(--muted)]/50 transition-colors
                        ${isExpanded ? 'justify-start' : 'justify-center'}
                    `}
                    title="Change Theme"
                >
                    <div className="w-8 h-8 flex items-center justify-center">
                        {resolvedTheme === 'light' && (
                            <span className="text-xl">☀️</span>
                        )}
                        {resolvedTheme === 'dark' && (
                            <span className="text-xl">🌙</span>
                        )}
                        {resolvedTheme === 'nebula' && (
                            <span className="text-xl">🌌</span>
                        )}
                    </div>
                    {isExpanded && (
                        <span className="font-medium whitespace-nowrap">
                            {resolvedTheme === 'light' ? 'Light Mode' :
                                resolvedTheme === 'dark' ? 'Dark Mode' : 'Nebula Mode'}
                        </span>
                    )}
                </button>

                <button className={`
                    flex items-center gap-3 w-full p-2 rounded-xl
                    hover:bg-[var(--muted)]/50 transition-colors
                    ${isExpanded ? 'justify-start' : 'justify-center'}
                `}>
                    <div className="w-8 h-8 rounded-full bg-[var(--secondary)]/20 border border-[var(--secondary)]/50 overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] opacity-50" />
                    </div>
                    {isExpanded && (
                        <div className="flex flex-col items-start gap-1 overflow-hidden">
                            <span className="text-sm font-medium truncate w-full text-left">User Profile</span>
                            <span className="text-xs text-[var(--muted-foreground)]">Pro Plan</span>
                        </div>
                    )}
                </button>
            </div>
        </motion.div>
    )
}
