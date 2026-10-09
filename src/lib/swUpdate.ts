import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Service worker registration with a rider-controlled update. A new version
// waits until the rider taps "I-update", so it can never reload the app in the
// middle of a chat or a trip.

let applyUpdate: (() => Promise<void>) | null = null
const listeners = new Set<() => void>()

export function registerServiceWorker() {
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      applyUpdate = () => update(true)
      listeners.forEach((listener) => listener())
    },
  })
}

/** Non-null when a new version is downloaded and waiting. Calling it reloads into the new version. */
export function useUpdateReady(): (() => Promise<void>) | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => applyUpdate,
  )
}
