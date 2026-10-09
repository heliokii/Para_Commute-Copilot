import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Pose } from './theme'

/** The video's whole motion language: three springs, nothing linear. */
export const SPRINGS = {
  /** Taps, chips, quick exits. */
  snappy: { damping: 22, stiffness: 240, mass: 0.6 },
  /** Camera moves, device poses, scene changes. */
  smooth: { damping: 24, stiffness: 80, mass: 1 },
  /** Entrances with a slight overshoot: cards, words, Tsupher. */
  bouncy: { damping: 11, stiffness: 140, mass: 0.8 },
} as const
export type Preset = keyof typeof SPRINGS

/** Time in seconds plus a spring that starts at a given second. */
export function useMotion() {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const t = frame / fps
  /** 0 before `at`, settles at 1 after it. */
  const s = (at: number, preset: Preset = 'smooth') => spring({ frame: frame - at * fps, fps, config: SPRINGS[preset] })
  /** Springs in at `from` and back out at `to`. */
  const inOut = (from: number, to: number, preset: Preset = 'bouncy') => s(from, preset) * (1 - s(to, 'snappy'))
  return { frame, fps, t, s, inOut, width, height, portrait: height > width }
}

export const mix = (a: number, b: number, p: number) => a + (b - a) * p

/** Eases from each pose to the next with the smooth spring. */
export function usePose(poses: Pose[]) {
  const { s } = useMotion()
  return poses.slice(1).reduce((current, next) => {
    const p = s(next.at, 'smooth')
    return { at: next.at, x: mix(current.x, next.x, p), y: mix(current.y, next.y, p), scale: mix(current.scale, next.scale, p), rotX: mix(current.rotX, next.rotX, p), rotY: mix(current.rotY, next.rotY, p) }
  }, poses[0])
}
