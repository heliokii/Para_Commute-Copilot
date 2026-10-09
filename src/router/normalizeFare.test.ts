import { describe, expect, it } from 'vitest'
import { normalizeFare } from './normalizeFare.ts'

describe('normalizeFare', () => {
  it('converts persisted flat fares from the previous app version', () => {
    expect(normalizeFare({ id: 'old', mode: 'bus', baseFare: 13, baseKm: 5, perKm: 1.5, effectiveDate: '2025-01-01', roundingRule: 'nearest_0.25', sourceNote: 'legacy' })).toEqual({
      id: 'old', mode: 'bus', product: 'legacy', vehicleClass: 'unspecified',
      rule: { kind: 'distance', baseFare: 13, baseKm: 5, perKm: 1.5, roundingRule: 'nearest_0.25' },
      effectiveDate: '2025-01-01', sourceNote: 'legacy',
    })
  })

  it('passes current fares through and ignores malformed legacy rows', () => {
    const current = { id: 'new', rule: { kind: 'matrix' }, packId: 'pack' }
    expect(normalizeFare(current)).toEqual({ id: 'new', rule: { kind: 'matrix' } })
    expect(normalizeFare({ id: 'bad', mode: 'bus', baseFare: '', baseKm: 1, perKm: 1 })).toBeNull()
  })
})
