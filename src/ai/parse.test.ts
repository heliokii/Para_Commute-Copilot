import { describe, expect, it } from 'vitest'
import benchmark from '../../tests/taglish-50.json'
import { SYNTHETIC_PACK as pack } from '../router/__fixtures__/synthetic-pack.ts'
import {
  buildLlmPrompt,
  parse,
  parseWithRules,
  resolveLlmOutput,
  scoreParse,
  type ExpectedParse,
} from './parse.ts'

const queries = benchmark.queries as {
  id: number
  category: string
  text: string
  expected: ExpectedParse
}[]

describe('rules lane', () => {
  it('reads origin, destination, preference and avoid from Taglish', () => {
    const result = parseWithRules('Pinakamabilis galing Alpha pa-Foxtrot, iwas EDSA at walang bus', pack)
    expect(result.status).toBe('ok')
    expect(result.lane).toBe('rules')
    expect(result.intent).toEqual({
      originId: 'A',
      destinationId: 'F',
      preference: 'fastest',
      avoid: { landmarkIds: [], routeIds: [], modes: ['bus'], tags: ['EDSA'] },
    })
  })

  it('defaults to cheapest when no preference is stated', () => {
    expect(parseWithRules('Alpha to Delta', pack).intent?.preference).toBe('cheapest')
  })

  it('asks instead of guessing when a place is missing', () => {
    const result = parseWithRules('Paano pumunta sa Delta?', pack)
    expect(result.status).toBe('needs_clarification')
    expect(result.missing).toEqual(['origin'])
    expect(result.partial?.destinationId).toBe('D')
    expect(result.intent).toBeUndefined()
  })

  it('does not assign two bare places by word order', () => {
    const result = parseWithRules('Alpha Foxtrot', pack)
    expect(result.status).toBe('needs_clarification')
    expect(result.missing).toEqual(['origin', 'destination'])
  })

  it('returns candidates when a slot gets two different places', () => {
    const result = parseWithRules('galing Alpha galing Bravo papuntang Delta', pack)
    expect(result.status).toBe('needs_clarification')
    expect(result.candidates).toEqual([
      {
        field: 'origin',
        options: [
          { id: 'A', name: 'SYN Alpha Terminal' },
          { id: 'B', name: 'SYN Bravo Market' },
        ],
      },
    ])
  })

  it('never resolves a place that is not in the pack', () => {
    const result = parseWithRules('Papunta sa Sierra galing Alpha', pack)
    expect(result.status).toBe('needs_clarification')
    expect(result.missing).toEqual(['destination'])
  })

  it('marks non-travel text unsupported', () => {
    expect(parseWithRules('Anong oras na?', pack).status).toBe('unsupported')
    expect(parseWithRules('', pack).status).toBe('unsupported')
  })

  it('never throws on odd input', () => {
    for (const text of ['???', '   ', 'pa pa pa sa sa', 'iwas', 'galing', '🚌🚌🚌', 'a'.repeat(500)]) {
      expect(() => parseWithRules(text, pack)).not.toThrow()
    }
  })
})

describe('rules lane on the 50-query seed set', () => {
  const scored = queries.map((query) => ({
    query,
    score: scoreParse(parseWithRules(query.text, pack), query.expected),
  }))
  const rate = (key: 'status' | 'places' | 'preference' | 'avoid', rows = scored) =>
    rows.filter((row) => row.score[key]).length / rows.length

  it('has 50 queries in the documented categories', () => {
    expect(queries).toHaveLength(50)
    expect(new Set(queries.map((query) => query.category))).toEqual(
      new Set([
        'clean', 'typo', 'tagalog', 'english', 'code-switched',
        'preference', 'avoid', 'ambiguous', 'out-of-scope',
      ]),
    )
  })

  // The seed set was written alongside the rules, so this is a regression
  // guard, not a claim of real-world accuracy.
  it('reports every miss', () => {
    const misses = scored
      .filter((row) => !Object.values(row.score).every(Boolean))
      .map((row) => `#${row.query.id} [${row.query.category}] ${row.query.text}`)
    expect(misses).toEqual([])
  })

  it('asks or declines on every unclear or out-of-scope query', () => {
    const unclear = scored.filter((row) => row.query.expected.status !== 'ok')
    expect(rate('status', unclear)).toBe(1)
  })
})

// The JSON strings below are hand-written fixtures for the validator. They are not model output.
describe('resolveLlmOutput (validator, hand-written JSON fixtures)', () => {
  const json = (value: unknown) => JSON.stringify(value)

  it('resolves names through the matcher', () => {
    const result = resolveLlmOutput(
      'q',
      json({
        in_scope: true,
        origin: 'SYN Alpha Terminal',
        destination: 'foxtrot station',
        preference: 'fastest',
        avoid: ['EDSA', 'bus', 'Charlie'],
      }),
      pack,
    )
    expect(result.status).toBe('ok')
    expect(result.lane).toBe('llm')
    expect(result.intent).toEqual({
      originId: 'A',
      destinationId: 'F',
      preference: 'fastest',
      avoid: { landmarkIds: ['C'], routeIds: [], modes: ['bus'], tags: ['EDSA'] },
    })
  })

  it('drops a place the pack does not know and asks instead', () => {
    const result = resolveLlmOutput(
      'q',
      json({ in_scope: true, origin: 'SYN Alpha Terminal', destination: 'Sierra Tower', preference: null, avoid: [] }),
      pack,
    )
    expect(result.status).toBe('needs_clarification')
    expect(result.missing).toEqual(['destination'])
    expect(JSON.stringify(result)).not.toContain('Sierra')
  })

  it('ignores an invalid preference and unknown avoid items', () => {
    const result = resolveLlmOutput(
      'q',
      json({ in_scope: true, origin: 'Alpha', destination: 'Delta', preference: 'scenic', avoid: ['potholes', 42] }),
      pack,
    )
    expect(result.intent?.preference).toBe('cheapest')
    expect(result.intent?.avoid).toEqual({ landmarkIds: [], routeIds: [], modes: [], tags: [] })
  })

  it('treats "none" as not given', () => {
    const result = resolveLlmOutput(
      'q',
      json({ in_scope: true, origin: 'none', destination: 'SYN Delta Plaza', preference: 'none', avoid: [] }),
      pack,
    )
    expect(result.status).toBe('needs_clarification')
    expect(result.missing).toEqual(['origin'])
  })

  it('honours in_scope false', () => {
    const result = resolveLlmOutput(
      'q',
      json({ in_scope: false, origin: null, destination: null, preference: null, avoid: [] }),
      pack,
    )
    expect(result.status).toBe('unsupported')
  })

  it('rejects non-JSON', () => {
    expect(() => resolveLlmOutput('q', 'Sure! Here is the route.', pack)).toThrow()
  })
})

describe('parse lane selection', () => {
  it('does not call the model when the rules lane succeeds', async () => {
    let calls = 0
    const result = await parse('Alpha to Delta', pack, {
      llm: async () => {
        calls++
        return '{}'
      },
    })
    expect(result.lane).toBe('rules')
    expect(calls).toBe(0)
  })

  it('falls back to the rules result when the model keeps failing, after one retry', async () => {
    let calls = 0
    const result = await parse('Paano pumunta sa Delta?', pack, {
      llm: async () => {
        calls++
        throw new Error('model unavailable')
      },
    })
    expect(calls).toBe(2)
    expect(result.lane).toBe('rules')
    expect(result.status).toBe('needs_clarification')
  })

  it('builds a prompt that lists only pack places and the allowed preferences', () => {
    const prompt = buildLlmPrompt('papunta sa foxtrot', pack, 3)
    expect(prompt.system).toContain('SYN Foxtrot Station')
    expect(prompt.system.match(/^- SYN /gm)).toHaveLength(3)
    expect(prompt.system).toContain('cheapest')
    expect(prompt.user).toContain('papunta sa foxtrot')
    // Constrained decoding: places can only be pack names or "none".
    expect(prompt.schema.properties.origin.enum).toHaveLength(4)
    expect(prompt.schema.properties.origin.enum).toContain('SYN Foxtrot Station')
    expect(prompt.schema.properties.avoid.items.enum).toContain('EDSA')
  })
})
