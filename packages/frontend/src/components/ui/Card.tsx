import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  const baseClasses = 'bg-white border border-gray-200 rounded-lg shadow-sm'

  const hoverClasses = hover
    ? 'hover:shadow-md hover:border-gray-300 transition-all cursor-pointer'
    : ''

  const clickableClasses = onClick ? 'cursor-pointer' : ''

  const classes = `
    ${baseClasses}
    ${paddingClasses[padding]}
    ${hoverClasses}
    ${clickableClasses}
    ${className}
  `.trim()

  return (
    <div
      className={classes}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
  children
}) => {
  return (
    <div className={`flex items-center justify-between pb-3 border-b border-gray-200 ${className}`}>
      {children ? (
        <div className="flex-1">{children}</div>
      ) : (
        <div>
          {title && <h3 className="text-lg font-medium text-gray-900">{title}</h3>}
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      )}
      {action && (
        <div>{action}</div>
      )}
    </div>
  )
}

interface CardContentProps {
  children: React.ReactNode
  className?: string
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`pt-3 ${className}`}>
      {children}
    </div>
  )
}
