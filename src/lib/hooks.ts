import { useSyncExternalStore } from 'react'
import { getBytesSent, subscribeBytesSent } from './netMeter'

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}

export function useBytesSent() {
  return useSyncExternalStore(subscribeBytesSent, getBytesSent)
}
