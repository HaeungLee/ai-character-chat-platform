'use client'

/**
 * 앱 전역 Provider
 */

import { ReactNode } from 'react'
import { AuthProvider, ThemeProvider } from '@/lib/context'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  )
}


