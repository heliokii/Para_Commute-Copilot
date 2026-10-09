import { describe, expect, it } from 'vitest'
import generated from '../db/generated/metro-manila-pack.json' with { type: 'json' }
import { planOptions, planRoute } from '../router/plan.ts'
import type { RoutePack } from '../router/types.ts'
import { createSession, handleUtterance, type ChatDeps } from './chat.ts'

// The real pack has stations and fare matrices but no routes: a trip question
// between two stations on one line gets the published fare, never a route.
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

  it('does not invent a fare across lines', async () => {
    const reply = await handleUtterance(createSession(), 'Paano pumunta sa Taft Avenue galing Dr. Santos?', deps)
    expect(reply.kind).not.toBe('answer')
  })
})
