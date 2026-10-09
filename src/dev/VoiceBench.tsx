import { useEffect, useRef, useState } from 'react'
import data from '../../tests/voice-phrases.json'
import { ensureVoice, getLlm, peekModel, peekVoice, useModel } from '../ai/modelManager.ts'
import { parse, scoreParse, type ExpectedParse } from '../ai/parse.ts'
import { backHref, OVERLAY_PATHS } from '../lib/nav.ts'
import { ensurePack, getPlan } from '../state/plan.ts'
import { record, type Recording } from '../voice/capture.ts'
import { correctTranscript } from '../voice/correct.ts'
import { getVoiceBackend, transcribe, VOICE_LANGUAGE, type VoiceLanguage } from '../voice/whisper.ts'

// Dev-only voice benchmark. A team member reads each phrase aloud; the page shows
// what Whisper heard, the corrected text, the latency, and whether the same
// parser the chat uses got the expected Intent. Nothing is mocked or stored.

interface Phrase {
  id: number
  text: string
  expected: ExpectedParse
}

const PHRASES = data.phrases as Phrase[]

interface Row {
  transcript: string
  corrected: string
  confident: boolean
  latencyMs: number
  seconds: number
  pass: boolean
  language: VoiceLanguage
}

export default function VoiceBench() {
  const model = useModel()
  const [language, setLanguage] = useState<VoiceLanguage>(VOICE_LANGUAGE)
  const [rows, setRows] = useState<Record<number, Row>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const recording = useRef<Recording | null>(null)

  useEffect(() => {
    void peekVoice()
    void peekModel()
    void ensurePack()
  }, [])

  const installed = model.voiceStatus === 'cached' || model.voiceStatus === 'ready'

  async function run(phrase: Phrase) {
    setError('')
    setBusy(phrase.id)
    try {
      const current = await record()
      recording.current = current
      const samples = await current.done
      recording.current = null
      await ensureVoice()
      const seconds = samples.length / 16000
      const { text, latencyMs } = await transcribe(samples, language)
      samples.fill(0)
      await ensurePack()
      const pack = getPlan().pack
      if (!pack) throw new Error('Route pack not loaded')
      const correction = correctTranscript(text, pack.landmarks)
      const score = scoreParse(await parse(correction.text, pack, { llm: getLlm() }), phrase.expected)
      setRows((previous) => ({
        ...previous,
        [phrase.id]: {
          transcript: text,
          corrected: correction.text,
          confident: correction.confident,
          latencyMs: Math.round(latencyMs),
          seconds: Math.round(seconds * 10) / 10,
          pass: score.status && score.places && score.preference && score.avoid,
          language,
        },
      }))
    } catch (cause) {
      setError(cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause))
    }
    setBusy(null)
  }

  const done = Object.values(rows)
  const latencies = done.map((row) => row.latencyMs).sort((a, b) => a - b)

  return (
    <div className="min-h-dvh bg-surface-cream p-4 text-ink-dark">
      <a href={backHref()} className="text-sm underline">
        Back
      </a>
      <h1 className="mt-2 font-display text-2xl font-semibold">Voice benchmark (dev only)</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Read each phrase aloud after tapping Record. Recording stops on silence or after 8 seconds. Audio is
        discarded after transcription. Model: {model.voiceId} ({installed ? 'downloaded' : 'not downloaded'}),
        backend: {getVoiceBackend() ?? 'not loaded yet'}.
      </p>
      {!installed && (
        <p className="mt-2 text-sm">
          <a className="underline" href={`#${OVERLAY_PATHS.setup}`}>
            Download the voice model in Setup first.
          </a>
        </p>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm">
        Whisper language
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as VoiceLanguage)}
          className="min-h-11 rounded-xl border border-line px-2"
        >
          <option value="tagalog">tagalog</option>
          <option value="english">english</option>
        </select>
        <span className="text-ink-muted">(transformers.js has no auto-detect)</span>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold">
          {error}
        </p>
      )}
      <p data-testid="voice-bench-summary" className="mt-3 text-sm font-semibold tabular-nums">
        {done.filter((row) => row.pass).length} of {done.length} recorded phrases parsed to the expected Intent
        {latencies.length > 0 && ` · median ${latencies[Math.floor(latencies.length / 2)]} ms`}
      </p>

      <ol className="mt-3 flex flex-col gap-2">
        {PHRASES.map((phrase) => {
          const row = rows[phrase.id]
          return (
            <li key={phrase.id} className="rounded-2xl border border-line p-3 text-sm">
              <p className="font-medium">
                {phrase.id}. {phrase.text}
              </p>
              <button
                type="button"
                disabled={!installed || (busy !== null && busy !== phrase.id)}
                onClick={() => (busy === phrase.id ? recording.current?.stop() : void run(phrase))}
                className="mt-2 min-h-11 rounded-full bg-brown-mid px-4 font-semibold text-surface-cream disabled:opacity-50"
              >
                {busy === phrase.id ? 'Stop' : row ? 'Record again' : 'Record'}
              </button>
              {row && (
                <dl className="mt-2 space-y-0.5 tabular-nums">
                  <div>Heard: {row.transcript || '(nothing)'}</div>
                  <div>
                    Corrected: {row.corrected} {row.confident ? '' : '(low confidence: chips would show)'}
                  </div>
                  <div>
                    {row.language} · {row.seconds} s audio · {row.latencyMs} ms
                  </div>
                  <div className="font-semibold">{row.pass ? 'PASS: expected Intent' : 'FAIL: not the expected Intent'}</div>
                </dl>
              )}
            </li>
          )
        })}
      </ol>

      <h2 className="mt-4 font-semibold">Results (copy into docs/voice-benchmark.md)</h2>
      <pre data-testid="voice-bench-json" className="mt-1 overflow-x-auto rounded-xl bg-surface-warm p-2 text-xs">
        {JSON.stringify({ model: model.voiceId, backend: getVoiceBackend(), rows }, null, 1)}
      </pre>
    </div>
  )
}
