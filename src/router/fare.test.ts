import { describe, expect, it } from 'vitest'
import { legFare } from './fare.ts'
import type { FareEntry, RoundingRule } from './types.ts'

// SYNTHETIC fare values, not real fares.
const bus = (roundingRule: RoundingRule): FareEntry => ({
  id: 'F-B',
  mode: 'bus',
  baseFare: 20,
  baseKm: 5,
  perKm: 2.2,
  effectiveDate: '2026-02-01',
  roundingRule,
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
    const noRule = { ...bus('none'), roundingRule: undefined } as unknown as FareEntry
    expect(legFare(9.6, noRule)).toBe(30)
  })

  it('is not affected by float drift', () => {
    const tenths: FareEntry = { ...bus('none'), baseFare: 0.1, baseKm: 0, perKm: 0.2 }
    // 0.1 + 1 * 0.2 is 0.30000000000000004 in floating point.
    expect(legFare(1, tenths)).toBe(0.3)
  })
})
