import { useBytesSent, useOnline } from '../lib/hooks'

export function StatusChip() {
  const online = useOnline()
  const bytesSent = useBytesSent()

  return (
    <div
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted"
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${online ? 'bg-ok' : 'bg-warn'}`}
      />
      <span className="text-ink">{online ? 'Online' : 'Offline'}</span>
      <span aria-hidden="true" className="h-3 w-px bg-line" />
      <span className="tabular-nums">bytes sent: {bytesSent}</span>
    </div>
  )
}
