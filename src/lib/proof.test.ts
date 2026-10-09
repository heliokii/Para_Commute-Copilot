import { describe, expect, it } from 'vitest'
import { daysSince, FARE_STALE_DAYS, isFareStale } from './proof.ts'

const now = new Date('2026-10-09T05:00:00Z')

describe('fare freshness', () => {
  it('counts whole days from an ISO date', () => {
    expect(daysSince('2026-10-09', now)).toBe(0)
    expect(daysSince('2026-10-08', now)).toBe(1)
    expect(daysSince('2026-01-01', now)).toBe(281)
    expect(daysSince('not a date', now)).toBeNull()
  })

  it('flags a fare table only when it is older than the limit', () => {
    expect(FARE_STALE_DAYS).toBe(180)
    expect(isFareStale('2026-01-01', now)).toBe(true)
    // Exactly at the limit is not stale; one day past it is.
    expect(isFareStale('2026-04-12', now)).toBe(false)
    expect(isFareStale('2026-04-11', now)).toBe(true)
    expect(isFareStale('2026-09-28', now)).toBe(false)
  })

  it('does not flag a missing or invalid date', () => {
    expect(isFareStale(null, now)).toBe(false)
    expect(isFareStale(undefined, now)).toBe(false)
    expect(isFareStale('soon', now)).toBe(false)
  })
})
