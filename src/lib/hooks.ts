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

// Tailwind's xl breakpoint: the dashboard layout needs room for three columns.
const WIDE = '(min-width: 80rem)'

function subscribeWide(listener: () => void) {
  const query = matchMedia(WIDE)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

export function useWide() {
  return useSyncExternalStore(subscribeWide, () => matchMedia(WIDE).matches)
}

export function useBytesSent() {
  return useSyncExternalStore(subscribeBytesSent, getBytesSent)
}
