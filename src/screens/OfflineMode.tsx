import { useEffect } from 'react'
import { peekModel, useModel } from '../ai/modelManager'
import { CANDIDATES } from '../ai/runtime'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { StatusPill } from '../components/StatusPill'
import { copy } from '../copy'
import { useBytesSent } from '../lib/hooks'
import { backHref, OVERLAY_PATHS } from '../lib/nav'

export function OfflineMode() {
  const bytesSent = useBytesSent()
  const model = useModel()

  useEffect(() => {
    void peekModel()
  }, [])

  // GPS and Search rows are still static; Phase 10 derives every check from real state.
  const installed = model.status === 'ready' || model.status === 'cached'
  const modelLabel = CANDIDATES.find((candidate) => candidate.id === model.selectedId)?.label
  const rows = [
    { ...copy.offline.rows.gps, ready: true },
    { ...copy.offline.rows.search, ready: true },
    {
      label: copy.offline.rows.ai.label,
      value: installed && modelLabel ? copy.offline.aiInstalled(modelLabel) : copy.offline.rows.ai.value,
      ready: installed,
    },
  ]

  return (
    <div className="flex min-h-dvh flex-col items-center bg-bg-deeper px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <span className="flex size-20 items-center justify-center rounded-full border-2 border-accent-amber text-accent-amber">
        <Icon name="wifi-off" className="size-9" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-semibold">{copy.offline.title}</h1>
      <p className="mt-1 max-w-64 text-on-deep/90">{copy.offline.body}</p>

      <Card tone="deep" className="mt-6 w-full text-left">
        <ul className="divide-y divide-line-on-deep">
          {rows.map((row) => (
            <li key={row.label} className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-sm">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                  row.ready ? 'bg-accent-amber text-ink-dark' : 'border border-on-deep/60 text-on-deep/80'
                }`}
              >
                <Icon name={row.ready ? 'check' : 'dash'} className="size-4" />
                <span className="sr-only">{row.ready ? copy.offline.yes : copy.offline.no}:</span>
              </span>
              <span className="flex-1 font-semibold">{row.label}</span>
              <span className="text-on-deep/85">{row.value}</span>
            </li>
          ))}
        </ul>
      </Card>

      {!installed && model.status !== 'unsupported' && (
        <a
          href={`#${OVERLAY_PATHS.setup}`}
          className="mt-3 flex min-h-11 items-center text-sm font-semibold text-accent-amber underline underline-offset-2"
        >
          {copy.setup.title}
        </a>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm text-on-deep/90">
        {copy.offline.connection}: <StatusPill />
      </div>

      <Button href={backHref()} className="mt-8 w-full">
        {copy.offline.ok}
      </Button>

      <p data-testid="bytes-sent" className="mt-6 text-sm tabular-nums">
        {copy.offline.bytesSent}: {bytesSent} ({copy.offline.bytesNote}) | {copy.offline.private}
      </p>
      <p className="mt-1 max-w-72 text-xs text-on-deep/75">{copy.offline.bytesExplain}</p>
    </div>
  )
}
