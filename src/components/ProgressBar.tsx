interface ProgressBarProps {
  /** 0 to max. */
  value: number
  max?: number
  label: string
  className?: string
}

export function ProgressBar({ value, max = 100, label, className = '' }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      className={`h-2.5 overflow-hidden rounded-full bg-ink-dark/15 ${className}`}
    >
      <div
        className="h-full rounded-full bg-accent-amber transition-[width] duration-300"
        style={{ width: `${max > 0 ? (clamped / max) * 100 : 0}%` }}
      />
    </div>
  )
}
