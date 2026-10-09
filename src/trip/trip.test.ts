import { describe, expect, it } from 'vitest'
import { SYNTHETIC_PACK as pack } from '../router/__fixtures__/synthetic-pack.ts'
import type { Leg } from '../router/types.ts'
import {
  START_STATE,
  TRIP_CONFIG,
  advanceLeg,
  alertLevel,
  applyFix,
  buildTrack,
  buildTripLegs,
  distanceM,
  pointAt,
  trackLengthM,
  type Pt,
  type TripLeg,
  type TripState,
} from './trip.ts'

// Fixed coordinates on the equator, where 0.001 degrees of longitude is about 111.2 m.
const at = (lonMeters: number): Pt => ({ lat: 0, lon: lonMeters / 111195 })
const fix = (lonMeters: number, accuracy = 10) => ({ ...at(lonMeters), accuracy })

const rideLeg = (alightM: number, mode: TripLeg['mode'] = 'jeepney'): TripLeg => ({
  mode,
  boardName: 'Start',
  alightName: 'End',
  board: at(0),
  alight: at(alightM),
  stops: [{ name: 'Mid', at: at(alightM / 2) }, { name: 'End', at: at(alightM) }],
})

describe('distance', () => {
  it('matches the known length of 0.05 degrees of longitude at the equator', () => {
    expect(distanceM({ lat: 0, lon: 0 }, { lat: 0, lon: 0.05 })).toBeCloseTo(5559.75, 0)
  })
  it('is zero for the same point and symmetric', () => {
    expect(distanceM(at(0), at(0))).toBe(0)
    expect(distanceM(at(0), at(500))).toBeCloseTo(distanceM(at(500), at(0)), 6)
  })
})

describe('alert thresholds', () => {
  it('are 1 km, 300 m and 100 m', () => {
    expect(TRIP_CONFIG.alertMeters).toEqual([1000, 300, 100])
  })
  it('count the thresholds the distance is inside', () => {
    expect([1500, 1000, 999, 300, 299, 100, 99, 0].map((m) => alertLevel(m))).toEqual([0, 1, 1, 2, 2, 3, 3, 3])
  })
})

describe('applyFix', () => {
  const legs = [rideLeg(3000)]

  it('ignores fixes less accurate than the filter', () => {
    const step = applyFix(START_STATE, fix(2900, 51), legs)
    expect(step.accepted).toBe(false)
    expect(step.state).toBe(START_STATE)
    expect(applyFix(START_STATE, fix(2900, 50), legs).accepted).toBe(true)
  })

  it('fires each level once, in order, as the rider approaches', () => {
    let state: TripState = START_STATE
    const fired: number[] = []
    for (const position of [500, 1900, 1950, 2500, 2750, 2900, 2950]) {
      const step = applyFix(state, fix(position), legs)
      state = step.state
      if (step.alert) fired.push(step.alert.level)
    }
    expect(fired).toEqual([1, 2, 3])
  })

  it('reports only the highest level when a fix skips thresholds', () => {
    const step = applyFix(START_STATE, fix(2950), legs)
    expect(step.alert?.level).toBe(3)
    expect(step.alert?.meters).toBeCloseTo(50, 0)
  })

  it('does not alert on walking legs', () => {
    const step = applyFix(START_STATE, fix(250), [rideLeg(300, 'walk')])
    expect(step.alert).toBeNull()
  })

  it('moves the next landmark past a stop that was reached', () => {
    expect(applyFix(START_STATE, fix(500), legs).state.stopIndex).toBe(0)
    expect(applyFix(START_STATE, fix(1500), legs).state.stopIndex).toBe(1)
  })
})

describe('leg advance', () => {
  const legs = [rideLeg(1000), rideLeg(2000)]

  it('advances when the alight point is passed, and resets the alert level', () => {
    const near = applyFix(START_STATE, fix(990), legs)
    expect(near.alert?.level).toBe(3)
    expect(near.state).toMatchObject({ legIndex: 1, stopIndex: 0, firedLevel: 0, done: false })
  })

  it('does not advance outside the pass radius', () => {
    expect(applyFix(START_STATE, fix(900), legs).state.legIndex).toBe(0)
  })

  it('finishes after the last leg, by position or by the manual button', () => {
    const last: TripState = { legIndex: 1, stopIndex: 0, firedLevel: 0, done: false }
    expect(applyFix(last, fix(1990), legs).state.done).toBe(true)
    expect(advanceLeg(START_STATE, 2).legIndex).toBe(1)
    expect(advanceLeg(last, 2).done).toBe(true)
  })

  it('ignores fixes once done', () => {
    const done: TripState = { ...START_STATE, done: true }
    expect(applyFix(done, fix(990), legs).accepted).toBe(false)
  })
})

describe('trip legs and track from the synthetic pack', () => {
  // A to C by R1 (via B), then C to F by R3 (via E). Hand-written, not from the router.
  const result: Leg[] = [
    { routeId: 'R1', mode: 'jeepney', boardId: 'A', alightId: 'C', distKm: 6, minutes: 30, fare: 13 },
    { routeId: 'R3', mode: 'jeepney', boardId: 'C', alightId: 'F', distKm: 6, minutes: 15, fare: 13 },
  ]
  const legs = buildTripLegs(pack, result)

  it('takes stops from the pack routes', () => {
    expect(legs.map((leg) => leg.stops.map((s) => s.name))).toEqual([
      ['SYN Bravo Market', 'SYN Charlie Junction'],
      ['SYN Echo Mall', 'SYN Foxtrot Station'],
    ])
  })

  it('builds a track that starts at the origin and ends at the destination', () => {
    const track = buildTrack(legs)
    expect(track).toHaveLength(5)
    expect(pointAt(track, 0)).toEqual({ lat: 0, lon: 0 })
    expect(pointAt(track, 1e9)).toEqual({ lat: 0.03, lon: 0.08 })
    expect(pointAt(track, trackLengthM(track) / 2)).not.toEqual(pointAt(track, 0))
  })

  it('a simulated replay along the track reaches every alert and finishes', () => {
    const track = buildTrack(legs)
    let state: TripState = START_STATE
    const alerts: string[] = []
    for (let m = 0; m <= trackLengthM(track) + 25; m += TRIP_CONFIG.simStepMeters) {
      const step = applyFix(state, { ...pointAt(track, m), accuracy: 5 }, legs)
      state = step.state
      if (step.alert) alerts.push(`${step.alert.legIndex}:${step.alert.level}`)
    }
    expect(alerts).toEqual(['0:1', '0:2', '0:3', '1:1', '1:2', '1:3'])
    expect(state.done).toBe(true)
  })
})
