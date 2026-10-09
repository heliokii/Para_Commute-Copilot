import { useEffect, useState, useSyncExternalStore } from 'react'

// Evidence for the Offline Mode screen. Every value here is observed at
// runtime; nothing is a constant that merely looks like a check.

// --- Requests to other origins ---------------------------------------------

let crossOriginCount = 0
const crossOriginHosts = new Set<string>()
const listeners = new Set<() => void>()
let watching = false

function record(entries: PerformanceEntryList) {
  let changed = false
  for (const entry of entries) {
    try {
      const url = new URL(entry.name, location.href)
      if (url.origin !== location.origin && (url.protocol === 'http:' || url.protocol === 'https:')) {
        crossOriginCount++
        crossOriginHosts.add(url.host)
        changed = true
      }
    } catch {
      // Not a URL: ignore.
    }
  }
  if (changed) listeners.forEach((listener) => listener())
}

/**
 * Counts every resource the page loads from another origin, using the
 * browser's own resource timing (so it also sees requests made by libraries).
 * Call once at start-up.
 */
export function watchCrossOriginRequests() {
  if (watching || typeof PerformanceObserver === 'undefined') return
  watching = true
  try {
    new PerformanceObserver((list) => record(list.getEntries())).observe({
      type: 'resource',
      buffered: true,
    })
  } catch {
    watching = false
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCrossOriginRequests() {
  const count = useSyncExternalStore(subscribe, () => crossOriginCount)
  return { supported: watching, count, hosts: [...crossOriginHosts] }
}

// --- Service worker ----------------------------------------------------------

export type ServiceWorkerState = 'unsupported' | 'none' | 'installing' | 'active'

async function readServiceWorker(): Promise<ServiceWorkerState> {
  if (!('serviceWorker' in navigator)) return 'unsupported'
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return 'none'
  // "Active" means a worker is activated and this page is under its control.
  if (registration.active?.state === 'activated' && navigator.serviceWorker.controller) return 'active'
  return 'installing'
}

export function useServiceWorkerState(): ServiceWorkerState | null {
  const [state, setState] = useState<ServiceWorkerState | null>(null)
  useEffect(() => {
    let cancelled = false
    const refresh = () => void readServiceWorker().then((next) => !cancelled && setState(next))
    refresh()
    navigator.serviceWorker?.addEventListener('controllerchange', refresh)
    const timer = setInterval(refresh, 2000)
    return () => {
      cancelled = true
      navigator.serviceWorker?.removeEventListener('controllerchange', refresh)
      clearInterval(timer)
    }
  }, [])
  return state
}

// --- Fare freshness ----------------------------------------------------------

/** A fare table older than this is flagged as possibly out of date. */
export const FARE_STALE_DAYS = 180

/** Whole days between an ISO date (YYYY-MM-DD) and now. null if the date is not valid. */
export function daysSince(isoDate: string, now: Date = new Date()): number | null {
  const then = Date.parse(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(then)) return null
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((today - then) / 86_400_000)
}

export function isFareStale(isoDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!isoDate) return false
  const days = daysSince(isoDate, now)
  return days !== null && days > FARE_STALE_DAYS
}
