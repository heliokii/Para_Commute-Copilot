import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
// The ONNX Runtime files are served by this app. Without these, transformers.js
// would fetch them from cdn.jsdelivr.net.
import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import { detectWebGpu } from '../ai/runtime.ts'

// On-device speech recognition: Whisper through transformers.js (ONNX Runtime
// Web), on WebGPU when the browser has it, else WASM. The Web Speech API is not
// used anywhere. The only network use is the one-time model download the rider
// starts from the Setup screen.

export interface VoiceCandidate {
  id: string
  label: string
  /** As published on the base model's card. The ONNX conversion repo carries no licence tag of its own. */
  license: string
  /**
   * Download size per backend, runtime files included. Measured on 2026-10-09 for
   * tiny and base on WebGPU (142 and 224 MB); the WASM figures are computed from
   * the file sizes the model repository lists plus the same 28 MB of runtime.
   */
  approxMb: Record<VoiceBackend, number>
}

export type VoiceBackend = 'webgpu' | 'wasm'

/** Multilingual Whisper builds. The first one is the default. */
export const VOICE_CANDIDATES: VoiceCandidate[] = [
  { id: 'onnx-community/whisper-tiny', label: 'Whisper tiny', license: 'Apache-2.0 (openai/whisper-tiny)', approxMb: { webgpu: 142, wasm: 67 } },
  { id: 'onnx-community/whisper-base', label: 'Whisper base', license: 'Apache-2.0 (openai/whisper-base)', approxMb: { webgpu: 224, wasm: 101 } },
]

/** transformers.js has no language auto-detect: with no language it assumes English. */
export type VoiceLanguage = 'tagalog' | 'english'
/** Untested on human speech. Compare both on /voice-bench before trusting it. */
export const VOICE_LANGUAGE: VoiceLanguage = 'tagalog'

/** Cache Storage bucket transformers.js keeps model files and the ONNX Runtime files in. */
const CACHE_NAME = 'transformers-cache'
const MODEL_HOST = 'https://huggingface.co/'

const transformers = () => import('@huggingface/transformers')

let pipe: AutomaticSpeechRecognitionPipeline | null = null
let loadedId: string | null = null
let backend: VoiceBackend | null = null

/** Measured on the last transcription in this session. Numbers only: no audio or text is kept. */
let lastVoiceStats: { latencyMs: number; audioSeconds: number } | null = null

export const getLastVoiceStats = () => lastVoiceStats
export const getLoadedVoiceId = () => loadedId
export const getVoiceBackend = () => backend

/** True when the model's config is in the local cache. A partial download also passes; loading then fails and says so. */
export async function isVoiceCached(modelId: string): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME)
    return Boolean(await cache.match(`${MODEL_HOST}${modelId}/resolve/main/config.json`))
  } catch {
    return false
  }
}

/**
 * Bytes the speech model and its ONNX Runtime files take on this device, read
 * from the cache itself. (Storage estimates lag after a delete, so they are not used.)
 */
export async function voiceCacheBytes(): Promise<number | null> {
  try {
    const cache = await caches.open(CACHE_NAME)
    let total = 0
    for (const request of await cache.keys()) {
      const response = await cache.match(request)
      if (!response) continue
      total += Number(response.headers.get('content-length')) || (await response.blob()).size
    }
    return total > 0 ? total : null
  } catch {
    return null
  }
}

/**
 * Loads a Whisper model. With `allowDownload` false nothing is fetched from the
 * model host: a file missing from the local cache is an error.
 */
export async function loadWhisper(
  modelId: string,
  allowDownload: boolean,
  onProgress?: (progress: number, text: string) => void,
): Promise<void> {
  if (pipe && loadedId === modelId) return
  await unloadWhisper()
  const { env, pipeline } = await transformers()
  env.allowLocalModels = false
  // Loading a downloaded model: a request to the model host is answered here
  // with "not found", so a missing file is an error and nothing leaves the device.
  env.fetch = (input, init) =>
    !allowDownload && String(input instanceof Request ? input.url : input).startsWith(MODEL_HOST)
      ? Promise.resolve(new Response(null, { status: 404 }))
      : fetch(input, init)
  if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = { mjs: ortMjsUrl, wasm: ortWasmUrl }

  const device: VoiceBackend = (await detectWebGpu()) ? 'webgpu' : 'wasm'
  // Bytes per file, so the bar is weighted by size, not by file count.
  const files = new Map<string, { loaded: number; total: number }>()
  const created = await pipeline('automatic-speech-recognition', modelId, {
    device,
    // q4 decoder on WebGPU is what the transformers.js Whisper demo ships; 8-bit is the small WASM build.
    dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (report) => {
      if (report.status !== 'progress') return
      files.set(report.file, { loaded: report.loaded, total: report.total })
      let loaded = 0
      let total = 0
      for (const file of files.values()) {
        loaded += file.loaded
        total += file.total
      }
      onProgress?.(total > 0 ? loaded / total : 0, `${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB`)
    },
  })
  pipe = created as AutomaticSpeechRecognitionPipeline
  loadedId = modelId
  backend = device
}

export async function unloadWhisper(): Promise<void> {
  const current = pipe
  pipe = null
  loadedId = null
  backend = null
  await current?.dispose().catch(() => {})
}

/** Removes every Whisper file and the cached ONNX Runtime files. */
export async function deleteVoiceModels(): Promise<void> {
  await unloadWhisper()
  await caches.delete(CACHE_NAME)
}

/** 16 kHz mono samples in, text out. Throws if no model is loaded. */
export async function transcribe(
  audio: Float32Array,
  language: VoiceLanguage = VOICE_LANGUAGE,
): Promise<{ text: string; latencyMs: number }> {
  if (!pipe) throw new Error('No voice model loaded')
  const started = performance.now()
  const output = await pipe(audio, { language, task: 'transcribe' })
  const text = (Array.isArray(output) ? output[0]?.text : output.text) ?? ''
  lastVoiceStats = { latencyMs: performance.now() - started, audioSeconds: audio.length / 16000 }
  return { text: text.trim(), latencyMs: lastVoiceStats.latencyMs }
}
