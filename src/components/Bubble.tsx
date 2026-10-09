import type { ReactNode } from 'react'

interface BubbleProps {
  from: 'user' | 'tsupher'
  children: ReactNode
}

/** Chat bubble. User on the right in brown, Tsupher on the left in cream. */
export function Bubble({ from, children }: BubbleProps) {
  const mine = from === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-3xl px-4 py-3 text-[0.95rem] leading-snug ${
          mine
            ? 'rounded-br-lg bg-brown-mid text-surface-cream'
            : 'surface rounded-bl-lg bg-surface-cream text-ink-dark shadow-card'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
