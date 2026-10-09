import type { MLCEngine } from '@mlc-ai/web-llm'
import type { LlmComplete } from './parse.ts'

// On-device LLM runtime: WebLLM on WebGPU. Nothing here calls a cloud AI API.
// The library is imported lazily so the app shell does not pay for it up front.
// The only network use is the one-time model download the rider starts by hand.

export interface Candidate {
  id: string
  label: string
  /** As published on the model card. Verify before submission. */
  license: string
}

/**
 * Small instruct models that were benchmarked (docs/model-benchmark.md). Each is
 * checked against WebLLM's own model list before use. The first one is the default:
 * in the benchmark it was the only model that always asked instead of guessing
 * when a request was unclear.
 */
export const CANDIDATES: Candidate[] = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B Instruct', license: 'Apache-2.0' },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'SmolLM2 1.7B Instruct', license: 'Apache-2.0' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B Instruct', license: 'Llama 3.2 Community License' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B Instruct', license: 'Apache-2.0' },
]

const webllm = () => import('@mlc-ai/web-llm')

export interface InferenceStats {
  latencyMs: number
  tokensPerSecond: number | null
  completionTokens: number | null
}

let engine: MLCEngine | null = null
let loadedModelId: string | null = null
let lastStats: InferenceStats | null = null

const statsListeners = new Set<() => void>()

export const getLastStats = () => lastStats

export function subscribeStats(listener: () => void) {
  statsListeners.add(listener)
  return () => {
    statsListeners.delete(listener)
  }
}
export const getLoadedModelId = () => loadedModelId

/** True when the browser exposes WebGPU and an adapter can be obtained. */
export async function detectWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return Boolean(gpu && (await gpu.requestAdapter()))
  } catch {
    return false
  }
}

/** Candidates that really exist in this WebLLM build's model list. */
export async function availableCandidates(): Promise<Candidate[]> {
  const { prebuiltAppConfig } = await webllm()
  const known = new Set(prebuiltAppConfig.model_list.map((model) => model.model_id))
  return CANDIDATES.filter((candidate) => known.has(candidate.id))
}

export async function isModelCached(modelId: string): Promise<boolean> {
  try {
    return await (await webllm()).hasModelInCache(modelId)
  } catch {
    return false
  }
}

/**
 * Downloads (if needed) and loads a model. Shards already in the cache are
 * skipped, so calling this again after a failure resumes the download.
 */
export async function loadModel(
  modelId: string,
  onProgress?: (progress: number, text: string) => void,
): Promise<void> {
  if (engine && loadedModelId === modelId) return
  await unloadModel()
  const { CreateMLCEngine } = await webllm()
  engine = await CreateMLCEngine(modelId, {
    initProgressCallback: (report) => onProgress?.(report.progress, report.text),
  })
  loadedModelId = modelId
}

export async function unloadModel(): Promise<void> {
  const current = engine
  engine = null
  loadedModelId = null
  await current?.unload().catch(() => {})
}

export async function deleteModel(modelId: string): Promise<void> {
  if (loadedModelId === modelId) await unloadModel()
  await (await webllm()).deleteModelAllInfoInCache(modelId)
}

/** Temperature 0, JSON constrained by schema. Throws if no model is loaded. */
export const complete: LlmComplete = async ({ system, user, schema, maxTokens = 200 }) => {
  if (!engine) throw new Error('No model loaded')
  const started = performance.now()
  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0,
    max_tokens: maxTokens,
    response_format: { type: 'json_object', schema: JSON.stringify(schema) },
  })
  lastStats = {
    latencyMs: performance.now() - started,
    tokensPerSecond: reply.usage?.extra?.decode_tokens_per_s ?? null,
    completionTokens: reply.usage?.completion_tokens ?? null,
  }
  statsListeners.forEach((listener) => listener())
  return reply.choices[0]?.message?.content ?? ''
}
