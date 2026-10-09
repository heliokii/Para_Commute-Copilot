import { describe, expect, it } from 'vitest'
import type { Intent } from '../router/types.ts'
import { asPlaceFavorite, asRouteFavorite, placeFavoriteId, routeFavoriteId } from './favorites.ts'

const intent = (over: Partial<Intent> = {}): Intent => ({
  originId: 'A',
  destinationId: 'F',
  preference: 'cheapest',
  avoid: { landmarkIds: [], routeIds: [], modes: [], tags: [] },
  ...over,
})

describe('favorite ids', () => {
  it('are the same for the same trip, whatever the order of the avoid-list', () => {
    const one = intent({ avoid: { landmarkIds: ['E', 'B'], routeIds: [], modes: ['bus', 'uv'], tags: ['EDSA'] } })
    const two = intent({ avoid: { landmarkIds: ['B', 'E'], routeIds: [], modes: ['uv', 'bus'], tags: ['EDSA'] } })
    expect(routeFavoriteId(one)).toBe(routeFavoriteId(two))
  })

  it('differ by trip, preference and avoid-list, so each is its own favorite', () => {
    const ids = new Set([
      routeFavoriteId(intent()),
      routeFavoriteId(intent({ preference: 'fastest' })),
      routeFavoriteId(intent({ destinationId: 'D' })),
      routeFavoriteId(intent({ avoid: { landmarkIds: [], routeIds: [], modes: [], tags: ['EDSA'] } })),
      routeFavoriteId(intent({ preference: 'custom', weights: { fare: 1, minutes: 2, transfers: 3 } })),
      routeFavoriteId(intent({ preference: 'custom', weights: { fare: 3, minutes: 2, transfers: 1 } })),
    ])
    expect(ids.size).toBe(6)
  })

  it('place ids do not collide with route ids', () => {
    expect(placeFavoriteId('A')).toBe('place:A')
    expect(placeFavoriteId('A')).not.toBe(routeFavoriteId(intent()))
  })
})

describe('stored favorite shapes', () => {
  it('reads a route favorite it wrote', () => {
    const payload = { intent: intent(), packId: 'p', packVersion: '1' }
    expect(asRouteFavorite(payload)).toEqual(payload)
  })

  it('rejects rows that are not shaped like a favorite', () => {
    expect(asRouteFavorite(null)).toBeNull()
    expect(asRouteFavorite({ intent: intent({ preference: 'nope' as never }), packId: 'p', packVersion: '1' })).toBeNull()
    expect(asRouteFavorite({ intent: { ...intent(), avoid: null }, packId: 'p', packVersion: '1' })).toBeNull()
    expect(asRouteFavorite({ intent: intent() })).toBeNull()
    expect(asPlaceFavorite({ landmarkId: 'A' })).toBeNull()
    expect(asPlaceFavorite({ landmarkId: 'A', packId: 'p' })).toEqual({ landmarkId: 'A', packId: 'p' })
  })
})
