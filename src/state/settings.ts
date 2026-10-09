import { useSyncExternalStore } from 'react'
import { db } from '../db/db.ts'

// Display settings, saved on this device in the Dexie `settings` table. Each one
// changes something real: the unit text on the route screens. There is no
// language setting: only Taglish exists.

export type DistanceUnit = 'km' | 'mi'
/** hm: "1 oras 20 min" from 60 minutes up. min: always minutes. */
export type TimeStyle = 'hm' | 'min'

export interface Settings {
  distanceUnit: DistanceUnit
  timeStyle: TimeStyle
}

export const DEFAULT_SETTINGS: Settings = { distanceUnit: 'km', timeStyle: 'hm' }

const OPTIONS: { [K in keyof Settings]: readonly Settings[K][] } = {
  distanceUnit: ['km', 'mi'],
  timeStyle: ['hm', 'min'],
}

/** Settings from stored rows. Unknown keys and values that are not allowed are ignored. */
export function parseSettings(rows: readonly { key: string; value: unknown }[]): Settings {
  const result = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (row.key === 'distanceUnit' && OPTIONS.distanceUnit.includes(row.value as DistanceUnit)) {
      result.distanceUnit = row.value as DistanceUnit
    }
    if (row.key === 'timeStyle' && OPTIONS.timeStyle.includes(row.value as TimeStyle)) {
      result.timeStyle = row.value as TimeStyle
    }
  }
  return result
}

let state: Settings = DEFAULT_SETTINGS
const listeners = new Set<() => void>()

function set(next: Settings) {
  state = next
  listeners.forEach((listener) => listener())
}

export const getSettings = () => state

export function useSettings(): Settings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

/** Reads the saved settings. Call once at start-up; defaults show until it finishes. */
export async function loadSettings(): Promise<void> {
  try {
    set(parseSettings(await db.settings.toArray()))
  } catch (error) {
    console.error('Settings failed to load', error)
  }
}

export async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  if (!OPTIONS[key].includes(value)) return
  set({ ...state, [key]: value })
  await db.settings.put({ key, value })
}

/** Back to the defaults. Used after "Burahin lahat ng data", which clears the table itself. */
export function resetSettingsInMemory() {
  set(DEFAULT_SETTINGS)
}
