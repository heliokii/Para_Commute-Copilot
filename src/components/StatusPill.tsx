import { copy } from '../copy'
import { useOnline } from '../lib/hooks'

/** Live connection state. Offline is the good state here, so it gets the green dot. */
export function StatusPill({ className = '' }: { className?: string }) {
  const online = useOnline()
  return (
    <span
      role="status"
      className={`surface inline-flex items-center gap-1.5 rounded-full bg-surface-cream px-3 py-1 text-xs font-semibold text-ink-dark ${className}`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${online ? 'bg-accent-terracotta' : 'bg-ok-green'}`}
      />
      {online ? copy.status.online : copy.status.offline}
    </span>
  )
}
