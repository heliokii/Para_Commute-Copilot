import { useToast } from '../state/toast'
import { Tsupher } from './Tsupher'

/** Short message above the bottom edge. Announced to screen readers; gone after a few seconds. */
export function Toast() {
  const toast = useToast()
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex max-w-md justify-center px-4">
      {toast && (
        <div
          key={toast.id}
          data-testid="toast"
          data-sprite={toast.sprite ?? ''}
          className="surface flex animate-rise items-center gap-2 rounded-full bg-surface-cream py-1.5 pr-5 pl-2 text-sm font-semibold text-ink-dark shadow-card"
        >
          {toast.sprite && <Tsupher state={toast.sprite} size="sm" eager decorative />}
          {toast.text}
        </div>
      )}
    </div>
  )
}
