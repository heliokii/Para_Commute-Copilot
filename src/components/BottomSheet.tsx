import { useEffect, useId, useRef, type ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Modal sheet. Closes on Escape or backdrop tap and returns focus to the opener. */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 animate-fade bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="surface relative w-full max-w-md animate-rise rounded-t-card bg-surface-cream p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink-dark outline-none"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        <h2 id={titleId} className="font-display text-xl font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
