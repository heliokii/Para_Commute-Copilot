import { useEffect, useState } from 'react'
import benchmark from '../../tests/taglish-50.json'
import {
  buildLlmPrompt,
  parseWithRules,
  resolveLlmOutput,
  scoreParse,
  type ExpectedParse,
  type ParseResult,
} from '../ai/parse.ts'
import {
  availableCandidates,
  complete,
  detectWebGpu,
  getLastStats,
  isModelCached,
  loadModel,
  type Candidate,
} from '../ai/runtime.ts'
import { ACTIVE_PACK_ID } from '../db/seed.ts'
import { backHref } from '../lib/nav.ts'
import { loadPack } from '../router/client.ts'

// Dev-only model benchmark. Runs a real on-device model over tests/taglish-50.json.
// Nothing here is mocked: if the model cannot load, the run fails and says so.

interface Query {
  id: number
  category: string
  text: string
  expected: ExpectedParse
}

const QUERIES = benchmark.queries as Query[]

interface LaneMetrics {
  places: number
  preference: number
  avoid: number
  /** Asked or declined when the query was unclear or out of scope. */
  clarification: number
  /** Every field right. */
  exact: number
  misses: number[]
}

export interface BenchResult {
  modelId: string
  label: string
  license: string
  ranAt: string
  queries: number
  wasCached: boolean
  loadMs: number
  /** Storage growth across the download. null when the model was already cached. */
  downloadBytes: number | null
  p50Ms: number
  p95Ms: number
  tokensPerSecond: number | null
  invalidJson: number
  rulesOnly: LaneMetrics
  llmOnly: LaneMetrics
  /** Rules first, model only when rules could not finish: what the app does. */
  hybrid: LaneMetrics
  hybridLlmCalls: number
}

declare global {
  interface Window {
    __paraBench?: { status: 'idle' | 'running' | 'done' | 'error'; message: string; result?: BenchResult }
  }
}

const ALL_WRONG = { status: false, places: false, preference: false, avoid: false }

/** A null result (the model never produced valid JSON) scores wrong on every field. */
function metrics(results: (ParseResult | null)[]): LaneMetrics {
  const scores = results.map((result, index) =>
    result ? scoreParse(result, QUERIES[index].expected) : ALL_WRONG,
  )
  const share = (hits: boolean[]) => hits.filter(Boolean).length / Math.max(hits.length, 1)
  const unclear = scores.filter((_, index) => QUERIES[index].expected.status !== 'ok')
  const clear = scores.filter((_, index) => QUERIES[index].expected.status === 'ok')
  return {
    places: share(clear.map((score) => score.places)),
    preference: share(clear.map((score) => score.preference)),
    avoid: share(clear.map((score) => score.avoid)),
    clarification: share(unclear.map((score) => score.status)),
    exact: share(scores.map((score) => Object.values(score).every(Boolean))),
    misses: scores.flatMap((score, index) => (Object.values(score).every(Boolean) ? [] : [QUERIES[index].id])),
  }
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0

const percent = (value: number) => `${Math.round(value * 100)}%`

async function runBenchmark(candidate: Candidate, report: (message: string) => void): Promise<BenchResult> {
  const pack = await loadPack(ACTIVE_PACK_ID)
  if (!pack) throw new Error('Route pack not found')
  if (!(await detectWebGpu())) throw new Error('WebGPU is not available in this browser')

  const wasCached = await isModelCached(candidate.id)
  const before = (await navigator.storage.estimate()).usage ?? 0
  const started = performance.now()
  await loadModel(candidate.id, (progress, text) => report(`Loading ${Math.round(progress * 100)}%: ${text}`))
  const loadMs = performance.now() - started
  const after = (await navigator.storage.estimate()).usage ?? 0

  report('Warm-up')
  await complete(buildLlmPrompt('Alpha to Delta', pack))

  const rules = QUERIES.map((query) => parseWithRules(query.text, pack))
  const llm: (ParseResult | null)[] = []
  const latencies: number[] = []
  const speeds: number[] = []
  let invalidJson = 0

  for (const [index, query] of QUERIES.entries()) {
    report(`Query ${index + 1} of ${QUERIES.length}`)
    const prompt = buildLlmPrompt(query.text, pack)
    let result: ParseResult | null = null
    // Same policy as the app: one retry on invalid JSON, then give up on the model.
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const output = await complete(prompt)
      const stats = getLastStats()
      if (stats) {
        latencies.push(stats.latencyMs)
        if (stats.tokensPerSecond) speeds.push(stats.tokensPerSecond)
      }
      try {
        result = resolveLlmOutput(query.text, output, pack)
      } catch {
        invalidJson++
      }
    }
    llm.push(result)
  }

  // The app: rules first; the model only when rules could not finish; rules again if the model fails twice.
  const hybrid = QUERIES.map((_, index) =>
    rules[index].status === 'ok' ? rules[index] : (llm[index] ?? rules[index]),
  )
  const sorted = [...latencies].sort((a, b) => a - b)
  return {
    modelId: candidate.id,
    label: candidate.label,
    license: candidate.license,
    ranAt: new Date().toISOString(),
    queries: QUERIES.length,
    wasCached,
    loadMs,
    downloadBytes: wasCached ? null : after - before,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    tokensPerSecond: speeds.length ? speeds.reduce((sum, value) => sum + value, 0) / speeds.length : null,
    invalidJson,
    rulesOnly: metrics(rules),
    llmOnly: metrics(llm),
    hybrid: metrics(hybrid),
    hybridLlmCalls: rules.filter((result) => result.status !== 'ok').length,
  }
}

export default function Bench() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [modelId, setModelId] = useState('')
  const [message, setMessage] = useState('Idle')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BenchResult | null>(null)

  useEffect(() => {
    window.__paraBench = { status: 'idle', message: 'Idle' }
    // ?model=<id> preselects a model, for the automated run.
    const requested = new URLSearchParams(location.search).get('model')
    availableCandidates().then((list) => {
      setCandidates(list)
      setModelId(list.find((candidate) => candidate.id === requested)?.id ?? list[0]?.id ?? '')
    })
  }, [])

  async function run() {
    const candidate = candidates.find((item) => item.id === modelId)
    if (!candidate) return
    setRunning(true)
    setResult(null)
    const report = (text: string) => {
      setMessage(text)
      window.__paraBench = { status: 'running', message: text }
    }
    try {
      const done = await runBenchmark(candidate, report)
      setResult(done)
      setMessage('Done')
      window.__paraBench = { status: 'done', message: 'Done', result: done }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      setMessage(`Failed: ${text}`)
      window.__paraBench = { status: 'error', message: text }
    }
    setRunning(false)
  }

  const lanes = result
    ? ([
        ['Rules only', result.rulesOnly],
        ['LLM only', result.llmOnly],
        ['Hybrid (app behaviour)', result.hybrid],
      ] as const)
    : []

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Model benchmark (dev only)</h1>
        <a href={backHref()} className="text-sm text-on-deep/80">
          ← Back
        </a>
      </header>
      <p className="surface rounded-xl bg-surface-warm px-3 py-2 text-sm text-ink-dark">
        Runs a real on-device model over {QUERIES.length} seed queries against the SYNTHETIC sample
        pack. The first run downloads the model.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Model
          <select
            name="model"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            className="surface rounded-lg border border-line bg-surface-cream px-2 py-2 text-sm text-ink-dark"
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label} ({candidate.id})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          data-testid="bench-run"
          disabled={running || !modelId}
          onClick={() => void run()}
          className="rounded-xl bg-accent-amber px-4 py-2 text-sm font-semibold text-ink-dark disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run benchmark'}
        </button>
      </div>
      <p data-testid="bench-status" className="text-sm break-words">
        {message}
      </p>

      {result && (
        <div className="surface overflow-x-auto rounded-xl bg-surface-cream p-3 text-sm text-ink-dark">
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr>
                <th className="pr-3">Lane</th>
                <th className="pr-3">O/D exact</th>
                <th className="pr-3">Preference</th>
                <th className="pr-3">Avoid</th>
                <th className="pr-3">Asks when unclear</th>
                <th>All fields</th>
              </tr>
            </thead>
            <tbody>
              {lanes.map(([name, lane]) => (
                <tr key={name}>
                  <td className="pr-3">{name}</td>
                  <td>{percent(lane.places)}</td>
                  <td>{percent(lane.preference)}</td>
                  <td>{percent(lane.avoid)}</td>
                  <td>{percent(lane.clarification)}</td>
                  <td>{percent(lane.exact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2">
            p50 {Math.round(result.p50Ms)} ms · p95 {Math.round(result.p95Ms)} ms ·{' '}
            {result.tokensPerSecond ? `${result.tokensPerSecond.toFixed(1)} tokens/s` : 'tokens/s n/a'} · load{' '}
            {(result.loadMs / 1000).toFixed(1)} s ({result.wasCached ? 'from cache' : 'with download'}) · invalid
            JSON {result.invalidJson}
          </p>
          <p className="mt-1">LLM-only misses: {result.llmOnly.misses.join(', ') || 'none'}</p>
        </div>
      )}
    </div>
  )
}
