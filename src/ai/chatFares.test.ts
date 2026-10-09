import { describe, expect, it } from 'vitest'
import generated from '../db/generated/metro-manila-pack.json' with { type: 'json' }
import { planOptions, planRoute } from '../router/plan.ts'
import type { RoutePack } from '../router/types.ts'
import { createSession, handleUtterance, type ChatDeps } from './chat.ts'

// The real pack has train stations with fare matrices and no train routes: a trip question
// between two stations on one line gets the published fare, never a route. Its only routes
// are the made-up jeepney ones from data/metro-manila/mock-pack.
const pack = generated as unknown as RoutePack
const deps: ChatDeps = {
  pack,
  router: { planOptions: (intent) => planOptions(pack, intent), planRoute: (intent) => planRoute(pack, intent) },
}

describe('chat on the real pack', () => {
  it('answers a same-line trip with the matrix fare', async () => {
    const reply = await handleUtterance(createSession(), 'Paano pumunta sa Ninoy Aquino galing Dr. Santos?', deps)
    expect(reply.kind).toBe('answer')
    expect(reply.facts.join(' ')).toContain('₱20.00')
    expect(reply.facts.join(' ')).toContain('Walang oras o ruta')
  })

  it('plans a trip over the mock jeepney routes with the fare from the mock fare table', async () => {
    const reply = await handleUtterance(createSession(), 'Paano pumunta sa Carriedo galing Quezon Avenue?', deps)
    expect(reply.kind).toBe('options')
    const cheapest = reply.options.find((option) => option.preference === 'cheapest')!
    expect(cheapest.status).toBe('ok')
    expect(cheapest.legs.every((leg) => leg.routeId.startsWith('mock-') || leg.mode === 'walk')).toBe(true)
    expect(cheapest.usedUnverifiedData).toBe(true)
    // One ride on mock-j1a (the router may walk the last few metres): base fare plus the
    // per-km part for the distance ridden, rounded to 25 centavos.
    const rides = cheapest.legs.filter((leg) => leg.mode !== 'walk')
    expect(rides.map((leg) => leg.routeId)).toEqual(['mock-j1a'])
    const route = pack.routes.find((item) => item.id === 'mock-j1a')!
    const rule = pack.fares.find((fare) => fare.id === route.fareTableId)!.rule
    if (rule.kind !== 'distance') throw new Error('mock fare must be a distance rule')
    const expected = Math.round((rule.baseFare + Math.max(0, rides[0].distKm - rule.baseKm) * rule.perKm) * 4) / 4
    expect(cheapest.totalFare).toBe(expected)
    expect(cheapest.totalFare).toBeGreaterThanOrEqual(rule.baseFare)
  })

  it('still gives the published train fare when a mock route joins two stations on one line', async () => {
    const reply = await handleUtterance(createSession(), 'Paano pumunta sa Ayala galing Quezon Avenue?', deps)
    expect(reply.kind).toBe('options')
    expect(reply.trainFare).toContain('Pamasahe, Quezon Ave. (MRT-3) → Ayala (MRT-3)')
    expect(reply.trainFare).toMatch(/₱\d+\.\d\d/)
  })

  it('every route in the pack is mock and says so', () => {
    expect(pack.routes.length).toBeGreaterThan(0)
    for (const route of pack.routes) {
      expect(route.id.startsWith('mock-')).toBe(true)
      expect(route.name).toContain('(MOCK)')
      expect(route.verified).toBe(false)
      expect(route.note).toContain('MOCK DATA')
    }
  })

  it('does not invent a fare across lines', async () => {
    const reply = await handleUtterance(createSession(), 'Paano pumunta sa Taft Avenue galing Dr. Santos?', deps)
    expect(reply.kind).not.toBe('answer')
  })
})
