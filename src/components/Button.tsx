import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-2.5 font-display text-base font-semibold transition-[filter,opacity] hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS = {
  /** Amber fill, dark text. */
  primary: 'bg-accent-amber text-ink-dark shadow-card',
  /** Outline for dark backdrops. */
  secondary: 'border-2 border-on-deep/80 text-on-deep',
  /** Brown fill for use on cream surfaces. */
  dark: 'bg-brown-mid text-surface-cream',
} as const

type Variant = keyof typeof VARIANTS

type ButtonProps = { variant?: Variant; children: ReactNode; className?: string } & (
  | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
)

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${className}`
  if (rest.href !== undefined) {
    return (
      <a className={classes} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  )
}
