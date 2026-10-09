import { useEffect, useRef, useState } from 'react'
import { ensureVoice, peekVoice, useModel } from '../ai/modelManager'
import { copy } from '../copy'
import { OVERLAY_PATHS } from '../lib/nav'
import { ensurePack, getPlan } from '../state/plan'
import { record, type Recording } from '../voice/capture'
import { correctTranscript } from '../voice/correct'
import { transcribe } from '../voice/whisper'
import { Button } from './Button'
import { Chip } from './Chip'
import { Icon } from './Icon'
import { Tsupher } from './Tsupher'

type Phase =
  | { kind: 'idle' }
  | { kind: 'needModel' }
  | { kind: 'listening' }
  | { kind: 'transcribing' }
  | { kind: 'confirm'; options: string[] }
  | { kind: 'note'; text: string }

interface VoiceButtonProps {
  /** Receives the confirmed text. It goes to the same parser as typed input. */
  onText: (text: string) => void
  disabled?: boolean
}

/** Mic button plus the full-screen listening flow. The microphone is asked for only on tap. */
export function VoiceButton({ onText, disabled = false }: VoiceButtonProps) {
  const model = useModel()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const recording = useRef<Recording | null>(null)
  // Bumped on cancel so a transcription that is still running is ignored.
  const run = useRef(0)

  useEffect(() => {
    void peekVoice()
  }, [])

  function close() {
    run.current++
    recording.current?.stop()
    recording.current = null
    setPhase({ kind: 'idle' })
  }

  useEffect(() => {
    if (phase.kind === 'idle') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase.kind])

  async function start() {
    if (model.voiceStatus !== 'cached' && model.voiceStatus !== 'ready') {
      setPhase({ kind: 'needModel' })
      return
    }
    const id = ++run.current
    setPhase({ kind: 'listening' })
    let current: Recording
    try {
      current = await record()
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      if (run.current === id) setPhase({ kind: 'note', text: denied ? copy.voice.denied : copy.voice.noMic })
      return
    }
    if (run.current !== id) {
      current.stop()
      return
    }
    recording.current = current
    const samples = await current.done
    recording.current = null
    if (run.current !== id) {
      samples.fill(0)
      return
    }
    setPhase({ kind: 'transcribing' })
    try {
      // Loaded only now, from the local cache: loading while recording froze the listening screen.
      await ensureVoice()
      const { text } = await transcribe(samples)
      await ensurePack()
      const correction = correctTranscript(text, getPlan().pack?.landmarks ?? [])
      if (run.current !== id) return
      if (!correction.text) setPhase({ kind: 'note', text: copy.voice.heardNothing })
      else if (correction.confident) {
        setPhase({ kind: 'idle' })
        onText(correction.text)
      } else setPhase({ kind: 'confirm', options: [correction.text, ...correction.alternatives] })
    } catch (error) {
      console.error('Voice failed', error)
      if (run.current === id) setPhase({ kind: 'note', text: copy.voice.failed })
    } finally {
      // The audio is not kept: wipe the only copy.
      samples.fill(0)
    }
  }

  const title =
    phase.kind === 'listening'
      ? copy.voice.listening
      : phase.kind === 'transcribing'
        ? copy.voice.transcribing
        : phase.kind === 'confirm'
          ? copy.voice.confirm
          : phase.kind === 'needModel'
            ? copy.voice.needModelTitle
            : ''

  return (
    <>
      <button
        type="button"
        data-testid="mic-button"
        aria-label={copy.voice.mic}
        title={copy.voice.mic}
        disabled={disabled}
        onClick={() => void start()}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-warm text-brown-mid disabled:opacity-50"
      >
        <Icon name="mic" />
      </button>

      {phase.kind !== 'idle' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title || copy.voice.mic}
          data-testid="listening"
          data-phase={phase.kind}
          className="backdrop fixed inset-0 z-40 mx-auto flex max-w-md animate-fade flex-col items-center justify-center gap-4 px-6 text-center text-on-deep"
        >
          {(phase.kind === 'listening' || phase.kind === 'transcribing') && (
            <span className="relative flex size-40 items-center justify-center">
              {phase.kind === 'listening' &&
                [0, 1, 2].map((ring) => (
                  <span
                    key={ring}
                    aria-hidden="true"
                    className="absolute inset-0 animate-ping rounded-full border-2 border-accent-amber motion-reduce:animate-none motion-reduce:opacity-40"
                    style={{ animationDuration: '2.4s', animationDelay: `${ring * 0.8}s` }}
                  />
                ))}
              <Tsupher state={phase.kind === 'listening' ? 'happy' : 'thinking'} size="lg" eager decorative />
            </span>
          )}
          {phase.kind === 'note' && <Tsupher state="confused" size="lg" eager decorative />}
          {phase.kind === 'needModel' && <Tsupher state="driving" size="lg" eager decorative />}

          {title && (
            <h2 aria-live="polite" className="font-display text-2xl font-semibold">
              {title}
            </h2>
          )}

          {phase.kind === 'listening' && (
            <>
              <p className="text-on-deep/90">{copy.voice.hint}</p>
              <p className="max-w-72 text-xs text-on-deep/75">{copy.voice.privacy}</p>
              <Button data-testid="voice-finish" className="mt-2 w-full" onClick={() => recording.current?.stop()}>
                {copy.voice.finish}
              </Button>
            </>
          )}

          {phase.kind === 'confirm' && (
            <div className="flex flex-col items-stretch gap-2">
              {phase.options.map((option) => (
                <Chip
                  key={option}
                  data-testid="voice-chip"
                  onClick={() => {
                    setPhase({ kind: 'idle' })
                    onText(option)
                  }}
                >
                  {option}
                </Chip>
              ))}
            </div>
          )}

          {phase.kind === 'note' && (
            <p role="alert" data-testid="voice-note" className="max-w-80">
              {phase.text}
            </p>
          )}

          {phase.kind === 'needModel' && (
            <>
              <p className="max-w-80 text-on-deep/90">{copy.voice.needModelBody}</p>
              <Button href={`#${OVERLAY_PATHS.setup}`} className="w-full" onClick={close}>
                {copy.voice.needModelAction}
              </Button>
            </>
          )}

          {phase.kind !== 'transcribing' && (
            <button
              type="button"
              data-testid="voice-close"
              onClick={close}
              className="min-h-11 px-4 text-sm font-semibold text-accent-amber underline underline-offset-2"
            >
              {phase.kind === 'listening' ? copy.voice.cancel : copy.voice.typeInstead}
            </button>
          )}
        </div>
      )}
    </>
  )
}
