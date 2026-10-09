import { useSyncExternalStore } from 'react'

// Hash routing keeps every screen on the precached index.html.

export type Tab = 'home' | 'ruta' | 'mapa' | 'paborito' | 'higit'
/** Full-screen views that sit on top of the tabs. */
export type Overlay = 'offline' | 'about' | 'dev-router' | 'dev-components'

export const TAB_PATHS: Record<Tab, string> = {
  home: '/',
  ruta: '/ruta',
  mapa: '/mapa',
  paborito: '/paborito',
  higit: '/higit',
}

export const OVERLAY_PATHS: Record<Overlay, string> = {
  offline: '/offline',
  about: '/about',
  'dev-router': '/dev/router',
  'dev-components': '/dev/components',
}

export interface Route {
  tab: Tab
  overlay: Overlay | null
}

let lastTab: Tab = 'home'

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  const overlay = (Object.keys(OVERLAY_PATHS) as Overlay[]).find(
    (key) => OVERLAY_PATHS[key] === path,
  )
  if (overlay) return { tab: lastTab, overlay }
  const tab = (Object.keys(TAB_PATHS) as Tab[]).find((key) => TAB_PATHS[key] === path) ?? 'home'
  lastTab = tab
  return { tab, overlay: null }
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return parse(hash)
}

/** Where an overlay's back button returns to. */
export function backHref(): string {
  return `#${TAB_PATHS[lastTab]}`
}
