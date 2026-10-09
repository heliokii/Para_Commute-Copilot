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

function subscribeHash(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export type RoutePath = '/' | '/about' | '/dev/router'

// Hash routing keeps every screen on the precached index.html.
export function useHashRoute(): RoutePath {
  const hash = useSyncExternalStore(subscribeHash, () => location.hash)
  if (hash === '#/about') return '/about'
  if (hash === '#/dev/router') return '/dev/router'
  return '/'
}
