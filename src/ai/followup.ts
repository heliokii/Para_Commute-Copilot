import { normalize } from '../match/fuzzy.ts'
import type { Avoid, Intent, Mode, Preference, RoutePack } from '../router/types.ts'
import { readUtterance, type LlmComplete } from './parse.ts'

// Follow-up mapper: turns "may mas mura?" or "paano kung sarado ang X?" into a
// change to the router's parameters. It never touches results; the router does.

export type Ask = 'fare' | 'time' | 'steps' | 'why'

export interface ParseDelta {
  preference?: Preference
  addAvoid?: Partial<Avoid>
  /** 'all' clears every avoid constraint. */
  removeAvoid?: Partial<Avoid> | 'all'
  setOrigin?: string
  setDestination?: string
  /** A question about the current result. Does not change the route. */
  ask?: Ask
  /** Start over with a new trip. */
  reset?: boolean
}

const RESET = /\b(bagong ruta|bagong hanap|bagong biyahe|ulit tayo|simula ulit|mag ?umpisa ulit|reset|new route|start over|iba na lang)\b/
const REMOVE_AVOID = /\b(okay na|ok na|pwede na|puwede na|bukas na|kahit dumaan|kahit sa|alisin ang iwas|tanggalin ang iwas|wag na iwas|wag nang iwasan|huwag nang iwasan|huwag na iwas|hindi na sarado|di na sarado|no need to avoid|stop avoiding)\b/

const ASK_PATTERNS: [Ask, RegExp][] = [
  ['why', /\b(bakit|why|paanong ito)\b/],
  ['fare', /\b(magkano|pamasahe|bayad|babayaran|how much|fare)\b/],
  ['time', /\b(gaano katagal|ilang minuto|ilang oras|katagal|tagal|how long|anong oras ako)\b/],
  ['steps', /\b(ulitin|ulit|paki ulit|pakiulit|steps?|hakbang|paano sumakay|saan ako sasakay|saan sasakay|saan bababa|saan ako bababa|detalye|details?)\b/],
]

const MODE_WORDS: Record<string, Mode> = {
  jeep: 'jeepney', jeepney: 'jeepney', dyip: 'jeepney',
  bus: 'bus', uv: 'uv', van: 'uv', fx: 'uv',
  mrt: 'train', lrt: 'train', tren: 'train', train: 'train',
  lakad: 'walk', maglakad: 'walk',
}

const AVOID_KEYS = ['landmarkIds', 'routeIds', 'modes', 'tags'] as const
const hasAny = (avoid: Partial<Avoid> | undefined) =>
  AVOID_KEYS.some((key) => (avoid?.[key]?.length ?? 0) > 0)

/** Things named in the text that are currently being avoided. */
function avoidedThingsNamed(text: string, pack: RoutePack, current: Avoid): Partial<Avoid> {
  const tokens = normalize(text).split(' ')
  const named: Partial<Avoid> = {}
  const tags = current.tags.filter((tag) => tokens.includes(normalize(tag)))
  if (tags.length) named.tags = tags
  const modes = current.modes.filter((mode) => tokens.some((token) => MODE_WORDS[token] === mode))
  if (modes.length) named.modes = modes
  const landmarkIds = current.landmarkIds.filter((id) => {
    const landmark = pack.landmarks.find((candidate) => candidate.id === id)
    return [landmark?.name ?? '', ...(landmark?.aliases ?? [])]
      .map(normalize)
      .some((form) => form && (tokens.includes(form) || normalize(text).includes(form)))
  })
  if (landmarkIds.length) named.landmarkIds = landmarkIds
  return named
}

/** Rules lane. Returns null when the text is not a recognisable follow-up. */
export function mapFollowupRules(text: string, pack: RoutePack, intent: Intent): ParseDelta | null {
  const normalized = normalize(text)
  if (!normalized) return null
  if (RESET.test(normalized)) return { reset: true }

  if (REMOVE_AVOID.test(normalized)) {
    const named = avoidedThingsNamed(text, pack, intent.avoid)
    const preference = readUtterance(text, pack).preference
    return { removeAvoid: hasAny(named) ? named : 'all', ...(preference ? { preference } : {}) }
  }

  const read = readUtterance(text, pack)
  const delta: ParseDelta = {}
  if (read.preference) delta.preference = read.preference
  if (hasAny(read.avoid)) {
    delta.addAvoid = Object.fromEntries(
      AVOID_KEYS.filter((key) => read.avoid[key].length > 0).map((key) => [key, read.avoid[key]]),
    )
  }
  // A clear new place replaces the old one. An unclear one is left alone.
  const single = (groups: string[][]) => {
    const ids = [...new Set(groups.flat())]
    return ids.length === 1 ? ids[0] : undefined
  }
  const origin = single(read.originIds)
  const destination = single(read.destinationIds)
  if (origin && origin !== intent.originId) delta.setOrigin = origin
  if (destination && destination !== intent.destinationId) delta.setDestination = destination

  if (Object.keys(delta).length > 0) return delta

  for (const [ask, pattern] of ASK_PATTERNS) {
    if (pattern.test(normalized)) return { ask }
  }
  return null
}

const unique = <T>(values: T[]) => [...new Set(values)]

/** Applies a delta to an intent. Pure: returns a new intent. */
export function applyDelta(intent: Intent, delta: ParseDelta): Intent {
  let avoid: Avoid = {
    landmarkIds: [...intent.avoid.landmarkIds],
    routeIds: [...intent.avoid.routeIds],
    modes: [...intent.avoid.modes],
    tags: [...intent.avoid.tags],
  }
  if (delta.removeAvoid === 'all') {
    avoid = { landmarkIds: [], routeIds: [], modes: [], tags: [] }
  } else if (delta.removeAvoid) {
    const remove = delta.removeAvoid
    avoid = {
      landmarkIds: avoid.landmarkIds.filter((id) => !remove.landmarkIds?.includes(id)),
      routeIds: avoid.routeIds.filter((id) => !remove.routeIds?.includes(id)),
      modes: avoid.modes.filter((mode) => !remove.modes?.includes(mode)),
      tags: avoid.tags.filter((tag) => !remove.tags?.includes(tag)),
    }
  }
  if (delta.addAvoid) {
    avoid = {
      landmarkIds: unique([...avoid.landmarkIds, ...(delta.addAvoid.landmarkIds ?? [])]),
      routeIds: unique([...avoid.routeIds, ...(delta.addAvoid.routeIds ?? [])]),
      modes: unique([...avoid.modes, ...(delta.addAvoid.modes ?? [])]),
      tags: unique([...avoid.tags, ...(delta.addAvoid.tags ?? [])]),
    }
  }
  const next: Intent = {
    originId: delta.setOrigin ?? intent.originId,
    destinationId: delta.setDestination ?? intent.destinationId,
    preference: delta.preference ?? intent.preference,
    avoid,
  }
  // Custom weights only make sense while the preference stays 'custom'.
  if (next.preference === 'custom' && intent.weights) next.weights = intent.weights
  return next
}

/** True when the delta changes what the router is asked. */
export function changesRoute(delta: ParseDelta): boolean {
  return Boolean(
    delta.preference || delta.addAvoid || delta.removeAvoid || delta.setOrigin || delta.setDestination,
  )
}

// --- LLM lane ---------------------------------------------------------------

const NONE = 'none'

export function buildFollowupPrompt(text: string, pack: RoutePack, intent: Intent) {
  const tags = [...new Set(pack.routes.flatMap((route) => route.tags))]
  const places = pack.landmarks.map((landmark) => landmark.name)
  const avoidable = [...places, ...tags, 'jeepney', 'bus', 'uv', 'train', 'walk']
  const schema = {
    type: 'object',
    properties: {
      preference: { type: 'string', enum: ['cheapest', 'fastest', 'fewest_transfers', NONE] },
      add_avoid: { type: 'array', items: { type: 'string', enum: avoidable }, maxItems: 3 },
      remove_avoid: { type: 'array', items: { type: 'string', enum: avoidable }, maxItems: 3 },
      ask: { type: 'string', enum: ['fare', 'time', 'steps', 'why', NONE] },
      in_scope: { type: 'boolean' },
    },
    required: ['preference', 'add_avoid', 'remove_avoid', 'ask', 'in_scope'],
    additionalProperties: false,
  }
  const system = [
    'A commuter already has a route and sends a follow-up message in Tagalog, English or Taglish.',
    'Turn the follow-up into one JSON object. Reply with JSON only.',
    `- "preference": "cheapest" (mas mura), "fastest" (mas mabilis), "fewest_transfers" (walang lipat), else "${NONE}".`,
    `- "add_avoid": what the rider now wants to avoid (iwas, sarado, wag sa). A known place${tags.length ? `, a road tag (${tags.join(', ')})` : ''} or a mode. Usually empty.`,
    '- "remove_avoid": what the rider no longer wants to avoid. Usually empty.',
    `- "ask": "fare" (magkano), "time" (gaano katagal), "steps" (paano, ulitin), "why" (bakit), else "${NONE}".`,
    '- "in_scope": false if the message is not about this trip.',
    '',
    `Current preference: ${intent.preference}. Currently avoiding: ${[...intent.avoid.tags, ...intent.avoid.modes].join(', ') || 'nothing'}.`,
    'Known places:',
    ...places.map((place) => `- ${place}`),
  ].join('\n')
  return { system, user: `Message: ${text}\nJSON:`, schema }
}

/** Validates the model's follow-up JSON. Unknown values are dropped, never kept. */
export function resolveFollowupOutput(output: string, pack: RoutePack): ParseDelta | null {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(output)
  } catch {
    throw new Error('LLM reply is not valid JSON')
  }
  if (typeof data !== 'object' || data === null) throw new Error('LLM reply is not a JSON object')
  if (data.in_scope === false) return null

  const tags = new Map(pack.routes.flatMap((route) => route.tags).map((tag) => [normalize(tag), tag]))
  const toAvoid = (list: unknown): Partial<Avoid> | undefined => {
    const avoid: Avoid = { landmarkIds: [], routeIds: [], modes: [], tags: [] }
    for (const item of Array.isArray(list) ? list : []) {
      if (typeof item !== 'string') continue
      const key = normalize(item)
      const tag = tags.get(key)
      const landmark = pack.landmarks.find((candidate) => normalize(candidate.name) === key)
      if (tag) avoid.tags.push(tag)
      else if (MODE_WORDS[key]) avoid.modes.push(MODE_WORDS[key])
      else if (landmark) avoid.landmarkIds.push(landmark.id)
    }
    if (!hasAny(avoid)) return undefined
    return Object.fromEntries(AVOID_KEYS.filter((k) => avoid[k].length > 0).map((k) => [k, unique(avoid[k] as string[])]))
  }

  const delta: ParseDelta = {}
  const preference = (['cheapest', 'fastest', 'fewest_transfers'] as const).find((value) => value === data.preference)
  if (preference) delta.preference = preference
  const add = toAvoid(data.add_avoid)
  if (add) delta.addAvoid = add
  const remove = toAvoid(data.remove_avoid)
  if (remove) delta.removeAvoid = remove
  const ask = (['fare', 'time', 'steps', 'why'] as const).find((value) => value === data.ask)
  if (ask && Object.keys(delta).length === 0) delta.ask = ask
  return Object.keys(delta).length > 0 ? delta : null
}

/**
 * Rules first. The model is asked only when rules found nothing, and a failed
 * or invalid model reply means "not understood", never a guess.
 */
export async function mapFollowup(
  text: string,
  pack: RoutePack,
  intent: Intent,
  llm?: LlmComplete,
): Promise<{ delta: ParseDelta | null; lane: 'rules' | 'llm' }> {
  const rules = mapFollowupRules(text, pack, intent)
  if (rules || !llm) return { delta: rules, lane: 'rules' }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { delta: resolveFollowupOutput(await llm(buildFollowupPrompt(text, pack, intent)), pack), lane: 'llm' }
    } catch (error) {
      if (attempt === 1) console.warn('Follow-up model lane failed', error)
    }
  }
  return { delta: null, lane: 'rules' }
}
