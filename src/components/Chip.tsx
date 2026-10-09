import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  children: ReactNode
}

/** Toggle or quick-reply chip. For use on cream surfaces. */
export function Chip({ selected = false, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
        selected
          ? 'border-accent-amber bg-accent-amber text-ink-dark'
          : 'border-line bg-surface-cream text-ink-dark hover:bg-surface-warm'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
