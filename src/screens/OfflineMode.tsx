import { useEffect, useSyncExternalStore } from 'react'
import { peekModel, peekVoice, useModel } from '../ai/modelManager'
import { CANDIDATES, getLastStats, subscribeStats } from '../ai/runtime'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { StatusPill } from '../components/StatusPill'
import { copy } from '../copy'
import { megabytes } from '../lib/format'
import { useBytesSent } from '../lib/hooks'
import { backHref, OVERLAY_PATHS } from '../lib/nav'
import { isFareStale, useCrossOriginRequests, useServiceWorkerState } from '../lib/proof'
import { ensurePack, usePlan } from '../state/plan'
import { getLastVoiceStats, getVoiceBackend, VOICE_CANDIDATES } from '../voice/whisper'

interface Row {
  id: string
  label: string
  value: string
  /** true = verified now, false = not true now, null = still checking or nothing to show yet. */
  ok: boolean | null
  note?: string
}

/** Proof panel. Every row is read from the running app; none is hardcoded. */
export function OfflineMode() {
  const bytesSent = useBytesSent()
  const model = useModel()
  const plan = usePlan()
  const serviceWorker = useServiceWorkerState()
  const crossOrigin = useCrossOriginRequests()
  const stats = useSyncExternalStore(subscribeStats, getLastStats)

  useEffect(() => {
    void peekModel()
    void peekVoice()
    void ensurePack()
  }, [])

  const text = copy.offline
  const pack = plan.pack
  const fareDates = (pack?.fares ?? []).map((fare) => fare.effectiveDate).sort()
  const oldestFare = fareDates[0]
  const installed = model.status === 'ready' || model.status === 'cached'
  const modelLabel = CANDIDATES.find((candidate) => candidate.id === model.selectedId)?.label
  const voiceInstalled = model.voiceStatus === 'ready' || model.voiceStatus === 'cached'
  const voiceLabel = VOICE_CANDIDATES.find((candidate) => candidate.id === model.voiceId)?.label
  // Known only once the speech model has been loaded in this session.
  const voiceBackend = getVoiceBackend()
  const voiceStats = getLastVoiceStats()

  const rows: Row[] = [
    {
      id: 'sw',
      label: text.rows.sw,
      value:
        serviceWorker === null
          ? text.checking
          : serviceWorker === 'active'
            ? text.swActive
            : serviceWorker === 'installing'
              ? text.swInstalling
              : text.swNone,
      ok: serviceWorker === null ? null : serviceWorker === 'active',
      note: serviceWorker === 'none' || serviceWorker === 'unsupported' ? text.swNoneNote : undefined,
    },
    {
      id: 'pack',
      label: text.rows.pack,
      value: plan.packError
        ? text.packFailed
        : pack
          ? text.packLoaded(pack.version, pack.routes.length, oldestFare ?? '?')
          : text.checking,
      ok: plan.packError ? false : pack ? true : null,
      note: pack
        ? [pack.note ? copy.app.sampleData : '', isFareStale(oldestFare) ? copy.stale.short : '']
            .filter(Boolean)
            .join(' · ') || undefined
        : undefined,
    },
    {
      id: 'model',
      label: text.rows.ai,
      value:
        model.status === 'unknown'
          ? text.checking
          : model.status === 'unsupported'
            ? text.noWebGpu
            : installed && modelLabel
              ? text.aiInstalled(modelLabel, model.modelBytes ? megabytes(model.modelBytes) : null)
              : model.status === 'downloading'
                ? text.aiDownloading(Math.round(model.progress * 100))
                : model.status === 'error'
                  ? text.aiFailed
                  : text.aiAbsent,
      ok: model.status === 'unknown' ? null : installed,
      note: installed ? text.backendWebGpu : model.status === 'unknown' ? undefined : text.rulesFallback,
    },
    {
      id: 'voice',
      label: text.rows.voice,
      value:
        model.voiceStatus === 'unknown'
          ? text.checking
          : voiceInstalled && voiceLabel
            ? text.aiInstalled(voiceLabel, model.voiceBytes ? megabytes(model.voiceBytes) : null)
            : model.voiceStatus === 'downloading'
              ? text.aiDownloading(Math.round(model.voiceProgress * 100))
              : model.voiceStatus === 'error'
                ? text.aiFailed
                : text.aiAbsent,
      ok: model.voiceStatus === 'unknown' ? null : voiceInstalled,
      note: voiceBackend
        ? [
            text.voiceBackend(voiceBackend === 'webgpu' ? 'WebGPU' : 'WASM'),
            voiceStats ? text.voiceLast(Math.round(voiceStats.latencyMs), voiceStats.audioSeconds.toFixed(1)) : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : text.voiceNote,
    },
    {
      id: 'inference',
      label: text.rows.inference,
      value: stats
        ? text.inference(
            Math.round(stats.latencyMs),
            stats.tokensPerSecond ? Math.round(stats.tokensPerSecond) : null,
          )
        : text.noInference,
      ok: stats ? true : null,
    },
    {
      id: 'cross-origin',
      label: text.rows.crossOrigin,
      value: crossOrigin.supported ? String(crossOrigin.count) : text.notMeasurable,
      ok: crossOrigin.supported ? crossOrigin.count === 0 : null,
      note:
        crossOrigin.count > 0
          ? text.crossOriginHosts(crossOrigin.hosts.join(', '))
          : text.crossOriginNote,
    },
  ]

  return (
    <div className="flex min-h-dvh flex-col items-center bg-bg-deeper px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <span className="flex size-16 items-center justify-center rounded-full border-2 border-accent-amber text-accent-amber">
        <Icon name="wifi-off" className="size-8" />
      </span>
      <h1 className="mt-4 font-display text-3xl font-semibold">{text.title}</h1>
      <p className="mt-1 max-w-72 text-on-deep/90">{text.body}</p>

      <Card tone="deep" className="mt-5 w-full text-left">
        <ul className="divide-y divide-line-on-deep">
          {rows.map((row) => (
            <li
              key={row.id}
              data-testid={`proof-${row.id}`}
              data-ok={String(row.ok)}
              className="flex gap-3 px-4 py-3 text-sm"
            >
              <span
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                  row.ok ? 'bg-accent-amber text-ink-dark' : 'border border-on-deep/60 text-on-deep/80'
                }`}
              >
                <Icon name={row.ok ? 'check' : 'dash'} className="size-4" />
                {row.ok !== null && <span className="sr-only">{row.ok ? text.yes : text.no}:</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{row.label}</span>
                <span className="block text-on-deep/90 tabular-nums">{row.value}</span>
                {row.note && <span className="mt-0.5 block text-xs text-on-deep/75">{row.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {!installed && model.status !== 'unsupported' && model.status !== 'unknown' && (
        <a
          href={`#${OVERLAY_PATHS.setup}`}
          className="mt-2 flex min-h-11 items-center text-sm font-semibold text-accent-amber underline underline-offset-2"
        >
          {copy.setup.title}
        </a>
      )}

      <div className="mt-3 flex items-center gap-2 text-sm text-on-deep/90">
        {text.connection}: <StatusPill />
      </div>

      <p data-testid="bytes-sent" className="mt-4 text-sm tabular-nums">
        {text.bytesSent}: {bytesSent} ({text.bytesNote}) | {text.private}
      </p>
      <p className="mt-1 max-w-80 text-xs text-on-deep/75">{text.bytesExplain}</p>

      <Button href={backHref()} className="mt-6 w-full">
        {text.ok}
      </Button>
    </div>
  )
}
