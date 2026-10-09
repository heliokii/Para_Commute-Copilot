import { describe, expect, it } from 'vitest'
import { SYNTHETIC_PACK } from '../router/__fixtures__/synthetic-pack.ts'
import type { RoutePack } from '../router/types.ts'
import { ACTIVE_PACK, pickActivePack } from './activePack.ts'

const EMPTY: RoutePack = { id: 'metro-manila', corridor: 'x', version: 'empty', landmarks: [], routes: [], fares: [] }

describe('pickActivePack', () => {
  it('keeps the sample pack while the real pack has no routes', () => {
    expect(pickActivePack(EMPTY, SYNTHETIC_PACK)).toBe(SYNTHETIC_PACK)
  })

  it('switches to the real pack once it has a route', () => {
    const real = { ...EMPTY, routes: [SYNTHETIC_PACK.routes[0]] }
    expect(pickActivePack(real, SYNTHETIC_PACK)).toBe(real)
  })

  it('never activates a pack labeled as sample data without saying so', () => {
    // Screens show the SAMPLE DATA badge from pack.note. The sample pack must carry one.
    if (ACTIVE_PACK.id === SYNTHETIC_PACK.id) expect(ACTIVE_PACK.note).toBeTruthy()
    else expect(ACTIVE_PACK.note).toBeUndefined()
  })
})
