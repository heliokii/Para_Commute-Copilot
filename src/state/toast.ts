import { useSyncExternalStore } from 'react'
import type { TsupherState } from '../components/Tsupher'

// One short message at a time, e.g. "Na-save sa Paborito!" with the Love sprite.

export interface ToastState {
  id: number
  text: string
  sprite: TsupherState | null
}

let state: ToastState | null = null
let nextId = 1
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function set(next: ToastState | null) {
  state = next
  listeners.forEach((listener) => listener())
}

export function showToast(text: string, sprite: TsupherState | null = null, ms = 2600) {
  clearTimeout(timer)
  set({ id: nextId++, text, sprite })
  timer = setTimeout(() => set(null), ms)
}

export function useToast(): ToastState | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}
