import { describe, expect, it } from 'vitest'
import generated from '../db/generated/metro-manila-pack.json' with { type: 'json' }
import type { RoutePack } from '../router/types.ts'
import { describeStationFares, fareStations, lookupStationFares } from './lookup.ts'

const pack = generated as unknown as RoutePack
const AS_OF = '2026-10-10'

describe('station fare lookup on the real pack', () => {
  it('lists rail stations only', () => {
    const stations = fareStations(pack)
    expect(stations.length).toBe(pack.landmarks.length)
    expect(stations.every((station) => station.tags.includes('train'))).toBe(true)
  })

  it('returns scheduled and promotional fares from the matrices', () => {
    const rows = lookupStationFares(pack, 'rail-lrt1-dr_santos', 'rail-lrt1-ninoy_aquino', undefined, AS_OF)
    expect(rows.map((row) => row.calc.centavos).sort()).toEqual([1900, 2000]) // stored-value 19, single-journey 20 in lrt1-fare-matrices.json
    const mrt = lookupStationFares(pack, 'rail-mrt3-north_avenue', 'rail-mrt3-quezon_avenue', undefined, AS_OF)
    expect(mrt).toHaveLength(1)
    expect(mrt[0].calc.scheduledCentavos).toBe(1300)
    expect(mrt[0].calc.centavos).toBe(600)
  })

  it('has no answer across lines, for the same station, or for unknown ids', () => {
    expect(lookupStationFares(pack, 'rail-lrt1-dr_santos', 'rail-mrt3-taft_avenue', undefined, AS_OF)).toEqual([])
    expect(lookupStationFares(pack, 'rail-lrt1-pitx', 'rail-lrt1-pitx', undefined, AS_OF)).toEqual([])
    expect(lookupStationFares(pack, 'nope', 'rail-lrt1-pitx', undefined, AS_OF)).toEqual([])
  })

  it('says there is no data instead of guessing', () => {
    expect(describeStationFares([], 'A', 'B')[0]).toContain('Walang nakalistang pamasahe')
  })

  it('states every number from the calculation', () => {
    const rows = lookupStationFares(pack, 'rail-lrt2-recto', 'rail-lrt2-legarda', undefined, AS_OF)
    const text = describeStationFares(rows, 'Recto', 'Legarda').join(' ')
    expect(text).toContain('₱15.00')
    expect(text).toContain('as of')
  })
})
