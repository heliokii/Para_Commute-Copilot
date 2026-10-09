import { describe, expect, it } from 'vitest'
import { fareBreakdown, fareForLegCentavos, legFare } from './fare.ts'
import type { FareEntry, RoundingRule } from './types.ts'

// SYNTHETIC fare values, not real fares.
const bus = (roundingRule: RoundingRule): FareEntry => ({
  id: 'F-B',
  mode: 'bus',
  product: 'ordinary',
  vehicleClass: 'standard',
  rule: { kind: 'distance', baseFare: 20, baseKm: 5, perKm: 2.2, roundingRule },
  effectiveDate: '2026-02-01',
  sourceNote: 'SYNTHETIC',
})

describe('legFare', () => {
  it('charges only the base fare within baseKm', () => {
    expect(legFare(3.5, bus('nearest_0.25'))).toBe(20)
    expect(legFare(5, bus('nearest_0.25'))).toBe(20)
  })

  it('rounds to the nearest 0.25 peso', () => {
    // 20 + 4.6 * 2.2 = 30.12 -> 30.00
    expect(legFare(9.6, bus('nearest_0.25'))).toBe(30)
    // 20 + 1.0 * 2.2 = 22.20 -> 22.25
    expect(legFare(6, bus('nearest_0.25'))).toBe(22.25)
    // 20 + 0.4 * 2.2 = 20.88 -> 21.00
    expect(legFare(5.4, bus('nearest_0.25'))).toBe(21)
  })

  it('supports the other rounding rules', () => {
    expect(legFare(9.6, bus('none'))).toBe(30.12)
    expect(legFare(9.6, bus('nearest_1'))).toBe(30)
    expect(legFare(9.6, bus('ceil_1'))).toBe(31)
    // 20 + 2.5 * 2.2 = 25.50 -> 26 under nearest_1
    expect(legFare(7.5, bus('nearest_1'))).toBe(26)
  })

  it('defaults to nearest 0.25 when the rule is missing', () => {
    const noRule = { ...bus('none'), rule: { ...bus('none').rule, roundingRule: undefined } } as unknown as FareEntry
    expect(legFare(9.6, noRule)).toBe(30)
  })

  it('is not affected by float drift', () => {
    const tenths: FareEntry = { ...bus('none'), rule: { kind: 'distance', baseFare: 0.1, baseKm: 0, perKm: 0.2, roundingRule: 'none' } }
    // 0.1 + 1 * 0.2 is 0.30000000000000004 in floating point.
    expect(legFare(1, tenths)).toBe(0.3)
  })

  it('does not report a missing matrix fare as zero', () => {
    const matrixFare = {
      ...bus('none'),
      rule: { kind: 'matrix', byOriginDestination: { A: { B: 12 } } },
    } as unknown as FareEntry
    expect(legFare(2, matrixFare)).toBeNull()
  })
})

describe('fareBreakdown', () => {
  it('shows the working behind a leg fare', () => {
    // 9.6 km: 20 + 4.6 * 2.2 = 30.12 -> 30.00
    expect(fareBreakdown('A', 'B', 9.6, bus('nearest_0.25'))).toEqual({
      kind: 'distance',
      baseFare: 20,
      baseKm: 5,
      extraKm: 4.6,
      perKm: 2.2,
      extraFare: 10.12,
      unrounded: 30.12,
      total: 30,
      scheduledTotal: 30,
      effectiveDate: '2026-02-01',
    })
    expect(fareBreakdown('A', 'B', 3, bus('nearest_0.25'))).toMatchObject({ extraKm: 0, extraFare: 0, total: 20 })
  })

  it('shows the concession selected for the route search', () => {
    const fare = {
      ...bus('none'),
      promotions: [{
        id: 'student', label: 'Student discount', eligibility: 'student',
        effectiveDate: '2026-01-01', rule: { kind: 'percent_off', percent: 20 }, sourceNote: 'SYNTHETIC',
      }],
    } as unknown as FareEntry
    expect(fareBreakdown('A', 'B', 5, fare, '2026-10-01', 'student')).toMatchObject({
      scheduledTotal: 20,
      total: 16,
      promotion: { id: 'student' },
    })
  })
})

describe('exact fare matrices and validity', () => {
  const matrixFare = {
    id: 'F-RAIL',
    mode: 'train',
    product: 'single-journey',
    vehicleClass: 'standard',
    effectiveDate: '2026-03-23',
    sourceNote: 'OFFICIAL',
    rule: {
      kind: 'matrix',
      byOriginDestination: { A: { B: 8, C: 18 }, B: { A: 9, C: 10 } },
    },
  } as unknown as FareEntry

  it('uses the exact directional origin-destination amount', () => {
    expect(fareForLegCentavos('A', 'C', 0, matrixFare, '2026-03-23')).toBe(1800)
    expect(fareForLegCentavos('B', 'A', 0, matrixFare, '2026-03-23')).toBe(900)
  })

  it('does not reverse or estimate a missing matrix entry', () => {
    expect(fareForLegCentavos('C', 'A', 0, matrixFare, '2026-03-23')).toBeNull()
  })

  it('rejects a fare before its effective date and after its expiry', () => {
    const dated = { ...bus('none'), effectiveDate: '2026-04-01', expiresAt: '2026-04-30' } as FareEntry
    expect(fareForLegCentavos('A', 'B', 8, dated, '2026-03-31')).toBeNull()
    expect(fareForLegCentavos('A', 'B', 8, dated, '2026-05-01')).toBeNull()
  })

  it('keeps the scheduled rule and applies only an in-window universal promotion', () => {
    const fare = {
      ...bus('none'),
      rule: { kind: 'distance', baseFare: 20, baseKm: 5, perKm: 2.2, roundingRule: 'none' },
      promotions: [{
        id: 'temporary-half-fare',
        label: 'Temporary 50% fare',
        eligibility: 'all',
        effectiveDate: '2026-03-23',
        expiresAt: '2026-03-31',
        rule: { kind: 'percent_off', percent: 50 },
        sourceNote: 'OFFICIAL',
      }],
    } as unknown as FareEntry
    expect(fareForLegCentavos('A', 'B', 5, fare, '2026-03-22')).toBe(2000)
    expect(fareForLegCentavos('A', 'B', 5, fare, '2026-03-23')).toBe(1000)
    expect(fareForLegCentavos('A', 'B', 5, fare, '2026-04-01')).toBe(2000)
  })

  it('does not fall back to the scheduled fare when an active promotional matrix is missing a pair', () => {
    const fare = {
      ...matrixFare,
      promotions: [{
        id: 'matrix-promo', label: 'Current fares', eligibility: 'all',
        effectiveDate: '2026-03-23', rule: { kind: 'matrix', byOriginDestination: { A: { B: 4 } } },
        sourceNote: 'OFFICIAL',
      }],
    } as unknown as FareEntry
    expect(fareForLegCentavos('A', 'C', 0, fare, '2026-03-24')).toBeNull()
  })
})
