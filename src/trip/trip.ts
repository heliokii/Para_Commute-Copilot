import { haversineKm } from '../router/geo.ts'
import { WALK_ROUTE_ID, type Leg, type Mode, type RoutePack } from '../router/types.ts'

// Pure trip logic: no browser APIs, no storage. Positions are used for one
// calculation and dropped.

export const TRIP_CONFIG = {
  /** Alert distances to the alight point, farthest first. */
  alertMeters: [1000, 300, 100],
  /** Fixes less accurate than this are ignored. */
  maxAccuracyMeters: 50,
  /** Within this distance a stop or alight point counts as passed. */
  passMeters: 40,
  /** Simulated GPS moves in steps no bigger than this, so a fast replay cannot skip a threshold. */
  simStepMeters: 25,
}

/** Simulated speeds in km/h. The fastest is for demos and tests. */
export const SIM_SPEEDS = [30, 120, 600, 3600]

export interface Pt {
  lat: number
  lon: number
}

export interface Fix extends Pt {
  /** Metres, as reported by the device. */
  accuracy: number
}

export interface TripStop {
  name: string
  at: Pt
}

export interface TripLeg {
  mode: Mode
  boardName: string
  alightName: string
  board: Pt
  alight: Pt
  /** Stops after the board point, in order. The last one is the alight point. */
  stops: TripStop[]
}

export interface TripState {
  legIndex: number
  /** Index into the current leg's stops: the next landmark ahead. */
  stopIndex: number
  /** Highest alert level already shown on this leg (0 = none). */
  firedLevel: number
  done: boolean
}

export interface TripAlert {
  legIndex: number
  /** 1 = first threshold (1 km) up to alertMeters.length. */
  level: number
  meters: number
}

export interface StepResult {
  state: TripState
  accepted: boolean
  /** Metres to the alight point of the leg the fix was applied to. */
  distanceM: number | null
  alert: TripAlert | null
}

export const START_STATE: TripState = { legIndex: 0, stopIndex: 0, firedLevel: 0, done: false }

export const distanceM = (a: Pt, b: Pt) => haversineKm(a.lat, a.lon, b.lat, b.lon) * 1000

/** How many thresholds the distance is inside: 0 (far) to alertMeters.length. */
export function alertLevel(meters: number, thresholds = TRIP_CONFIG.alertMeters): number {
  return thresholds.filter((threshold) => meters <= threshold).length
}

/** Leg index +1, or done after the last leg. */
export function advanceLeg(state: TripState, legCount: number): TripState {
  if (state.legIndex + 1 >= legCount) return { ...state, done: true }
  return { legIndex: state.legIndex + 1, stopIndex: 0, firedLevel: 0, done: false }
}

export function applyFix(state: TripState, fix: Fix, legs: TripLeg[], cfg = TRIP_CONFIG): StepResult {
  const leg = legs[state.legIndex]
  if (state.done || !leg || fix.accuracy > cfg.maxAccuracyMeters) {
    return { state, accepted: false, distanceM: null, alert: null }
  }
  const meters = distanceM(fix, leg.alight)

  let stopIndex = state.stopIndex
  while (stopIndex < leg.stops.length - 1 && distanceM(fix, leg.stops[stopIndex].at) <= cfg.passMeters) {
    stopIndex += 1
  }

  // Walking legs have no vehicle to get off, so only ride legs alert.
  const level = leg.mode === 'walk' ? 0 : alertLevel(meters, cfg.alertMeters)
  const alert = level > state.firedLevel ? { legIndex: state.legIndex, level, meters } : null
  const next = { ...state, stopIndex, firedLevel: Math.max(level, state.firedLevel) }

  // shortcut: "passed" means within passMeters of the alight point; a very sparse fix stream can skip it, use "Nakababa na ako".
  const passed = meters <= cfg.passMeters
  return { state: passed ? advanceLeg(next, legs.length) : next, accepted: true, distanceM: meters, alert }
}

/** Trip legs from a router result. Stops come from the pack's route; walking legs go straight. */
export function buildTripLegs(pack: RoutePack, legs: Leg[]): TripLeg[] {
  const landmark = (id: string) => pack.landmarks.find((candidate) => candidate.id === id)
  const stop = (id: string): TripStop => {
    const found = landmark(id)
    return { name: found?.name ?? id, at: { lat: found?.lat ?? 0, lon: found?.lon ?? 0 } }
  }
  return legs.map((leg) => {
    const ids = pack.routes
      .find((route) => route.id === leg.routeId && leg.routeId !== WALK_ROUTE_ID)
      ?.stops.map((routeStop) => routeStop.landmarkId)
    const from = ids?.indexOf(leg.boardId) ?? -1
    const to = ids?.indexOf(leg.alightId) ?? -1
    const between = ids && from >= 0 && to > from ? ids.slice(from + 1, to + 1) : [leg.alightId]
    const stops = between.map(stop)
    return {
      mode: leg.mode,
      boardName: stop(leg.boardId).name,
      alightName: stop(leg.alightId).name,
      board: stop(leg.boardId).at,
      alight: stop(leg.alightId).at,
      stops,
    }
  })
}

/** The whole trip as one polyline: first board point, then every stop in order. */
export function buildTrack(legs: TripLeg[]): Pt[] {
  return legs.length === 0 ? [] : [legs[0].board, ...legs.flatMap((leg) => leg.stops.map((s) => s.at))]
}

export function trackLengthM(track: Pt[]): number {
  return track.slice(1).reduce((sum, point, i) => sum + distanceM(track[i], point), 0)
}

/** The point `meters` along the track, clamped to its ends. */
export function pointAt(track: Pt[], meters: number): Pt {
  let left = Math.max(meters, 0)
  for (let i = 1; i < track.length; i++) {
    const length = distanceM(track[i - 1], track[i])
    if (left <= length) {
      const t = length === 0 ? 0 : left / length
      return {
        lat: track[i - 1].lat + (track[i].lat - track[i - 1].lat) * t,
        lon: track[i - 1].lon + (track[i].lon - track[i - 1].lon) * t,
      }
    }
    left -= length
  }
  return track.at(-1) ?? { lat: 0, lon: 0 }
}
