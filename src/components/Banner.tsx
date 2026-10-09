import type { ReactNode } from 'react'
import { Icon } from './Icon'

interface BannerProps {
  title: string
  body: string
  /** Leading art, usually a Tsupher sprite. */
  art?: ReactNode
  /** Makes the whole banner a link with a chevron. */
  href?: string
}

export function Banner({ title, body, art, href }: BannerProps) {
  const content = (
    <>
      {art}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-dark/80">{body}</span>
      </span>
      {href && <Icon name="chevron-right" className="size-5 shrink-0" />}
    </>
  )
  const classes =
    'surface flex min-h-11 items-center gap-3 rounded-card bg-surface-warm p-4 text-ink-dark shadow-card'
  return href ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <div className={classes}>{content}</div>
  )
}
