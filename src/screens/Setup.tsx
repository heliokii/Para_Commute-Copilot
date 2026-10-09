import { useEffect, useState } from 'react'
import {
  downloadModel,
  downloadVoice,
  initModelManager,
  peekVoice,
  removeModel,
  removeVoice,
  selectModel,
  selectVoice,
  useModel,
} from '../ai/modelManager'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { ProgressBar } from '../components/ProgressBar'
import { TopBar } from '../components/TopBar'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { megabytes } from '../lib/format'
import { backHref } from '../lib/nav'
import { VOICE_CANDIDATES } from '../voice/whisper'

/** First-run "Gisingin si Tsupher": downloads the on-device model once. */
export function Setup() {
  const model = useModel()
  // The quick start-up guess can be stale; show nothing final until the real cache was checked.
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([initModelManager(), peekVoice()]).then(() => !cancelled && setChecked(true))
    return () => {
      cancelled = true
    }
  }, [])

  const selected = model.candidates.find((candidate) => candidate.id === model.selectedId)
  const busy = model.status === 'downloading'
  const installed = model.status === 'ready' || model.status === 'cached'
  const voice = VOICE_CANDIDATES.find((candidate) => candidate.id === model.voiceId)
  const voiceBusy = model.voiceStatus === 'downloading'
  const voiceInstalled = model.voiceStatus === 'ready' || model.voiceStatus === 'cached'
  // Without WebGPU the speech model runs on WASM and downloads a smaller build.
  const voiceBackend = model.status === 'unsupported' ? 'wasm' : 'webgpu'

  return (
    <div className="backdrop min-h-dvh pb-10">
      <TopBar title={copy.setup.title} backHref={backHref()} />
      <div className="flex flex-col gap-3 px-4 pt-2">
        {!checked && <p className="px-1 text-sm text-on-deep/85">{copy.setup.checking}</p>}

        {checked && model.status === 'unsupported' && (
          <Card className="flex flex-col items-center px-6 py-8 text-center">
            <Tsupher state="sad" size="lg" />
            <h2 className="mt-3 font-display text-xl font-semibold">{copy.setup.unsupportedTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{copy.setup.unsupportedBody}</p>
          </Card>
        )}

        {checked && installed && (
          <Card className="flex flex-col items-center px-6 py-8 text-center">
            <Tsupher state="thumbs-up" size="lg" />
            <h2 className="mt-3 font-display text-xl font-semibold">{copy.setup.readyTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{copy.setup.readyBody}</p>
            <dl className="mt-4 w-full space-y-1 text-left text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{copy.setup.model}</dt>
                <dd data-testid="setup-model" className="text-right font-medium">{selected?.label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{copy.setup.license}</dt>
                <dd className="text-right">{selected?.license}</dd>
              </div>
              <div className="flex justify-between gap-3 tabular-nums">
                <dt className="text-ink-muted">{copy.setup.modelSize}</dt>
                <dd>{model.modelBytes ? megabytes(model.modelBytes) : copy.setup.unknownSize}</dd>
              </div>
            </dl>
            <Button variant="dark" className="mt-5" onClick={() => void removeModel()}>
              {copy.setup.remove}
            </Button>
          </Card>
        )}

        {checked && (model.status === 'absent' || model.status === 'error' || busy) && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Tsupher state={model.status === 'error' ? 'sad' : 'driving'} size="md" bob={busy} decorative />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold">
                  {busy ? copy.setup.downloadingTitle : copy.setup.absentTitle}
                </h2>
                <p className="text-sm text-ink-muted">{copy.setup.absentBody}</p>
              </div>
            </div>

            {!busy && (
              <fieldset className="mt-4 min-w-0">
                <legend className="text-sm font-semibold">{copy.setup.choose}</legend>
                <div className="mt-2 flex flex-col gap-2">
                  {model.candidates.map((candidate) => (
                    <label
                      key={candidate.id}
                      className="flex min-h-12 items-center gap-3 rounded-2xl border border-line px-3 py-2"
                    >
                      <input
                        type="radio"
                        name="model"
                        className="size-5 accent-brown-mid"
                        checked={candidate.id === model.selectedId}
                        onChange={() => void selectModel(candidate.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{candidate.label}</span>
                        <span className="block text-xs text-ink-muted">{candidate.license}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {busy && (
              <div className="mt-4">
                <ProgressBar value={model.progress * 100} label={copy.setup.downloadingTitle} />
                <p data-testid="setup-progress" className="mt-1.5 text-xs break-words text-ink-muted tabular-nums">
                  {Math.round(model.progress * 100)}% · {model.progressText}
                </p>
                <p className="mt-2 text-sm">{copy.setup.keepUsing}</p>
              </div>
            )}

            {model.status === 'error' && (
              <p role="alert" className="mt-3 text-sm">
                <Badge tone="caution">{copy.setup.errorTitle}</Badge>{' '}
                <span className="text-ink-muted">
                  {model.errorKind === 'quota'
                    ? copy.setup.errorQuota
                    : model.errorKind === 'memory'
                      ? copy.setup.errorMemory
                      : copy.setup.errorBody}
                </span>
                <span className="mt-1 block text-xs break-words text-ink-muted">{model.error}</span>
              </p>
            )}

            {!busy && (
              <>
                <p className="mt-4 rounded-2xl bg-surface-warm px-3 py-2 text-sm font-medium">
                  {copy.setup.wifi}
                </p>
                <Button className="mt-3 w-full" disabled={!model.selectedId} onClick={() => void downloadModel()}>
                  {model.status === 'error' ? copy.setup.retry : copy.setup.start}
                </Button>
              </>
            )}
          </Card>
        )}

        {checked && (
          <Card className="p-4" data-testid="setup-voice" data-status={model.voiceStatus}>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-warm text-brown-mid">
                <Icon name="mic" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold">
                  {voiceBusy
                    ? copy.setup.voiceDownloading
                    : voiceInstalled
                      ? copy.setup.voiceReadyTitle
                      : copy.setup.voiceTitle}
                </h2>
                <p className="text-sm text-ink-muted">{voiceInstalled ? copy.voice.privacy : copy.setup.voiceAbsentBody}</p>
              </div>
            </div>

            {!voiceInstalled && !voiceBusy && (
              <div className="mt-3 flex flex-col gap-2">
                {VOICE_CANDIDATES.map((candidate) => (
                  <label
                    key={candidate.id}
                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-line px-3 py-2"
                  >
                    <input
                      type="radio"
                      name="voice-model"
                      className="size-5 accent-brown-mid"
                      checked={candidate.id === model.voiceId}
                      onChange={() => selectVoice(candidate.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{candidate.label}</span>
                      <span className="block text-xs text-ink-muted">{candidate.license}</span>
                    </span>
                    <span className="shrink-0 text-sm text-ink-muted tabular-nums">
                      {copy.setup.voiceApprox(candidate.approxMb[voiceBackend])}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {voiceBusy && (
              <div className="mt-4">
                <ProgressBar value={model.voiceProgress * 100} label={copy.setup.voiceDownloading} />
                <p data-testid="setup-voice-progress" className="mt-1.5 text-xs text-ink-muted tabular-nums">
                  {Math.round(model.voiceProgress * 100)}% · {model.voiceProgressText}
                </p>
              </div>
            )}

            {model.voiceStatus === 'error' && (
              <p role="alert" className="mt-3 text-sm">
                <Badge tone="caution">{copy.setup.errorTitle}</Badge>{' '}
                <span className="text-ink-muted">{copy.setup.voiceError}</span>
                <span className="mt-1 block text-xs break-words text-ink-muted">{model.voiceError}</span>
              </p>
            )}

            {voiceInstalled && (
              <dl className="mt-4 w-full space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{copy.setup.model}</dt>
                  <dd data-testid="setup-voice-model" className="text-right font-medium">{voice?.label}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{copy.setup.license}</dt>
                  <dd className="text-right">{voice?.license}</dd>
                </div>
                <div className="flex justify-between gap-3 tabular-nums">
                  <dt className="text-ink-muted">{copy.setup.modelSize}</dt>
                  <dd data-testid="setup-voice-size">
                    {model.voiceBytes ? megabytes(model.voiceBytes) : copy.setup.unknownSize}
                  </dd>
                </div>
              </dl>
            )}

            {!voiceBusy &&
              (voiceInstalled ? (
                <Button variant="dark" className="mt-4" onClick={() => void removeVoice()}>
                  {copy.setup.voiceRemove}
                </Button>
              ) : (
                <Button data-testid="setup-voice-start" className="mt-3 w-full" onClick={() => void downloadVoice()}>
                  {copy.setup.voiceStart}
                </Button>
              ))}
          </Card>
        )}

        {model.storageUsed !== null && (
          <p className="px-1 text-xs text-on-deep/80 tabular-nums">
            {copy.setup.storage(megabytes(model.storageUsed), model.storageQuota ? megabytes(model.storageQuota) : '?')}
            {model.persisted !== null && ` · ${model.persisted ? copy.setup.persisted : copy.setup.notPersisted}`}
          </p>
        )}
        <p className="px-1 text-xs text-on-deep/80">{copy.setup.totalDownload}</p>
        <p className="px-1 text-xs text-on-deep/80">{copy.setup.privacy}</p>
      </div>
    </div>
  )
}
