'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/lib/context'
import { useEffect, useState } from 'react'

export function Shell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { isAuthenticated } = useAuth()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Logic must match Sidebar.tsx exclusion
    const isExcluded = pathname === '/' || pathname.startsWith('/auth')
    const showSidebar = mounted && isAuthenticated && !isExcluded

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main
                className={`
          flex-1 transition-all duration-300 
          ${showSidebar ? 'md:pl-20' : ''}
        `}
            >
                {children}
            </main>
        </div>
    )
}
