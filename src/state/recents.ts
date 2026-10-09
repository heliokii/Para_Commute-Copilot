import { useSyncExternalStore } from 'react'
import type { Intent } from '../router/types.ts'
import { routeFavoriteId } from './favorites.ts'

// "Kamakailang Hinanap": trips searched in this session. In memory only, like
// the chat (CLAUDE.md rule 5): it holds landmark ids and a preference, never
// typed text, and it is gone when the app closes.

export const RECENTS_MAX = 8

export interface Recent {
  key: string
  intent: Intent
}

let state: Recent[] = []
const listeners = new Set<() => void>()

function set(next: Recent[]) {
  state = next
  listeners.forEach((listener) => listener())
}

/** Newest first, one entry per trip and preference. */
export function recordRecent(intent: Intent) {
  const key = routeFavoriteId(intent)
  set([{ key, intent }, ...state.filter((recent) => recent.key !== key)].slice(0, RECENTS_MAX))
}

export const clearRecents = () => set([])
export const getRecents = () => state

export function useRecents(): Recent[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}
