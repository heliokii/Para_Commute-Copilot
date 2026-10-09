import { describe, expect, it } from 'vitest'
import { SYNTHETIC_PACK as pack } from './__fixtures__/synthetic-pack.ts'
import { DEFAULT_ROUTER_CONFIG } from './config.ts'
import { planOptions, planRoute } from './plan.ts'
import type { Avoid, Intent, Preference, RoutePack, RouteResult } from './types.ts'

// Expected values are hand-computed in __fixtures__/synthetic-pack.ts.

const NO_AVOID: Avoid = { landmarkIds: [], routeIds: [], modes: [], tags: [] }

function intent(
  originId: string,
  destinationId: string,
  preference: Preference = 'cheapest',
  avoid: Partial<Avoid> = {},
): Intent {
  return { originId, destinationId, preference, avoid: { ...NO_AVOID, ...avoid } }
}

const sequence = (result: RouteResult) =>
  result.legs.map((leg) => `${leg.routeId}:${leg.boardId}>${leg.alightId}`)

describe('planRoute preferences', () => {
  it('cheapest and fastest differ for A to D', () => {
    const cheapest = planRoute(pack, intent('A', 'D', 'cheapest'))
    expect(cheapest.status).toBe('ok')
    expect(sequence(cheapest)).toEqual(['R1:A>D'])
    expect(cheapest.totalFare).toBe(18.25)
    expect(cheapest.totalMinutes).toBe(50)
    expect(cheapest.transfers).toBe(0)

    const fastest = planRoute(pack, intent('A', 'D', 'fastest'))
    expect(sequence(fastest)).toEqual(['R2:A>D'])
    expect(fastest.totalFare).toBe(30)
    expect(fastest.totalMinutes).toBe(20)
  })

  it('all three preferences differ for A to F', () => {
    const cheapest = planRoute(pack, intent('A', 'F', 'cheapest'))
    expect(sequence(cheapest)).toEqual(['R1:A>C', 'R3:C>F'])
    expect(cheapest.totalFare).toBe(26)
    expect(cheapest.totalMinutes).toBe(45)
    expect(cheapest.transfers).toBe(1)
    expect(cheapest.legs.map((leg) => leg.fare)).toEqual([13, 13])

    const fastest = planRoute(pack, intent('A', 'F', 'fastest'))
    expect(sequence(fastest)).toEqual(['R2:A>C', 'R3:C>F'])
    expect(fastest.totalFare).toBe(35.25)
    expect(fastest.totalMinutes).toBe(27)
    expect(fastest.transfers).toBe(1)

    const fewest = planRoute(pack, intent('A', 'F', 'fewest_transfers'))
    expect(sequence(fewest)).toEqual(['R1:A>F'])
    expect(fewest.totalFare).toBe(30.25)
    expect(fewest.totalMinutes).toBe(80)
    expect(fewest.transfers).toBe(0)
  })

  it('reports leg distance and minutes as sums of hops', () => {
    const [leg] = planRoute(pack, intent('A', 'D')).legs
    expect(leg).toEqual({
      routeId: 'R1',
      mode: 'jeepney',
      boardId: 'A',
      alightId: 'D',
      distKm: 9.5,
      minutes: 50,
      fare: 18.25,
    })
  })

  it('labels every result with its preference and flags', () => {
    const result = planRoute(pack, intent('A', 'F', 'fastest'))
    expect(result.preference).toBe('fastest')
    expect(result.simulated).toBe(false)
    expect(result.usedUnverifiedData).toBe(true)
  })
})

describe('fare as-of date', () => {
  it('comes from the FareEntry used', () => {
    expect(planRoute(pack, intent('A', 'D', 'cheapest')).fareAsOf).toBe('2026-01-01')
    expect(planRoute(pack, intent('A', 'D', 'fastest')).fareAsOf).toBe('2026-02-01')
  })

  it('shows the oldest date when legs use different fare tables', () => {
    const result = planRoute(pack, intent('A', 'F', 'fastest'))
    expect(result.fareAsOf).toBe('2026-01-01')
    expect(result.assumptions.join(' ')).toContain('different effective dates')
  })
})

describe('avoid-list', () => {
  it('avoid tag removes the tagged route and marks the result simulated', () => {
    const cheapest = planRoute(pack, intent('A', 'F', 'cheapest', { tags: ['EDSA'] }))
    expect(sequence(cheapest)).toEqual(['R1:A>F'])
    expect(cheapest.totalFare).toBe(30.25)
    expect(cheapest.simulated).toBe(true)

    const fastest = planRoute(pack, intent('A', 'F', 'fastest', { tags: ['EDSA'] }))
    expect(sequence(fastest)).toEqual(['R2:A>D', 'R4:D>F'])
    expect(fastest.totalFare).toBe(50)
    expect(fastest.totalMinutes).toBe(35)
  })

  it('avoid route', () => {
    const result = planRoute(pack, intent('A', 'F', 'fastest', { routeIds: ['R3'] }))
    expect(sequence(result)).toEqual(['R2:A>D', 'R4:D>F'])
    expect(result.simulated).toBe(true)
  })

  it('avoid mode', () => {
    const noBus = planRoute(pack, intent('A', 'F', 'fastest', { modes: ['bus'] }))
    expect(sequence(noBus)).toEqual(['R1:A>C', 'R3:C>F'])
    expect(noBus.totalFare).toBe(26)

    const noJeepney = planRoute(pack, intent('A', 'F', 'cheapest', { modes: ['jeepney'] }))
    expect(sequence(noJeepney)).toEqual(['R2:A>D', 'R4:D>F'])
    expect(noJeepney.simulated).toBe(true)
  })

  it('avoid landmark also blocks rides that pass through it', () => {
    // R3 C>F passes E, so it is unusable.
    const aroundE = planRoute(pack, intent('A', 'F', 'cheapest', { landmarkIds: ['E'] }))
    expect(sequence(aroundE)).toEqual(['R1:A>F'])
    expect(aroundE.simulated).toBe(true)

    // Every way out of A passes C.
    const aroundC = planRoute(pack, intent('A', 'F', 'cheapest', { landmarkIds: ['C'] }))
    expect(aroundC.status).toBe('no_route')
    expect(aroundC.reason).toBe('no_path')
    expect(aroundC.simulated).toBe(true)
  })

  it('avoiding the origin or destination is reported, not thrown', () => {
    expect(planRoute(pack, intent('A', 'D', 'cheapest', { landmarkIds: ['A'] })).reason).toBe(
      'origin_avoided',
    )
    expect(planRoute(pack, intent('A', 'D', 'cheapest', { landmarkIds: ['D'] })).reason).toBe(
      'destination_avoided',
    )
  })

  it('avoid walk mode removes walking legs', () => {
    const result = planRoute(pack, intent('A', 'G', 'cheapest', { modes: ['walk'] }))
    expect(result.reason).toBe('no_path')
  })
})

describe('walking legs', () => {
  it('connects landmarks within 300 m', () => {
    const result = planRoute(pack, intent('A', 'G', 'cheapest'))
    expect(sequence(result)).toEqual(['R1:A>D', 'walk:D>G'])
    expect(result.totalFare).toBe(18.25)
    expect(result.totalMinutes).toBe(53)
    expect(result.transfers).toBe(0)
    expect(result.legs[1]).toMatchObject({ mode: 'walk', distKm: 0.222, minutes: 3, fare: 0 })
  })

  it('a walk-only result has no fare date and uses no unverified route', () => {
    const result = planRoute(pack, intent('D', 'G'))
    expect(sequence(result)).toEqual(['walk:D>G'])
    expect(result.totalFare).toBe(0)
    expect(result.fareAsOf).toBeNull()
    expect(result.usedUnverifiedData).toBe(false)
  })

  it('respects the configured walking distance', () => {
    const config = { ...DEFAULT_ROUTER_CONFIG, walkMaxMeters: 100 }
    expect(planRoute(pack, intent('D', 'G'), config).reason).toBe('no_path')
  })
})

describe('no route and bad input', () => {
  it('isolated landmark', () => {
    const result = planRoute(pack, intent('A', 'H'))
    expect(result.status).toBe('no_route')
    expect(result.reason).toBe('no_path')
    expect(result.legs).toEqual([])
  })

  it('routes are forward-only', () => {
    expect(planRoute(pack, intent('D', 'A')).reason).toBe('no_path')
  })

  it('origin equals destination', () => {
    const result = planRoute(pack, intent('A', 'A'))
    expect(result.status).toBe('no_route')
    expect(result.reason).toBe('same_origin_destination')
  })

  it('unknown ids', () => {
    expect(planRoute(pack, intent('ZZ', 'A')).reason).toBe('unknown_origin')
    expect(planRoute(pack, intent('A', 'ZZ')).reason).toBe('unknown_destination')
  })

  it('never throws on malformed input', () => {
    const garbage = [
      {},
      null,
      { originId: 'A' },
      { originId: 'A', destinationId: 'D', preference: 'scenic' },
      { originId: 'A', destinationId: 'D', preference: 'cheapest', avoid: { tags: 'EDSA' } },
      { originId: 42, destinationId: [], avoid: null },
    ]
    for (const input of garbage) {
      expect(() => planRoute(pack, input as unknown as Intent)).not.toThrow()
      expect(() => planOptions(pack, input as unknown as Intent)).not.toThrow()
    }
    // An unknown preference falls back to cheapest.
    const fallback = planRoute(pack, {
      ...intent('A', 'D'),
      preference: 'scenic' as Preference,
    })
    expect(fallback.preference).toBe('cheapest')
    expect(fallback.totalFare).toBe(18.25)
  })

  it('skips a route whose fare table is missing and says so', () => {
    const broken: RoutePack = {
      ...pack,
      routes: pack.routes.map((route) =>
        route.id === 'R2' ? { ...route, fareTableId: 'missing' } : route,
      ),
    }
    const result = planRoute(broken, intent('A', 'D', 'fastest'))
    expect(sequence(result)).toEqual(['R1:A>D'])
    expect(result.assumptions.join(' ')).toContain('Route R2 skipped')
  })
})

describe('planOptions', () => {
  it('returns three distinct options when they differ', () => {
    const options = planOptions(pack, intent('A', 'F'))
    expect(options.map((option) => option.preference)).toEqual([
      'cheapest',
      'fastest',
      'fewest_transfers',
    ])
    expect(options.map((option) => option.totalFare)).toEqual([26, 35.25, 30.25])
  })

  it('de-duplicates by leg sequence', () => {
    // fastest and fewest_transfers both pick R2 A>D.
    const options = planOptions(pack, intent('A', 'D'))
    expect(options.map((option) => option.preference)).toEqual(['cheapest', 'fastest'])
    expect(options.map(sequence)).toEqual([['R1:A>D'], ['R2:A>D']])
  })

  it('returns a single no_route result when nothing is found', () => {
    const options = planOptions(pack, intent('A', 'H'))
    expect(options).toHaveLength(1)
    expect(options[0].status).toBe('no_route')
  })

  it('carries the avoid-list into every option', () => {
    const options = planOptions(pack, intent('A', 'F', 'cheapest', { tags: ['EDSA'] }))
    expect(options.every((option) => option.simulated)).toBe(true)
    expect(options.flatMap(sequence).some((leg) => leg.startsWith('R3'))).toBe(false)
  })
})

describe('determinism', () => {
  it('gives identical output over 100 runs', () => {
    const cases = [
      intent('A', 'F', 'cheapest'),
      intent('A', 'F', 'fastest'),
      intent('A', 'F', 'fewest_transfers', { tags: ['EDSA'] }),
      intent('A', 'G', 'fastest'),
      intent('A', 'H'),
    ]
    for (const testCase of cases) {
      const first = JSON.stringify(planOptions(pack, testCase))
      for (let run = 0; run < 100; run++) {
        expect(JSON.stringify(planOptions(pack, testCase))).toBe(first)
      }
    }
    // 500 plans: well under a second alone, but a loaded machine can pass the 5 s default.
  }, 20_000)

  it('does not depend on the order of routes, landmarks or fares in the pack', () => {
    const shuffled: RoutePack = {
      ...pack,
      landmarks: [...pack.landmarks].reverse(),
      routes: [...pack.routes].reverse(),
      fares: [...pack.fares].reverse(),
    }
    for (const preference of ['cheapest', 'fastest', 'fewest_transfers'] as const) {
      expect(planRoute(shuffled, intent('A', 'F', preference))).toEqual(
        planRoute(pack, intent('A', 'F', preference)),
      )
    }
  })

  it('does not mutate the pack', () => {
    const before = JSON.stringify(pack)
    planOptions(pack, intent('A', 'F', 'cheapest', { tags: ['EDSA'] }))
    expect(JSON.stringify(pack)).toBe(before)
  })
})

describe('fares come only from FareEntry data', () => {
  const withFares = (change: (fare: RoutePack['fares'][number]) => RoutePack['fares'][number]) => ({
    ...pack,
    fares: pack.fares.map(change),
  })

  it('doubling the fare table doubles the totals', () => {
    const doubled = withFares((fare) => ({
      ...fare,
      rule: fare.rule.kind === 'distance'
        ? { ...fare.rule, baseFare: fare.rule.baseFare * 2, perKm: fare.rule.perKm * 2 }
        : fare.rule,
    }))
    // R1 A>D: 20 + 5.5 * 3 = 36.50
    expect(planRoute(doubled, intent('A', 'D', 'cheapest')).totalFare).toBe(36.5)
  })

  it('a zero fare table gives zero totals', () => {
    const free = withFares((fare) => ({
      ...fare,
      rule: fare.rule.kind === 'distance' ? { ...fare.rule, baseFare: 0, perKm: 0 } : fare.rule,
    }))
    for (const option of planOptions(free, intent('A', 'F'))) {
      expect(option.totalFare).toBe(0)
    }
  })

  it('changing baseKm changes the fare', () => {
    // R1 A>D with baseKm 9.5 is covered by the base fare alone.
    const longBase = withFares((fare) =>
      fare.id === 'F-J' && fare.rule.kind === 'distance'
        ? { ...fare, rule: { ...fare.rule, baseKm: 9.5 } }
        : fare,
    )
    expect(planRoute(longBase, intent('A', 'D', 'cheapest')).totalFare).toBe(10)
  })

  it('charges one exact rail origin-destination matrix value for a through ride', () => {
    const railPack: RoutePack = {
      ...pack,
      routes: [{ ...pack.routes[0], mode: 'train', stops: pack.routes[0].stops.slice(0, 4), fareTableId: 'F-M' }],
      fares: [{
        id: 'F-M', mode: 'train', product: 'single-journey', vehicleClass: 'standard',
        effectiveDate: '2026-01-01', sourceNote: 'SYNTHETIC',
        rule: { kind: 'matrix', byOriginDestination: { A: { B: 8, C: 8, D: 14 }, B: { C: 8, D: 10 }, C: { D: 8 } } },
      }],
    }
    const result = planRoute(railPack, intent('A', 'D'))
    expect(result.legs).toHaveLength(1)
    expect(result.legs[0].fare).toBe(14)
  })

  it('prices an eligible concession in planned route fares', () => {
    const discounted = structuredClone(pack)
    discounted.fares.find((fare) => fare.id === 'F-J')!.promotions = [{
      id: 'student', label: 'Student discount', eligibility: 'student',
      effectiveDate: '2026-01-01', rule: { kind: 'percent_off', percent: 20 }, sourceNote: 'SYNTHETIC',
    }]
    const base = intent('A', 'C')
    expect(planRoute(discounted, base).totalFare).toBe(13)
    expect(planRoute(discounted, { ...base, fareEligibility: 'student' } as Intent).totalFare).toBe(10.4)
  })

  it('skips a route when its fare matrix lacks a usable origin-destination pair', () => {
    const missingPair: RoutePack = {
      ...pack,
      routes: [{ ...pack.routes[0], mode: 'train', stops: pack.routes[0].stops.slice(0, 4), fareTableId: 'F-M' }],
      fares: [{
        id: 'F-M', mode: 'train', product: 'single-journey', vehicleClass: 'standard',
        effectiveDate: '2026-01-01', sourceNote: 'SYNTHETIC',
        rule: { kind: 'matrix', byOriginDestination: { A: { C: 8 }, C: { D: 8 } } },
      }],
    }
    const result = planRoute(missingPair, intent('A', 'D'))
    expect(result.reason).toBe('no_path')
    expect(result.assumptions.join(' ')).toContain('has no current fare')
  })
})

describe('custom preference', () => {
  const custom = (weights: unknown, avoid: Partial<Avoid> = {}) =>
    planRoute(pack, { ...intent('A', 'F', 'custom', avoid), weights: weights as Intent['weights'] })

  // A -> F candidates (fare, minutes, transfers), one transfer = 10 min:
  //   X  R1 A>C + R3 C>F   26.00, 45, 1
  //   Y  R2 A>C + R3 C>F   35.25, 27, 1
  //   D  R1 A>F            30.25, 80, 0
  it('fare-only weights match cheapest', () => {
    expect(sequence(custom({ fare: 1, minutes: 0, transfers: 0 }))).toEqual(['R1:A>C', 'R3:C>F'])
  })

  it('time-only weights match the quickest ride', () => {
    expect(sequence(custom({ fare: 0, minutes: 1, transfers: 0 }))).toEqual(['R2:A>C', 'R3:C>F'])
  })

  it('transfer-only weights match fewest transfers', () => {
    expect(sequence(custom({ fare: 0, minutes: 0, transfers: 1 }))).toEqual(['R1:A>F'])
  })

  it('equal weights add pesos, minutes and transfers', () => {
    // X = 26 + 45 + 10 = 81, Y = 35.25 + 27 + 10 = 72.25, D = 30.25 + 80 = 110.25
    const result = custom({ fare: 1, minutes: 1, transfers: 1 })
    expect(sequence(result)).toEqual(['R2:A>C', 'R3:C>F'])
    expect(result.preference).toBe('custom')
    expect(result.assumptions.join(' ')).toContain('Custom ranking')
  })

  it('a heavier fare weight tips the balance', () => {
    // fare x3: X = 78 + 45 + 10 = 133, Y = 105.75 + 27 + 10 = 142.75, D = 90.75 + 80 = 170.75
    expect(sequence(custom({ fare: 3, minutes: 1, transfers: 1 }))).toEqual(['R1:A>C', 'R3:C>F'])
  })

  it('missing, zero or bad weights fall back to equal weights', () => {
    const equal = custom({ fare: 1, minutes: 1, transfers: 1 })
    const bad = [undefined, {}, { fare: 0, minutes: 0, transfers: 0 }, { fare: -2, minutes: Number.NaN }]
    for (const weights of bad) {
      expect(sequence(custom(weights))).toEqual(sequence(equal))
    }
  })

  it('planOptions puts the custom result first and de-duplicates', () => {
    const options = planOptions(pack, {
      ...intent('A', 'F', 'custom'),
      weights: { fare: 0, minutes: 0, transfers: 1 },
    })
    // custom picks R1 A>F, which fewest_transfers would also pick.
    expect(options.map((option) => option.preference)).toEqual(['custom', 'cheapest', 'fastest'])
  })

  it('standard preferences ignore weights', () => {
    const withWeights = planRoute(pack, {
      ...intent('A', 'F', 'cheapest'),
      weights: { fare: 0, minutes: 9, transfers: 0 },
    })
    expect(withWeights).toEqual(planRoute(pack, intent('A', 'F', 'cheapest')))
  })
})
