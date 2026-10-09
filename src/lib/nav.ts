import { useSyncExternalStore } from 'react'
import type { IconName } from '../components/Icon'
import { copy } from '../copy'

// Hash routing keeps every screen on the precached index.html.

export type Tab = 'home' | 'ruta' | 'mapa' | 'paborito' | 'higit'
/** Full-screen views that sit on top of the tabs. */
export type Overlay =
  | 'results'
  | 'detail'
  | 'trip'
  | 'modes'
  | 'chat'
  | 'setup'
  | 'offline'
  | 'about'
  | 'settings'
  | 'dev-router'
  | 'dev-components'
  | 'dev-bench'

export const TAB_PATHS: Record<Tab, string> = {
  home: '/',
  ruta: '/ruta',
  mapa: '/mapa',
  paborito: '/paborito',
  higit: '/higit',
}

export const OVERLAY_PATHS: Record<Overlay, string> = {
  results: '/ruta/results',
  detail: '/ruta/detail',
  trip: '/ruta/trip',
  modes: '/modes',
  chat: '/chat',
  setup: '/setup',
  offline: '/offline',
  about: '/about',
  settings: '/settings',
  'dev-router': '/dev/router',
  'dev-components': '/dev/components',
  'dev-bench': '/dev/bench',
}

/** Shared by the bottom nav (phone) and the side nav (dashboard). */
export const NAV_ITEMS: { tab: Tab; icon: IconName; label: string }[] = [
  { tab: 'home', icon: 'home', label: copy.nav.home },
  { tab: 'ruta', icon: 'route', label: copy.nav.ruta },
  { tab: 'mapa', icon: 'map', label: copy.nav.mapa },
  { tab: 'paborito', icon: 'star', label: copy.nav.paborito },
  { tab: 'higit', icon: 'menu', label: copy.nav.higit },
]

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
  if (overlay) {
    // Plan-flow overlays belong to the Ruta tab, wherever they were opened from.
    if (OVERLAY_PATHS[overlay].startsWith('/ruta/')) lastTab = 'ruta'
    return { tab: lastTab, overlay }
  }
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

export function go(path: string) {
  location.hash = path
}
