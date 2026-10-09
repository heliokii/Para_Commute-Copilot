import { describe, expect, it } from 'vitest'
import { SYNTHETIC_PACK as pack } from '../router/__fixtures__/synthetic-pack.ts'
import { planRoute } from '../router/plan.ts'
import type { Intent } from '../router/types.ts'
import {
  explainSteps,
  explainSummary,
  explainWhy,
  summarizeWithLlm,
  validateExplanation,
} from './explain.ts'

const intent = (originId: string, destinationId: string, extra: Partial<Intent> = {}): Intent => ({
  originId,
  destinationId,
  preference: 'cheapest',
  avoid: { landmarkIds: [], routeIds: [], modes: [], tags: [] },
  ...extra,
})

// A -> F cheapest: R1 A>C (13.00, 30 min) + R3 C>F (13.00, 15 min) = 26.00, 45 min, 1 transfer.
const cheapest = planRoute(pack, intent('A', 'F'))
// A -> F fewest transfers: R1 A>F, 30.25, 80 min.
const direct = planRoute(pack, intent('A', 'F', { preference: 'fewest_transfers' }))
const walk = planRoute(pack, intent('A', 'G'))

describe('templates', () => {
  it('writes one step per leg from the RouteResult', () => {
    expect(explainSteps(cheapest, pack)).toEqual([
      'Sumakay ng jeepney na "SYN Jeep 1 (Alpha to Foxtrot, slow)" sa SYN Alpha Terminal. Bumaba sa SYN Charlie Junction (30 min, ₱13.00).',
      'Sumakay ng jeepney na "SYN Jeep 3 (Charlie to Foxtrot)" sa SYN Charlie Junction. Bumaba sa SYN Foxtrot Station (15 min, ₱13.00).',
    ])
  })

  it('describes walking legs without a fare', () => {
    expect(explainSteps(walk, pack).at(-1)).toBe(
      'Maglakad mula SYN Delta Plaza hanggang SYN Golf Chapel (3 min).',
    )
  })

  it('summarises totals, the as-of date and the data caveats', () => {
    expect(explainSummary(cheapest, pack)).toBe(
      'Mula SYN Alpha Terminal hanggang SYN Foxtrot Station: ₱26.00, 45 min, 2 sakay. Pamasahe as of 2026-01-01. Hindi pa verified ang data.',
    )
    expect(explainSummary(direct, pack)).toContain('1 oras 20 min')
  })

  it('says a what-if is a simulation', () => {
    const simulated = planRoute(pack, intent('A', 'F', { avoid: { landmarkIds: [], routeIds: [], modes: [], tags: ['EDSA'] } }))
    expect(explainSummary(simulated, pack)).toContain('Simulation ito')
  })

  it('explains why from the preference', () => {
    expect(explainWhy(cheapest)).toBe('Ito ang pinakamura sa route pack: ₱26.00.')
    expect(explainWhy(direct)).toBe('Ito ang may pinakakaunting lipat: walang lipat.')
  })

  it('returns nothing for a failed search', () => {
    const none = planRoute(pack, intent('A', 'H'))
    expect(explainSteps(none, pack)).toEqual([])
    expect(explainSummary(none, pack)).toBe('')
  })

  it('every template passes its own validator', () => {
    for (const result of [cheapest, direct, walk]) {
      const text = [explainSummary(result, pack), ...explainSteps(result, pack), explainWhy(result)].join(' ')
      expect(validateExplanation(text, result, pack)).toEqual({ valid: true, problems: [] })
    }
  })
})

// The strings below are hand-written test inputs, not model output.
describe('validateExplanation', () => {
  it('accepts text that only restates the result', () => {
    const text = 'Sakay ka ng jeep sa SYN Alpha Terminal, baba sa SYN Charlie Junction, tapos jeep ulit hanggang SYN Foxtrot Station. ₱26.00 lahat, mga 45 min.'
    expect(validateExplanation(text, cheapest, pack).valid).toBe(true)
  })

  it('rejects an invented fare', () => {
    const check = validateExplanation('Mura lang, ₱20.00 lang ang pamasahe papuntang SYN Foxtrot Station.', cheapest, pack)
    expect(check.valid).toBe(false)
    expect(check.problems).toEqual(['fare 20.00 is not in the route result'])
  })

  it('rejects an invented travel time and distance', () => {
    expect(validateExplanation('Mga 25 min lang ito.', cheapest, pack).valid).toBe(false)
    expect(validateExplanation('Mga 9 km ang layo.', cheapest, pack).valid).toBe(false)
  })

  it('keeps units apart: a real minute count is not a valid fare, and the reverse', () => {
    // Leg times are 30 and 15 min; fares are 13.00 and 26.00.
    expect(validateExplanation('₱30 lang ang pamasahe.', cheapest, pack).valid).toBe(false)
    expect(validateExplanation('30 pesos lang.', cheapest, pack).valid).toBe(false)
    expect(validateExplanation('Mga 26 min ang biyahe.', cheapest, pack).valid).toBe(false)
    expect(validateExplanation('Mga 13 km ang layo.', cheapest, pack).valid).toBe(false)
    expect(validateExplanation('₱13 kada sakay, 30 min ang una, 6 km.', cheapest, pack).valid).toBe(true)
  })

  it('allows counts and step numbers, rejects other bare numbers', () => {
    expect(validateExplanation('2 sakay, 1 lipat. Step 1 at step 2.', cheapest, pack).valid).toBe(true)
    expect(validateExplanation('5 sakay ito.', cheapest, pack).valid).toBe(false)
    expect(validateExplanation('As of 2026-01-01 ang pamasahe.', cheapest, pack).valid).toBe(true)
    expect(validateExplanation('As of 2025-06-30 ang pamasahe.', cheapest, pack).valid).toBe(false)
  })

  it('rejects a place or route that is not on this route', () => {
    const place = validateExplanation('Dadaan ka sa SYN Delta Plaza.', cheapest, pack)
    expect(place.valid).toBe(false)
    expect(place.problems[0]).toContain('SYN Delta Plaza')

    const route = validateExplanation('Sumakay ng SYN Bus 2 (Alpha to Delta, express).', cheapest, pack)
    expect(route.valid).toBe(false)
  })

  it('rejects an alias of a place that is not on this route', () => {
    expect(validateExplanation('Malapit ito sa Plaza Delta.', cheapest, pack).valid).toBe(false)
  })

  it('does not misread digits inside a route name', () => {
    expect(validateExplanation('Sumakay ng SYN Jeep 3 (Charlie to Foxtrot).', cheapest, pack).valid).toBe(true)
  })

  it('accepts hours and minutes for the same duration', () => {
    expect(validateExplanation('Aabutin ng 1 oras 20 min, ₱30.25.', direct, pack).valid).toBe(true)
    expect(validateExplanation('Aabutin ng 2 oras.', direct, pack).valid).toBe(false)
  })

  it('rejects empty text and failed searches', () => {
    expect(validateExplanation('   ', cheapest, pack).valid).toBe(false)
    expect(validateExplanation('Okay', planRoute(pack, intent('A', 'H')), pack).valid).toBe(false)
  })
})

describe('summarizeWithLlm', () => {
  // Stub backends return fixed strings to exercise the gate. They are not model output.
  it('shows text that passes validation', async () => {
    const reply = await summarizeWithLlm(cheapest, pack, async () =>
      JSON.stringify({ summary: 'Tara! ₱26.00 lang, 45 min, papuntang SYN Foxtrot Station.' }),
    )
    expect(reply.text).toBe('Tara! ₱26.00 lang, 45 min, papuntang SYN Foxtrot Station.')
  })

  it('discards text with an invented fare', async () => {
    const reply = await summarizeWithLlm(cheapest, pack, async () =>
      JSON.stringify({ summary: 'Tara! ₱15.00 lang papuntang SYN Foxtrot Station.' }),
    )
    expect(reply.text).toBeNull()
    // 15 is a real minute count on this route, but it is not a fare.
    expect(reply.rejected).toEqual(['fare 15.00 is not in the route result'])
  })

  it('discards filler that states no fare, even when nothing in it is wrong', async () => {
    const reply = await summarizeWithLlm(cheapest, pack, async () =>
      JSON.stringify({ summary: 'Mula SYN Alpha Terminal hanggang SYN Foxtrot Station, ingat sa biyahe!' }),
    )
    expect(reply).toEqual({ text: null, rejected: ['does not state the total fare'] })
  })

  it('discards malformed replies and model errors', async () => {
    expect((await summarizeWithLlm(cheapest, pack, async () => 'not json')).text).toBeNull()
    expect((await summarizeWithLlm(cheapest, pack, async () => '{"other": 1}')).text).toBeNull()
    const failed = await summarizeWithLlm(cheapest, pack, async () => {
      throw new Error('model unavailable')
    })
    expect(failed).toEqual({ text: null, rejected: ['model unavailable'] })
  })
})
