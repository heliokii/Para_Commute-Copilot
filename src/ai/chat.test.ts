import { describe, expect, it } from 'vitest'
import { SYNTHETIC_PACK as pack } from '../router/__fixtures__/synthetic-pack.ts'
import { planOptions, planRoute } from '../router/plan.ts'
import type { RouteResult } from '../router/types.ts'
import { createSession, handleUtterance, type ChatDeps, type TsupherReply } from './chat.ts'
import { applyDelta, mapFollowupRules, resolveFollowupOutput } from './followup.ts'

// Ten scripted conversations through the rules lane only (no model).
// Expected fares are the hand-computed values in the synthetic pack fixture:
//   A -> F  cheapest 26.00 (R1 A>C + R3 C>F), fastest 35.25 (R2 A>C + R3 C>F),
//           fewest transfers 30.25 (R1 A>F)
//   A -> F  avoiding EDSA: cheapest 30.25 (R1 A>F), fastest 50.00 (R2 A>D + R4 D>F)
//   A -> D  cheapest 18.25 (R1), fastest 30.00 (R2)

const deps: ChatDeps = {
  pack,
  router: {
    planOptions: (intent) => planOptions(pack, intent),
    planRoute: (intent) => planRoute(pack, intent),
  },
}

const sequence = (result: RouteResult) =>
  result.legs.map((leg) => `${leg.routeId}:${leg.boardId}>${leg.alightId}`).join(' + ')
const first = (reply: TsupherReply) => reply.options[Math.max(reply.chosenIndex, 0)]

async function converse(lines: string[]) {
  const session = createSession()
  const replies: TsupherReply[] = []
  for (const line of lines) replies.push(await handleUtterance(session, line, deps))
  return { session, replies }
}

describe('scripted conversations (rules lane)', () => {
  it('1. ask, then "may mas mura?" keeps the cheapest', async () => {
    const { replies } = await converse(['Paano pumunta sa Foxtrot galing Alpha?', 'May mas mura?'])
    expect(replies[0].kind).toBe('options')
    expect(first(replies[0]).totalFare).toBe(26)
    expect(replies[0].simulated).toBe(false)
    expect(replies[1].message).toBe('refined')
    expect(first(replies[1]).totalFare).toBe(26)
    expect(replies[1].intent?.preference).toBe('cheapest')
  })

  it('2. ask, then "mas mabilis"', async () => {
    const { replies } = await converse(['Alpha to Foxtrot', 'mas mabilis naman'])
    expect(sequence(first(replies[1]))).toBe('R2:A>C + R3:C>F')
    expect(first(replies[1]).totalFare).toBe(35.25)
    expect(first(replies[1]).totalMinutes).toBe(27)
  })

  it('3. ask, then "walang lipat"', async () => {
    const { replies } = await converse(['Galing Alpha papuntang Foxtrot', 'yung walang lipat'])
    expect(sequence(first(replies[1]))).toBe('R1:A>F')
    expect(first(replies[1]).transfers).toBe(0)
  })

  it('4. what-if "iwas EDSA" is marked simulated', async () => {
    const { replies } = await converse(['Alpha to Foxtrot', 'iwas EDSA'])
    expect(replies[0].simulated).toBe(false)
    expect(replies[1].message).toBe('whatIf')
    expect(replies[1].simulated).toBe(true)
    expect(first(replies[1]).totalFare).toBe(30.25)
    expect(replies[1].options.every((option) => option.simulated)).toBe(true)
    expect(replies[1].intent?.avoid.tags).toEqual(['EDSA'])
  })

  it('5. "paano kung sarado ang Echo?" avoids that landmark', async () => {
    const { replies } = await converse(['Galing Alpha papuntang Foxtrot', 'Paano kung sarado ang Echo?'])
    expect(replies[1].simulated).toBe(true)
    expect(replies[1].intent?.avoid.landmarkIds).toEqual(['E'])
    // R3 passes Echo, so the direct R1 ride is what remains cheapest.
    expect(sequence(first(replies[1]))).toBe('R1:A>F')
  })

  it('6. constraints stack, then lift', async () => {
    const { replies } = await converse([
      'Alpha to Foxtrot',
      'iwas EDSA',
      'mas mabilis',
      'okay na ang EDSA',
    ])
    expect(sequence(first(replies[2]))).toBe('R2:A>D + R4:D>F')
    expect(first(replies[2]).totalFare).toBe(50)
    expect(replies[2].simulated).toBe(true)
    // Avoid removed: back to the unconstrained fastest, no longer simulated.
    expect(replies[3].simulated).toBe(false)
    expect(first(replies[3]).totalFare).toBe(35.25)
    expect(replies[3].intent?.avoid.tags).toEqual([])
  })

  it('7. a missing origin is asked for, then filled', async () => {
    const { replies, session } = await converse(['Paano pumunta sa Delta?', 'galing Alpha'])
    expect(replies[0].kind).toBe('clarify')
    expect(replies[0].message).toBe('askOrigin')
    expect(replies[0].options).toEqual([])
    expect(replies[1].kind).toBe('options')
    expect(first(replies[1]).totalFare).toBe(18.25)
    expect(session.pending).toBeNull()
  })

  it('8. a bare place answers the question that was asked', async () => {
    const origin = await converse(['Paano pumunta sa Delta?', 'Bravo'])
    expect(origin.replies[1].intent).toMatchObject({ originId: 'B', destinationId: 'D' })
    const destination = await converse(['Galing ako sa Alpha', 'Delta'])
    expect(destination.replies[0].message).toBe('askDestination')
    expect(destination.replies[1].intent).toMatchObject({ originId: 'A', destinationId: 'D' })
  })

  it('9. questions about the route are answered from the RouteResult only', async () => {
    const { replies } = await converse(['Alpha to Foxtrot', 'magkano?', 'bakit ito?', 'ulitin mo'])
    expect(replies[1].kind).toBe('answer')
    expect(replies[1].facts[0]).toContain('₱26.00')
    expect(replies[2].facts).toEqual(['Ito ang pinakamura sa route pack: ₱26.00.'])
    expect(replies[3].facts).toHaveLength(2)
    expect(replies[3].facts[0]).toContain('SYN Alpha Terminal')
  })

  it('10. out of scope, no route, change of destination, and reset', async () => {
    const { replies, session } = await converse([
      'Anong ulam mamaya?',
      'Alpha to Hotel',
      'sa Delta na lang',
      'bagong ruta',
      'mas mura',
    ])
    expect(replies[0].kind).toBe('unsupported')
    expect(replies[0].options).toEqual([])
    expect(replies[1].kind).toBe('no_route')
    expect(replies[1].options[0].reason).toBe('no_path')
    expect(replies[2].kind).toBe('options')
    expect(replies[2].intent).toMatchObject({ originId: 'A', destinationId: 'D' })
    expect(first(replies[2]).totalFare).toBe(18.25)
    expect(replies[3].kind).toBe('reset')
    expect(session.intent).toBeNull()
    // A follow-up with no trip to refer to is not answered with a made-up route.
    expect(replies[4].kind).toBe('clarify')
    expect(replies[4].options).toEqual([])
  })
})

describe('session', () => {
  it('keeps only the last 12 turns and nothing else between trips', async () => {
    const session = createSession()
    for (let i = 0; i < 20; i++) await handleUtterance(session, 'Alpha to Delta', deps)
    expect(session.turns).toHaveLength(12)
    expect(Object.keys(session).sort()).toEqual(['chosenIndex', 'intent', 'options', 'pending', 'turns'])
  })

  it('a new complete request replaces the old trip and its constraints', async () => {
    const { replies } = await converse(['Alpha to Foxtrot', 'iwas EDSA', 'Bravo to Delta'])
    expect(replies[2].intent).toMatchObject({ originId: 'B', destinationId: 'D' })
    expect(replies[2].intent?.avoid.tags).toEqual([])
    expect(replies[2].simulated).toBe(false)
  })
})

describe('follow-up mapper', () => {
  const base = planIntent()
  function planIntent() {
    return {
      originId: 'A',
      destinationId: 'F',
      preference: 'cheapest' as const,
      avoid: { landmarkIds: [], routeIds: [], modes: [], tags: [] },
    }
  }

  it('maps common phrases', () => {
    expect(mapFollowupRules('may mas mura?', pack, base)).toEqual({ preference: 'cheapest' })
    expect(mapFollowupRules('pinakamura', pack, base)).toEqual({ preference: 'cheapest' })
    expect(mapFollowupRules('mas mabilis', pack, base)).toEqual({ preference: 'fastest' })
    expect(mapFollowupRules('walang lipat', pack, base)).toEqual({ preference: 'fewest_transfers' })
    expect(mapFollowupRules('iwas EDSA', pack, base)).toEqual({ addAvoid: { tags: ['EDSA'] } })
    expect(mapFollowupRules('wag sa bus', pack, base)).toEqual({ addAvoid: { modes: ['bus'] } })
    expect(mapFollowupRules('ulitin', pack, base)).toEqual({ ask: 'steps' })
    expect(mapFollowupRules('bakit', pack, base)).toEqual({ ask: 'why' })
    expect(mapFollowupRules('magkano', pack, base)).toEqual({ ask: 'fare' })
    expect(mapFollowupRules('kumusta ka', pack, base)).toBeNull()
  })

  it('removes only what is named, or everything when nothing is named', () => {
    const avoiding = { ...base, avoid: { ...base.avoid, tags: ['EDSA'], modes: ['bus' as const] } }
    expect(mapFollowupRules('okay na ang EDSA', pack, avoiding)).toEqual({ removeAvoid: { tags: ['EDSA'] } })
    expect(mapFollowupRules('alisin ang iwas', pack, avoiding)).toEqual({ removeAvoid: 'all' })
    expect(mapFollowupRules('okay na ang EDSA, mas mabilis', pack, avoiding)).toEqual({
      removeAvoid: { tags: ['EDSA'] },
      preference: 'fastest',
    })
    expect(applyDelta(avoiding, { removeAvoid: { tags: ['EDSA'] } }).avoid).toEqual({
      landmarkIds: [], routeIds: [], modes: ['bus'], tags: [],
    })
    expect(applyDelta(avoiding, { removeAvoid: 'all' }).avoid.modes).toEqual([])
  })

  it('applyDelta does not mutate and does not duplicate', () => {
    const before = JSON.stringify(base)
    const once = applyDelta(base, { addAvoid: { tags: ['EDSA'] } })
    const twice = applyDelta(once, { addAvoid: { tags: ['EDSA'] }, preference: 'fastest' })
    expect(JSON.stringify(base)).toBe(before)
    expect(twice.avoid.tags).toEqual(['EDSA'])
    expect(twice.preference).toBe('fastest')
  })

  // Hand-written JSON fixtures for the validator. Not model output.
  it('validates model follow-up JSON and drops unknown values', () => {
    const json = (value: unknown) => JSON.stringify(value)
    expect(
      resolveFollowupOutput(json({ preference: 'fastest', add_avoid: ['EDSA', 'Narnia'], remove_avoid: [], ask: 'none', in_scope: true }), pack),
    ).toEqual({ preference: 'fastest', addAvoid: { tags: ['EDSA'] } })
    expect(
      resolveFollowupOutput(json({ preference: 'none', add_avoid: [], remove_avoid: [], ask: 'fare', in_scope: true }), pack),
    ).toEqual({ ask: 'fare' })
    expect(
      resolveFollowupOutput(json({ preference: 'none', add_avoid: [], remove_avoid: [], ask: 'none', in_scope: true }), pack),
    ).toBeNull()
    expect(
      resolveFollowupOutput(json({ preference: 'fastest', add_avoid: [], remove_avoid: [], ask: 'none', in_scope: false }), pack),
    ).toBeNull()
    expect(() => resolveFollowupOutput('mas mabilis po', pack)).toThrow()
  })
})
