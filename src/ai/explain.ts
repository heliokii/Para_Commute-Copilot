import type { RoutePack, RouteResult } from '../router/types.ts'
import type { LlmComplete } from './parse.ts'

// Explain layer. Template first: every sentence is built from the RouteResult.
// An optional model pass may reword a short summary, but its text is shown only
// if every number and every place or route name in it exists in the RouteResult.
// The model never computes anything.

const MODE_WORDS: Record<string, string> = {
  jeepney: 'jeepney',
  modern_jeepney: 'modern jeepney',
  uv: 'UV Express',
  bus: 'bus',
  train: 'tren',
  walk: 'lakad',
}

const peso = (amount: number) => `₱${amount.toFixed(2)}`

function minutesText(minutes: number): string {
  const whole = Math.round(minutes)
  if (whole < 60) return `${whole} min`
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  return rest === 0 ? `${hours} oras` : `${hours} oras ${rest} min`
}

const landmarkName = (pack: RoutePack, id: string) =>
  pack.landmarks.find((landmark) => landmark.id === id)?.name ?? id

const routeName = (pack: RoutePack, id: string) =>
  pack.routes.find((route) => route.id === id)?.name ?? id

/** Numbered Taglish steps, one per leg, plus a closing line. Deterministic. */
export function explainSteps(result: RouteResult, pack: RoutePack): string[] {
  if (result.status !== 'ok') return []
  const steps = result.legs.map((leg) => {
    const from = landmarkName(pack, leg.boardId)
    const to = landmarkName(pack, leg.alightId)
    if (leg.mode === 'walk') {
      return `Maglakad mula ${from} hanggang ${to} (${minutesText(leg.minutes)}).`
    }
    return `Sumakay ng ${MODE_WORDS[leg.mode]} na "${routeName(pack, leg.routeId)}" sa ${from}. Bumaba sa ${to} (${minutesText(leg.minutes)}, ${peso(leg.fare)}).`
  })
  return steps
}

/** One or two template sentences that sum up a result. Deterministic. */
export function explainSummary(result: RouteResult, pack: RoutePack): string {
  if (result.status !== 'ok') return ''
  const rides = result.legs.filter((leg) => leg.mode !== 'walk').length
  const from = landmarkName(pack, result.legs[0].boardId)
  const to = landmarkName(pack, result.legs.at(-1)!.alightId)
  const parts = [
    `Mula ${from} hanggang ${to}: ${peso(result.totalFare)}, ${minutesText(result.totalMinutes)}, ${rides} sakay.`,
  ]
  if (result.fareAsOf) parts.push(`Pamasahe as of ${result.fareAsOf}.`)
  if (result.simulated) parts.push('Simulation ito batay sa iniwasan mo.')
  if (result.usedUnverifiedData) parts.push('Hindi pa verified ang data.')
  return parts.join(' ')
}

/** Why this option was picked, from the preference alone. */
export function explainWhy(result: RouteResult): string {
  if (result.status !== 'ok') return ''
  switch (result.preference) {
    case 'cheapest':
      return `Ito ang pinakamura sa route pack: ${peso(result.totalFare)}.`
    case 'fastest':
      return `Ito ang pinakamabilis sa route pack: ${minutesText(result.totalMinutes)}. Hindi kasama ang oras ng paghihintay.`
    case 'fewest_transfers':
      return result.transfers === 0
        ? 'Ito ang may pinakakaunting lipat: walang lipat.'
        : `Ito ang may pinakakaunting lipat: ${result.transfers} lipat.`
    case 'custom':
      return 'Ito ang pinakamaganda ayon sa sarili mong timbang ng pamasahe, oras at lipat.'
  }
}

// --- Validator --------------------------------------------------------------

export interface ValidationResult {
  valid: boolean
  /** Why the text was rejected. Empty when valid. */
  problems: string[]
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** The numbers a RouteResult supports, kept apart by unit so a minute count cannot pass as a fare. */
function allowedNumbers(result: RouteResult) {
  const set = (values: number[]) => new Set(values.flatMap((value) => [round2(value), Math.round(value)]))
  // "1 oras 20 min" is the same fact as 80 minutes.
  const timeForms = (minutes: number) => {
    const whole = Math.round(minutes)
    return [whole, Math.floor(whole / 60), whole % 60]
  }
  const rides = result.legs.filter((leg) => leg.mode !== 'walk').length
  return {
    pesos: set([result.totalFare, ...result.legs.map((leg) => leg.fare)]),
    time: set([...timeForms(result.totalMinutes), ...result.legs.flatMap((leg) => timeForms(leg.minutes))]),
    km: set(result.legs.map((leg) => leg.distKm)),
    // Bare numbers: counts only, plus list numbering up to the number of legs.
    counts: set([result.transfers, rides, result.legs.length, ...result.legs.map((_, index) => index + 1)]),
  }
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const NUMBER = String.raw`\d+(?:[.,]\d+)?`
// "P13" and "PHP 13" count as pesos, but not the "p" that ends a word ("Step 1").
const PESO_BEFORE = new RegExp(String.raw`(?:₱|(?<![\p{L}])(?:php|p))\s*(${NUMBER})`, 'giu')
const PESO_AFTER = new RegExp(String.raw`(${NUMBER})\s*(?:pesos?|piso|php)(?![\p{L}])`, 'giu')
const TIME = new RegExp(String.raw`(${NUMBER})\s*(?:minuto|minutes?|mins?|oras|hours?|hrs?)(?![\p{L}])`, 'giu')
const KM = new RegExp(String.raw`(${NUMBER})\s*(?:km|kilometro|kilometers?|kilometres?)(?![\p{L}])`, 'giu')
const BARE = new RegExp(NUMBER, 'g')

/**
 * Checks model-written text against the RouteResult. Rejects any amount, time,
 * distance or count that is not a fact of this result, and any pack place or
 * route that is not on it.
 */
export function validateExplanation(
  text: string,
  result: RouteResult,
  pack: RoutePack,
): ValidationResult {
  const problems: string[] = []
  if (result.status !== 'ok') return { valid: false, problems: ['no route to explain'] }
  if (!text.trim()) return { valid: false, problems: ['empty text'] }

  const usedLandmarks = new Set(result.legs.flatMap((leg) => [leg.boardId, leg.alightId]))
  const usedRoutes = new Set(result.legs.map((leg) => leg.routeId))
  let remaining = text

  // Names first, longest first, so digits inside a name ("Jeep 3") are not read as amounts.
  const names = [
    ...pack.landmarks.flatMap((landmark) =>
      [landmark.name, ...landmark.aliases].map((name) => ({ name, ok: usedLandmarks.has(landmark.id) })),
    ),
    ...pack.routes.map((route) => ({ name: route.name, ok: usedRoutes.has(route.id) })),
  ].sort((a, b) => b.name.length - a.name.length)

  for (const { name, ok } of names) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'giu')
    if (!pattern.test(remaining)) continue
    if (!ok) problems.push(`names "${name}", which is not on this route`)
    remaining = remaining.replace(pattern, ' ')
  }

  // The fare as-of date is a fact of the result; any other date falls through to the number checks.
  if (result.fareAsOf) remaining = remaining.split(result.fareAsOf).join(' ')

  const allowed = allowedNumbers(result)
  const take = (pattern: RegExp, values: Set<number>, unit: string) => {
    remaining = remaining.replace(pattern, (_match, number: string) => {
      if (!values.has(round2(Number(number.replace(',', '.'))))) {
        problems.push(`${unit} ${number} is not in the route result`)
      }
      return ' '
    })
  }
  take(PESO_BEFORE, allowed.pesos, 'fare')
  take(PESO_AFTER, allowed.pesos, 'fare')
  take(TIME, allowed.time, 'time')
  take(KM, allowed.km, 'distance')
  for (const match of remaining.matchAll(BARE)) {
    if (!allowed.counts.has(round2(Number(match[0].replace(',', '.'))))) {
      problems.push(`number ${match[0]} is not in the route result`)
    }
  }

  return { valid: problems.length === 0, problems }
}

// --- Optional model summary -------------------------------------------------

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
}

export function buildSummaryPrompt(result: RouteResult, pack: RoutePack) {
  const system = [
    'Ikaw si Tsupher, isang masayahing gabay sa commute. Sumulat ng 2 hanggang 3 maikling pangungusap sa Taglish.',
    'Gamitin LAMANG ang mga facts sa ibaba. Huwag magdagdag ng numero, lugar, ruta o tip na wala rito. Huwag mag-compute.',
    'Sumagot ng JSON: {"summary": "..."}',
  ].join('\n')
  const user = ['Facts:', explainSummary(result, pack), ...explainSteps(result, pack)].join('\n')
  return { system, user, schema: SUMMARY_SCHEMA }
}

/**
 * Asks the on-device model for a friendlier summary. Returns null unless the
 * text passes validateExplanation, so a wrong fare or place is never shown.
 */
export async function summarizeWithLlm(
  result: RouteResult,
  pack: RoutePack,
  llm: LlmComplete,
): Promise<{ text: string | null; rejected?: string[] }> {
  if (result.status !== 'ok') return { text: null }
  try {
    const raw = await llm(buildSummaryPrompt(result, pack))
    const summary = (JSON.parse(raw) as { summary?: unknown }).summary
    if (typeof summary !== 'string') return { text: null, rejected: ['reply has no summary text'] }
    const check = validateExplanation(summary, result, pack)
    return check.valid ? { text: summary.trim() } : { text: null, rejected: check.problems }
  } catch (error) {
    return { text: null, rejected: [error instanceof Error ? error.message : String(error)] }
  }
}
