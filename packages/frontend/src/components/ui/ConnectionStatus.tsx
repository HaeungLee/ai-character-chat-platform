'use client'

/**
 * Socket 연결 상태 UI 컴포넌트
 * - 연결 상태 표시
 * - 재연결 버튼
 * - 다른 기기 로그인 알림
 */

import React from 'react'
import { ConnectionState } from '@/lib/types/socket'

interface ConnectionStatusProps {
  connectionState: ConnectionState
  reconnectAttempts?: number
  maxReconnectAttempts?: number
  lastError?: string | null
  onReconnect: () => void
  onDismiss?: () => void
  className?: string
}

export function ConnectionStatus({
  connectionState,
  reconnectAttempts = 0,
  maxReconnectAttempts = 10,
  lastError,
  onReconnect,
  onDismiss,
  className = '',
}: ConnectionStatusProps) {
  // 연결된 상태면 표시하지 않음
  if (connectionState === 'connected') {
    return null
  }

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connecting':
        return {
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          textColor: 'text-blue-400',
          icon: (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" cy="12" r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="none" 
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" 
              />
            </svg>
          ),
          message: '서버에 연결 중...',
          showReconnect: false,
        }

      case 'reconnecting':
        return {
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          textColor: 'text-amber-400',
          icon: (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" cy="12" r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="none" 
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" 
              />
            </svg>
          ),
          message: `재연결 시도 중... (${reconnectAttempts}/${maxReconnectAttempts})`,
          showReconnect: false,
        }

      case 'disconnected':
        return {
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          textColor: 'text-gray-400',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
              />
            </svg>
          ),
          message: lastError || '연결이 끊어졌습니다',
          showReconnect: true,
        }

      case 'failed':
        return {
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          textColor: 'text-red-400',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          ),
          message: lastError || '연결에 실패했습니다',
          showReconnect: true,
        }

      default:
        return null
    }
  }

  const config = getStatusConfig()
  if (!config) return null

  return (
    <div 
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-50
        px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm
        border ${config.borderColor} ${config.bgColor}
        flex items-center gap-3
        animate-slideDown
        ${className}
      `}
      role="alert"
    >
      {/* 아이콘 */}
      <div className={config.textColor}>
        {config.icon}
      </div>

      {/* 메시지 */}
      <p className={`text-sm font-medium ${config.textColor}`}>
        {config.message}
      </p>

      {/* 재연결 버튼 */}
      {config.showReconnect && (
        <button
          onClick={onReconnect}
          className={`
            ml-2 px-3 py-1.5 rounded-md text-sm font-medium
            bg-white/10 hover:bg-white/20 transition-colors
            ${config.textColor}
          `}
        >
          재연결
        </button>
      )}

      {/* 닫기 버튼 */}
      {onDismiss && connectionState !== 'reconnecting' && (
        <button
          onClick={onDismiss}
          className={`ml-1 p-1 rounded-full hover:bg-white/10 transition-colors ${config.textColor}`}
          aria-label="닫기"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * 다른 기기 로그인 알림 모달
 */
interface ConnectionReplacedModalProps {
  isOpen: boolean
  onClose: () => void
  onReconnect: () => void
}

export function ConnectionReplacedModal({
  isOpen,
  onClose,
  onReconnect,
}: ConnectionReplacedModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 max-w-sm mx-4 animate-scaleIn">
        {/* 아이콘 */}
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-amber-500/20 rounded-full">
            <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
        </div>

        {/* 제목 */}
        <h3 className="text-lg font-semibold text-white text-center mb-2">
          다른 기기에서 로그인됨
        </h3>

        {/* 설명 */}
        <p className="text-sm text-gray-400 text-center mb-6">
          다른 기기에서 같은 계정으로 로그인하여 현재 연결이 종료되었습니다.
        </p>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
              bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            확인
          </button>
          <button
            onClick={onReconnect}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
              bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            다시 연결
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 메시지 상태 인디케이터
 */
interface MessageStatusIndicatorProps {
  status: 'pending' | 'sent' | 'failed'
  onRetry?: () => void
  className?: string
}

export function MessageStatusIndicator({
  status,
  onRetry,
  className = '',
}: MessageStatusIndicatorProps) {
  switch (status) {
    case 'pending':
      return (
        <span className={`inline-flex items-center text-gray-400 ${className}`} title="전송 중...">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" cy="12" r="10" 
              stroke="currentColor" 
              strokeWidth="4" 
              fill="none" 
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" 
            />
          </svg>
        </span>
      )

    case 'sent':
      return (
        <span className={`inline-flex items-center text-green-400 ${className}`} title="전송됨">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
        </span>
      )

    case 'failed':
      return (
        <button
          onClick={onRetry}
          className={`inline-flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors ${className}`}
          title="전송 실패 - 클릭하여 재시도"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <span className="text-xs">재시도</span>
        </button>
      )

    default:
      return null
  }
}

