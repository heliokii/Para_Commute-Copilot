import { Icon } from './Icon'

interface HeartButtonProps {
  saved: boolean
  /** Accessible name for the current action: "I-save ..." when not saved, "Tanggalin ..." when saved. */
  label: string
  onToggle: () => void
  testId?: string
  className?: string
}

/** Heart toggle. Filled when saved. At least 44 px wide and tall. */
export function HeartButton({ saved, label, onToggle, testId, className = '' }: HeartButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      data-testid={testId}
      onClick={onToggle}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${saved ? 'text-accent-terracotta' : ''} ${className}`}
    >
      <Icon name="heart" className={saved ? 'size-6 fill-current' : 'size-6'} />
    </button>
  )
}
