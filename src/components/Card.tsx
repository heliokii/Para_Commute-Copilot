import type { HTMLAttributes, ReactNode } from 'react'

const TONES = {
  cream: 'surface bg-surface-cream text-ink-dark shadow-card',
  warm: 'surface bg-surface-warm text-ink-dark shadow-card',
  /** Translucent panel on the brown backdrop. */
  deep: 'border border-line-on-deep bg-black/15 text-on-deep',
} as const

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof TONES
  children: ReactNode
}

export function Card({ tone = 'cream', className = '', children, ...rest }: CardProps) {
  return (
    <div className={`rounded-card ${TONES[tone]} ${className}`} {...rest}>
      {children}
    </div>
  )
}
