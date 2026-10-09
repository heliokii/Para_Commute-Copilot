import type { ReactNode } from 'react'
import { copy } from '../copy'
import { Icon } from './Icon'

interface TopBarProps {
  title: string
  /** Shows a back button linking here. */
  backHref?: string
  right?: ReactNode
}

export function TopBar({ title, backHref, right }: TopBarProps) {
  return (
    <header className="flex min-h-14 items-center gap-2 px-4 pt-[env(safe-area-inset-top)] text-on-deep">
      {backHref && (
        <a
          href={backHref}
          aria-label={copy.nav.back}
          className="-ml-2 flex size-11 items-center justify-center rounded-full"
        >
          <Icon name="back" />
        </a>
      )}
      <h1 className="min-w-0 flex-1 truncate font-display text-xl font-semibold">{title}</h1>
      {right}
    </header>
  )
}
