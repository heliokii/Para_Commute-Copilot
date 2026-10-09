import { interpolate } from 'remotion'
import about from '../footage/real-about.json'
import chat from '../footage/real-chat.json'
import dashboard from '../footage/real-dashboard.json'
import home from '../footage/real-home.json'
import mapa from '../footage/real-mapa.json'
import offline from '../footage/real-offline.json'
import sampleChat from '../footage/sample-chat.json'
import sampleTrip from '../footage/sample-trip.json'

export interface ClipMeta {
  name: string
  build: string
  viewport: { width: number; height: number; deviceScaleFactor: number }
  /** Capture time of each recorded frame, in seconds. */
  frames: number[]
  marks: { t: number; label: string; x?: number; y?: number }[]
}

export const CLIPS = { home, chat, mapa, dashboard, offline, about, sampleChat, sampleTrip }

/** Capture time of a mark; a missing mark stops the render instead of guessing. */
export function mark(clip: ClipMeta, label: string) {
  const found = clip.marks.find((entry) => entry.label === label)
  if (!found) throw new Error(`${clip.name}: no mark "${label}". Re-run the capture or fix the label.`)
  return found
}

/** [video second, capture second] pairs; playback speed between them is whatever fits. */
export type Keys = [number, number][]

export function captureTime(t: number, keys: Keys) {
  return interpolate(t, keys.map((key) => key[0]), keys.map((key) => key[1]), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}
