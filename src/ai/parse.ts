import { editDistance, normalize } from '../match/fuzzy.ts'
import type { Avoid, Intent, Landmark, Mode, Preference, RoutePack } from '../router/types.ts'

// Understand layer: Taglish text -> validated Intent.
// Rules lane first (fuzzy landmark match + cue words). The LLM lane runs only
// when rules are ambiguous or incomplete, and its output is re-resolved through
// the same matcher, so a model can never introduce a place that is not in the pack.

export type ParseField = 'origin' | 'destination'

export interface ParseCandidate {
  field: ParseField
  options: { id: string; name: string }[]
}

export interface ParseResult {
  status: 'ok' | 'needs_clarification' | 'unsupported'
  intent?: Intent
  /** Ambiguous places: the rider must pick one. Never guessed. */
  candidates?: ParseCandidate[]
  /** Fields the text did not give. */
  missing?: ParseField[]
  /** What was understood so far, for follow-up questions. */
  partial?: {
    originId?: string
    destinationId?: string
    preference?: Preference
    avoid: Avoid
  }
  rawText: string
  lane: 'rules' | 'llm'
}

/** Sends chat messages to the on-device model and returns its raw text reply. */
export type LlmComplete = (request: {
  system: string
  user: string
  schema: object
  /** Reply length limit in tokens. Default 200. */
  maxTokens?: number
}) => Promise<string>

// --- Vocabulary -------------------------------------------------------------

const FILLERS = new Set([
  'po', 'ho', 'naman', 'ba', 'nga', 'lang', 'kasi', 'eh', 'e', 'yung', 'ung', 'please', 'pls',
  'paki', 'sana', 'daw', 'raw', 'kaya', 'pwede', 'puwede', 'pwedeng', 'hi', 'hello', 'uy', 'oy',
  'tsupher', 'kuya', 'boss', 'salamat', 'thanks',
])

const ORIGIN_CUES = new Set([
  'galing', 'mula', 'from', 'nasa', 'andito', 'nandito', 'nanggaling', 'manggagaling', 'buhat',
])

const DESTINATION_CUES = new Set([
  'papunta', 'papuntang', 'pupunta', 'punta', 'pumunta', 'makapunta', 'makakapunta', 'pa', 'to',
  'hanggang', 'patungo', 'patungong', 'going', 'makarating', 'makakarating', 'pauwi', 'pauwing',
  'papasok', 'pupuntang', 'puntang',
])

const AVOID_CUES = new Set([
  'iwas', 'iwasan', 'umiwas', 'iiwas', 'avoid', 'sarado', 'closed', 'sira', 'bawal', 'wag',
  'huwag', 'ayaw', 'ayoko', 'except', 'without', 'walang',
])

/** Words that may sit between a cue and the place it refers to. */
const CONNECTORS = new Set([
  'sa', 'ng', 'ang', 'ako', 'ko', 'may', 'the', 'si', 'kay', 'akong', 'na', 'at', 'dumaan',
  'dadaan', 'daan', 'dito', 'yan', 'iyan', 'mag', 'sumakay', 'kong', 'kami', 'tayo', 'via',
  'kung', 'is', 'if', 'are', 'mismo', 'mga',
])

const MODE_WORDS: Record<string, Mode> = {
  jeep: 'jeepney', jeepney: 'jeepney', dyip: 'jeepney', dyipni: 'jeepney',
  bus: 'bus', buses: 'bus',
  uv: 'uv', van: 'uv', fx: 'uv',
  mrt: 'train', lrt: 'train', tren: 'train', train: 'train',
  lakad: 'walk', maglakad: 'walk', walking: 'walk', lakarin: 'walk',
}

const PREFERENCE_PATTERNS: [Preference, RegExp][] = [
  // Checked first: "walang lipat" would otherwise read as an avoid phrase.
  ['fewest_transfers', /\b(walang lipat|isang sakay lang|isang sakay|(pina)?ka(k)?a?unting (lipat|sakay|transfer)|konting (lipat|sakay)|kaunting (lipat|sakay)|ayaw (ko )?(ng )?(maraming )?lipat|fewest transfers?|less transfers?|least transfers?|no transfers?|direct|diretso|dire-?diretso|tuloy tuloy)\b/],
  ['cheapest', /\b(pinakamura|mas mura|mura|murang|tipid|matipid|pinakatipid|cheap|cheaper|cheapest|budget|makatipid|barat)\b/],
  ['fastest', /\b(pinakamabilis|mas mabilis|mabilis|mabilisan|bilis|fast|faster|fastest|quick|quickest|nagmamadali|madalian|late na ako|agad)\b/],
]

const TRAVEL_WORDS = /\b(paano|pano|papunta|pumunta|punta|sakay|sasakay|ruta|route|biyahe|byahe|commute|galing|mula|pamasahe|magkano|how do i get|how to get|directions?|going)\b/

// --- Mentions ---------------------------------------------------------------

interface Mention {
  start: number
  end: number
  /** One id when clear, several when the text fits more than one landmark. */
  ids: string[]
  score: number
}

const similarity = (a: string, b: string) => 1 - editDistance(a, b) / Math.max(a.length, b.length, 1)

/** How well a span of the rider's words names a landmark string. 0 when it does not. */
function mentionScore(span: string, candidate: string): number {
  if (span === candidate) return 1
  if (span.length < 4) return 0
  const words = candidate.split(' ')
  if (words.includes(span)) return 0.9
  if (candidate.startsWith(span + ' ')) return 0.9
  const targets = [candidate, ...words.filter((word) => word.length >= 4)]
  const best = Math.max(...targets.map((target) => similarity(span, target)))
  // One typo in a five-letter word is 0.8.
  return best >= 0.8 ? 0.6 + (best - 0.8) : 0
}

function findMentions(tokens: string[], landmarks: Landmark[], blocked: Set<string>): Mention[] {
  const names = landmarks.map((landmark) => ({
    id: landmark.id,
    forms: [landmark.name, ...landmark.aliases].map(normalize).filter(Boolean),
  }))

  const found: Mention[] = []
  for (let start = 0; start < tokens.length; start++) {
    for (let length = Math.min(5, tokens.length - start); length >= 1; length--) {
      const slice = tokens.slice(start, start + length)
      if (length === 1 && blocked.has(slice[0])) continue
      // A span may not begin or end on a cue or connector word.
      if (blocked.has(slice[0]) || blocked.has(slice[slice.length - 1])) continue
      const span = slice.join(' ')
      const scored = names
        .map(({ id, forms }) => ({ id, score: Math.max(...forms.map((form) => mentionScore(span, form))) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      if (scored.length === 0) continue
      const top = scored[0].score
      // Close runners-up make the span ambiguous. The rider decides, not the app.
      const ids = scored.filter((entry) => top - entry.score < 0.05).map((entry) => entry.id)
      found.push({ start, end: start + length, ids, score: top })
    }
  }

  // Best score first, then the longer span, then the earlier one. No overlaps.
  found.sort((a, b) => b.score - a.score || b.end - b.start - (a.end - a.start) || a.start - b.start)
  const taken: Mention[] = []
  for (const mention of found) {
    if (taken.every((other) => mention.end <= other.start || mention.start >= other.end)) {
      taken.push(mention)
    }
  }
  // "alfa terminal": the clean word "terminal" wins on score, but the whole
  // phrase names the same place. Widen to it so the cue before "alfa" still applies.
  for (const mention of taken) {
    for (const wider of found) {
      const covers = wider.start <= mention.start && wider.end >= mention.end
      const sameSingleId = wider.ids.length === 1 && mention.ids.length === 1 && wider.ids[0] === mention.ids[0]
      const free = taken.every(
        (other) => other === mention || wider.end <= other.start || wider.start >= other.end,
      )
      if (covers && sameSingleId && free && wider.end - wider.start > mention.end - mention.start) {
        mention.start = wider.start
        mention.end = wider.end
      }
    }
  }
  return taken.sort((a, b) => a.start - b.start)
}

type Role = ParseField | 'avoid' | null

/** The cue that governs position `index`, looking back past connector words. */
function roleBefore(tokens: string[], index: number): Role {
  for (let i = index - 1; i >= 0 && i >= index - 4; i--) {
    const token = tokens[i]
    if (AVOID_CUES.has(token)) return 'avoid'
    if (ORIGIN_CUES.has(token)) return 'origin'
    if (DESTINATION_CUES.has(token)) return 'destination'
    if (!CONNECTORS.has(token)) return null
  }
  return null
}

// --- Rules lane -------------------------------------------------------------

const emptyAvoid = (): Avoid => ({ landmarkIds: [], routeIds: [], modes: [], tags: [] })

function detectPreference(text: string): { preference: Preference | undefined; rest: string } {
  for (const [preference, pattern] of PREFERENCE_PATTERNS) {
    if (pattern.test(text)) return { preference, rest: text.replace(pattern, ' ') }
  }
  return { preference: undefined, rest: text }
}

/** Places and constraints read from free text. */
export interface Understood {
  originIds: string[][]
  destinationIds: string[][]
  preference: Preference | undefined
  avoid: Avoid
  travelLike: boolean
}

function understand(text: string, pack: RoutePack): Understood {
  const normalized = normalize(text)
  const { preference, rest } = detectPreference(normalized)
  const tokens = rest.split(' ').filter((token) => token && !FILLERS.has(token))

  const avoid = emptyAvoid()
  const packTags = new Map<string, string>()
  for (const tag of [...pack.routes.flatMap((route) => route.tags), ...pack.landmarks.flatMap((landmark) => landmark.tags)]) {
    packTags.set(normalize(tag), tag)
  }

  // Tags and modes named after an avoid cue.
  const consumed = new Set<number>()
  tokens.forEach((token, index) => {
    if (roleBefore(tokens, index) !== 'avoid') return
    const tag = packTags.get(token)
    if (tag) {
      if (!avoid.tags.includes(tag)) avoid.tags.push(tag)
      consumed.add(index)
    } else if (MODE_WORDS[token]) {
      if (!avoid.modes.includes(MODE_WORDS[token])) avoid.modes.push(MODE_WORDS[token])
      consumed.add(index)
    }
  })

  const blocked = new Set([...CONNECTORS, ...ORIGIN_CUES, ...DESTINATION_CUES, ...AVOID_CUES])
  const hasCue = tokens.some(
    (token) => ORIGIN_CUES.has(token) || DESTINATION_CUES.has(token) || AVOID_CUES.has(token),
  )
  // A typo-level match alone ("kanta" for "Kanto") is not evidence of a trip.
  // It counts only when the text also has a cue or a travel word.
  const trusted = hasCue || TRAVEL_WORDS.test(normalized)
  const mentions = findMentions(tokens, pack.landmarks, blocked).filter(
    (mention) => !consumed.has(mention.start) && (trusted || mention.score >= 0.9),
  )

  const originIds: string[][] = []
  const destinationIds: string[][] = []
  const unassigned: Mention[] = []
  for (const mention of mentions) {
    const role = roleBefore(tokens, mention.start)
    if (role === 'avoid') {
      // Only a clear landmark can be avoided; an ambiguous one is dropped.
      if (mention.ids.length === 1 && !avoid.landmarkIds.includes(mention.ids[0])) {
        avoid.landmarkIds.push(mention.ids[0])
      }
    } else if (role === 'origin') originIds.push(mention.ids)
    else if (role === 'destination') destinationIds.push(mention.ids)
    else unassigned.push(mention)
  }

  // A place with no cue fills whichever single slot is still open.
  if (unassigned.length === 1) {
    if (originIds.length === 1 && destinationIds.length === 0) destinationIds.push(unassigned[0].ids)
    else if (destinationIds.length === 1 && originIds.length === 0) originIds.push(unassigned[0].ids)
    // Alone, a bare place answers "Saan ka papunta?".
    else if (originIds.length === 0 && destinationIds.length === 0) destinationIds.push(unassigned[0].ids)
  }
  // Several bare places: word order alone does not say which is which, so nothing is assigned.

  return {
    originIds,
    destinationIds,
    preference,
    avoid,
    travelLike:
      TRAVEL_WORDS.test(normalized) ||
      mentions.length > 0 ||
      avoid.tags.length + avoid.modes.length > 0 ||
      preference !== undefined,
  }
}

function assemble(
  rawText: string,
  lane: ParseResult['lane'],
  understood: Understood,
): ParseResult {
  const { originIds, destinationIds, preference, avoid } = understood
  if (!understood.travelLike) return { status: 'unsupported', rawText, lane }

  const candidates: ParseCandidate[] = []
  const missing: ParseField[] = []
  const pick = (field: ParseField, groups: string[][]): string | undefined => {
    if (groups.length === 0) {
      missing.push(field)
      return undefined
    }
    // Two different places for one slot, or one unclear place: ask.
    const ids = [...new Set(groups.flat())]
    if (ids.length === 1) return ids[0]
    candidates.push({ field, options: ids.map((id) => ({ id, name: id })) })
    return undefined
  }
  const originId = pick('origin', originIds)
  const destinationId = pick('destination', destinationIds)
  const partial = { originId, destinationId, preference, avoid }

  if (originId && destinationId) {
    return {
      status: 'ok',
      intent: { originId, destinationId, preference: preference ?? 'cheapest', avoid },
      partial,
      rawText,
      lane,
    }
  }
  return {
    status: 'needs_clarification',
    ...(candidates.length > 0 ? { candidates } : {}),
    ...(missing.length > 0 ? { missing } : {}),
    partial,
    rawText,
    lane,
  }
}

function withNames(result: ParseResult, pack: RoutePack): ParseResult {
  if (!result.candidates) return result
  const name = (id: string) => pack.landmarks.find((landmark) => landmark.id === id)?.name ?? id
  return {
    ...result,
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      options: candidate.options.map((option) => ({ id: option.id, name: name(option.id) })),
    })),
  }
}

/** Raw reading of a message, before it is judged complete. Used for follow-ups. */
export function readUtterance(text: string, pack: RoutePack): Understood {
  return understand(text, pack)
}

/** Rules lane only. Synchronous and deterministic. */
export function parseWithRules(text: string, pack: RoutePack): ParseResult {
  return withNames(assemble(text, 'rules', understand(text, pack)), pack)
}

// --- LLM lane ---------------------------------------------------------------

const NONE = 'none'
const LLM_MODES = ['jeepney', 'bus', 'uv', 'train', 'walk']

/**
 * JSON schema for constrained decoding. Places are an enum of names taken from
 * the route pack, so the model cannot write a place that does not exist.
 */
export function llmSchema(places: string[], tags: string[]) {
  return {
    type: 'object',
    properties: {
      origin: { type: 'string', enum: [...places, NONE] },
      destination: { type: 'string', enum: [...places, NONE] },
      preference: { type: 'string', enum: ['cheapest', 'fastest', 'fewest_transfers', NONE] },
      avoid: {
        type: 'array',
        items: { type: 'string', enum: [...places, ...tags, ...LLM_MODES] },
        maxItems: 3,
      },
      in_scope: { type: 'boolean' },
    },
    required: ['origin', 'destination', 'preference', 'avoid', 'in_scope'],
    additionalProperties: false,
  }
}

export function buildLlmPrompt(text: string, pack: RoutePack, topK = 12) {
  // Only place names relevant to the text, so the prompt stays small.
  const tokens = normalize(text).split(' ')
  const relevance = (landmark: Landmark) =>
    Math.max(
      0,
      ...[landmark.name, ...landmark.aliases].flatMap((form) =>
        normalize(form)
          .split(' ')
          .filter((word) => word.length >= 4)
          .flatMap((word) => tokens.map((token) => similarity(token, word))),
      ),
    )
  const places = [...pack.landmarks]
    .map((landmark) => ({ landmark, score: relevance(landmark) }))
    .sort((a, b) => b.score - a.score || a.landmark.id.localeCompare(b.landmark.id))
    .slice(0, topK)
    .map(({ landmark }) => landmark.name)
  const tags = [...new Set(pack.routes.flatMap((route) => route.tags))]
  // The examples use placeholder letters, not pack places, so they cannot leak into an answer.
  const example = (message: string, json: object) => `Message: ${message}\nJSON: ${JSON.stringify(json)}`

  const system = [
    'You turn a commuter message (Tagalog, English or Taglish) into one JSON object. Reply with JSON only.',
    '',
    'Known places:',
    ...places.map((place) => `- ${place}`),
    '',
    'Fields:',
    '- "origin": the place the rider starts from. Cue words: galing, mula, from, nasa, nandito.',
    '- "destination": the place the rider is going to. Cue words: papunta, papuntang, pa-, punta, to, hanggang.',
    `  Use a name from the known places. Use "${NONE}" if the message does not give it or it is not a known place.`,
    `- "preference": "cheapest" (mura, tipid), "fastest" (mabilis, nagmamadali), "fewest_transfers" (walang lipat, kaunting lipat, diretso), else "${NONE}".`,
    `- "avoid": only what the rider says to avoid (iwas, huwag dumaan, wag sa, sarado, avoid). A known place${tags.length ? `, a road tag (${tags.join(', ')})` : ''}, or a mode (${LLM_MODES.join(', ')}). Usually an empty list.`,
    '- "in_scope": true if the message is about travelling between places, else false.',
    '',
    'Examples (X and Y stand for known places):',
    example('Paano pumunta sa Y galing X?', { origin: 'X', destination: 'Y', preference: NONE, avoid: [], in_scope: true }),
    example('mula X papuntang Y, pinakamura, iwas bus', { origin: 'X', destination: 'Y', preference: 'cheapest', avoid: ['bus'], in_scope: true }),
    example('pa-Y ako', { origin: NONE, destination: 'Y', preference: NONE, avoid: [], in_scope: true }),
    example('Anong ulam mamaya?', { origin: NONE, destination: NONE, preference: NONE, avoid: [], in_scope: false }),
  ].join('\n')
  return { system, user: `Message: ${text}\nJSON:`, schema: llmSchema(places, tags) }
}

/** Turns the model's JSON into an Intent, resolving every name through the matcher. */
export function resolveLlmOutput(rawText: string, output: string, pack: RoutePack): ParseResult {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(output)
  } catch {
    throw new Error('LLM reply is not valid JSON')
  }
  if (typeof data !== 'object' || data === null) throw new Error('LLM reply is not a JSON object')
  if (data.in_scope === false) return { status: 'unsupported', rawText, lane: 'llm' }

  const blocked = new Set<string>()
  const resolve = (value: unknown): string[][] => {
    if (typeof value !== 'string' || !normalize(value) || value === NONE) return []
    const tokens = normalize(value).split(' ')
    const [mention] = findMentions(tokens, pack.landmarks, blocked)
    // A name the pack does not know resolves to nothing. It is never kept as text.
    return mention ? [mention.ids] : []
  }

  const avoid = emptyAvoid()
  const tags = new Map(pack.routes.flatMap((route) => route.tags).map((tag) => [normalize(tag), tag]))
  for (const item of Array.isArray(data.avoid) ? data.avoid : []) {
    if (typeof item !== 'string') continue
    const key = normalize(item)
    const tag = tags.get(key)
    if (tag) {
      if (!avoid.tags.includes(tag)) avoid.tags.push(tag)
    } else if (MODE_WORDS[key]) {
      if (!avoid.modes.includes(MODE_WORDS[key])) avoid.modes.push(MODE_WORDS[key])
    } else {
      const [ids] = resolve(item)
      if (ids?.length === 1 && !avoid.landmarkIds.includes(ids[0])) avoid.landmarkIds.push(ids[0])
    }
  }

  const preference = (['cheapest', 'fastest', 'fewest_transfers'] as const).find(
    (value) => value === data.preference,
  )
  return withNames(
    assemble(rawText, 'llm', {
      originIds: resolve(data.origin),
      destinationIds: resolve(data.destination),
      preference,
      avoid,
      travelLike: true,
    }),
    pack,
  )
}

export interface ParseOptions {
  /** On-device model. Without it, only the rules lane runs. */
  llm?: LlmComplete
  /** Skip the rules lane (benchmarking only). */
  forceLlm?: boolean
}

/**
 * Taglish text to a validated Intent. Rules first; the LLM only when rules are
 * ambiguous or incomplete. If the model fails or replies badly twice, the rules
 * result stands.
 */
export async function parse(text: string, pack: RoutePack, options: ParseOptions = {}): Promise<ParseResult> {
  const rules = parseWithRules(text, pack)
  if (!options.llm || (rules.status === 'ok' && !options.forceLlm)) return rules

  const prompt = buildLlmPrompt(text, pack)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return resolveLlmOutput(text, await options.llm(prompt), pack)
    } catch (error) {
      // Invalid JSON: retry once, then fall back.
      if (attempt === 1) console.warn('LLM lane failed, using the rules result', error)
    }
  }
  return rules
}

/** Compares a ParseResult with an expected one, field by field. Used by tests and the benchmark. */
export interface ExpectedParse {
  status: ParseResult['status']
  originId?: string
  destinationId?: string
  preference?: Preference
  avoid?: Partial<Avoid>
}

export function scoreParse(result: ParseResult, expected: ExpectedParse) {
  const sorted = (list: readonly string[] | undefined) => [...(list ?? [])].sort().join(',')
  const avoid = result.intent?.avoid ?? result.partial?.avoid ?? emptyAvoid()
  const expectedAvoid = { ...emptyAvoid(), ...expected.avoid }
  const status = result.status === expected.status
  const places =
    expected.status === 'ok'
      ? result.intent?.originId === expected.originId && result.intent?.destinationId === expected.destinationId
      : status
  return {
    status,
    places,
    preference: expected.status === 'ok' ? result.intent?.preference === (expected.preference ?? 'cheapest') : status,
    avoid:
      expected.status === 'ok'
        ? (['landmarkIds', 'routeIds', 'modes', 'tags'] as const).every(
            (key) => sorted(avoid[key]) === sorted(expectedAvoid[key]),
          )
        : status,
  }
}
