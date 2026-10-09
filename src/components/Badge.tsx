import type { ReactNode } from 'react'

const TONES = {
  /** Data caveats: unverified, simulated, sample. */
  caution: 'border border-accent-terracotta/60 bg-accent-terracotta/10 text-ink-dark',
  /** Neutral labels such as the preference a card answers. */
  label: 'bg-surface-warm text-ink-dark',
  strong: 'bg-brown-mid text-surface-cream',
} as const

interface BadgeProps {
  tone?: keyof typeof TONES
  children: ReactNode
}

export function Badge({ tone = 'label', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
