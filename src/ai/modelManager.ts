import { useSyncExternalStore } from 'react'
import type { LlmComplete } from './parse.ts'
import {
  availableCandidates,
  complete,
  deleteModel,
  detectWebGpu,
  getLoadedModelId,
  isModelCached,
  loadModel,
  type Candidate,
} from './runtime.ts'

// Model download manager. The app stays usable through the rules lane whenever
// the model is missing, still downloading, or failed to load.

const SELECTED_KEY = 'para.model'
const SIZE_KEY = 'para.model.bytes'
/** Id of the model last downloaded successfully. A hint only; Setup verifies it against the real cache. */
const READY_KEY = 'para.model.ready'

export type ModelStatus =
  | 'unknown'
  | 'unsupported' // no WebGPU
  | 'absent'
  | 'downloading'
  | 'cached' // on disk, not loaded into memory yet
  | 'ready'
  | 'error'

export type ModelErrorKind = 'quota' | 'memory' | 'other'

/** Sorts a failure into storage-full, out-of-memory, or anything else. */
export function classifyError(error: unknown): ModelErrorKind {
  const name = error instanceof Error ? error.name : ''
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (name === 'QuotaExceededError' || /quota|storage (is )?full|not enough (disk )?space/.test(message)) return 'quota'
  if (/out of memory|oom|device (was )?lost|allocation failed|memory/.test(message)) return 'memory'
  return 'other'
}

export interface ModelState {
  status: ModelStatus
  candidates: Candidate[]
  selectedId: string
  /** 0 to 1 while downloading or loading. */
  progress: number
  progressText: string
  error: string
  /** Why the last download or load failed, for a plain-language message. */
  errorKind: ModelErrorKind
  /** Bytes this origin stores, from navigator.storage.estimate(). */
  storageUsed: number | null
  storageQuota: number | null
  /** Storage growth measured across the model download. */
  modelBytes: number | null
  persisted: boolean | null
}

let state: ModelState = {
  status: 'unknown',
  candidates: [],
  selectedId: '',
  progress: 0,
  progressText: '',
  error: '',
  errorKind: 'other',
  storageUsed: null,
  storageQuota: null,
  modelBytes: null,
  persisted: null,
}

const listeners = new Set<() => void>()

function set(patch: Partial<ModelState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

export const getModelState = () => state

export function useModel(): ModelState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

const readStored = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStored = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the choice simply does not survive a reload.
  }
}

async function refreshStorage() {
  try {
    const estimate = await navigator.storage?.estimate?.()
    const persisted = await navigator.storage?.persisted?.()
    set({
      storageUsed: estimate?.usage ?? null,
      storageQuota: estimate?.quota ?? null,
      persisted: persisted ?? null,
    })
  } catch {
    // Estimates are optional.
  }
}

let starting: Promise<void> | null = null
let initializing: Promise<void> | null = null

/**
 * Cheap start-up check for the shell: WebGPU plus the remembered download.
 * It does not import the model runtime, so Home stays light.
 */
export function peekModel(): Promise<void> {
  starting ??= (async () => {
    if (state.status !== 'unknown') return
    if (!(await detectWebGpu())) {
      set({ status: 'unsupported' })
      return
    }
    const selectedId = readStored(SELECTED_KEY) ?? ''
    const ready = selectedId !== '' && readStored(READY_KEY) === selectedId
    if (state.status === 'unknown') set({ selectedId, status: ready ? 'cached' : 'absent' })
  })().catch(() => {})
  return starting
}

/** Full check for the Setup screen: real model list and the real cache. */
export function initModelManager(): Promise<void> {
  initializing ??= (async () => {
    await refreshStorage()
    if (!(await detectWebGpu())) {
      set({ status: 'unsupported' })
      return
    }
    const candidates = await availableCandidates()
    const stored = readStored(SELECTED_KEY)
    const selectedId =
      candidates.find((candidate) => candidate.id === stored)?.id ?? candidates[0]?.id ?? ''
    const cached = selectedId ? await isModelCached(selectedId) : false
    const bytes = Number(readStored(SIZE_KEY))
    writeStored(READY_KEY, cached ? selectedId : null)
    // A download or a loaded model started meanwhile wins over this snapshot.
    const settled = state.status === 'downloading' || state.status === 'ready'
    set({
      candidates,
      selectedId,
      ...(settled ? {} : { status: cached ? 'cached' : 'absent' }),
      modelBytes: cached && bytes > 0 ? bytes : null,
    })
  })().catch((error) => {
    set({ status: 'error', error: String(error) })
  })
  return initializing
}

export async function selectModel(modelId: string) {
  if (state.status === 'downloading') return
  writeStored(SELECTED_KEY, modelId)
  const cached = await isModelCached(modelId)
  writeStored(READY_KEY, cached ? modelId : null)
  set({ selectedId: modelId, status: cached ? 'cached' : 'absent', error: '' })
}

/**
 * Downloads and loads the selected model. This is the only place the app uses
 * the network at runtime, and only when the rider asks for it.
 */
export async function downloadModel(): Promise<void> {
  const modelId = state.selectedId
  if (!modelId || state.status === 'downloading') return
  set({ status: 'downloading', progress: 0, progressText: '', error: '' })
  try {
    // Ask the browser not to evict the model under storage pressure.
    await navigator.storage?.persist?.().catch(() => false)
    const before = (await navigator.storage?.estimate?.())?.usage ?? 0
    await loadModel(modelId, (progress, progressText) => set({ progress, progressText }))
    const after = (await navigator.storage?.estimate?.())?.usage ?? 0
    const grown = after - before
    // Only a real download makes storage grow; a reload from cache keeps the stored figure.
    if (grown > 1024 * 1024) writeStored(SIZE_KEY, String(grown))
    writeStored(SELECTED_KEY, modelId)
    writeStored(READY_KEY, modelId)
    set({
      status: 'ready',
      progress: 1,
      modelBytes: grown > 1024 * 1024 ? grown : Number(readStored(SIZE_KEY)) || null,
    })
  } catch (error) {
    // Cached shards stay, so trying again resumes.
    set({ status: 'error', error: error instanceof Error ? error.message : String(error), errorKind: classifyError(error) })
  }
  await refreshStorage()
}

export async function removeModel(): Promise<void> {
  const modelId = state.selectedId
  if (!modelId || state.status === 'downloading') return
  await deleteModel(modelId)
  writeStored(SIZE_KEY, null)
  writeStored(READY_KEY, null)
  set({ status: 'absent', progress: 0, progressText: '', modelBytes: null, error: '' })
  await refreshStorage()
}

/**
 * The on-device model as a parser backend, or undefined when the rules lane
 * must be used (no WebGPU, no model, download in progress, or load failure).
 */
export function getLlm(): LlmComplete | undefined {
  if (state.status !== 'ready' && state.status !== 'cached') return undefined
  return async (request) => {
    if (getLoadedModelId() !== state.selectedId) {
      // First use after a reload: load from the local cache, no network.
      try {
        await loadModel(state.selectedId, (progress, progressText) => set({ progress, progressText }))
        set({ status: 'ready' })
      } catch (error) {
        set({ status: 'error', error: error instanceof Error ? error.message : String(error), errorKind: classifyError(error) })
        throw error
      }
    }
    return complete(request)
  }
}
