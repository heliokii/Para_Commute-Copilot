import { describeStationFares, lookupStationFares } from '../fares/lookup.ts'
import { orderOptions } from '../router/order.ts'
import type { Avoid, Intent, Preference, RoutePack, RouteResult } from '../router/types.ts'
import { explainSteps, explainSummary, explainWhy } from './explain.ts'
import { applyDelta, changesRoute, mapFollowup, type Ask } from './followup.ts'
import {
  parse,
  parseWithRules,
  readUtterance,
  type LlmComplete,
  type ParseCandidate,
  type ParseField,
} from './parse.ts'

// Tsupher's conversation logic. Understand -> Plan -> Explain, with the router
// in the middle. Everything Tsupher says about a route is built from RouteResult.
// The session lives in memory only and is never persisted.

const MAX_TURNS = 12

export interface Turn {
  from: 'user' | 'tsupher'
  text: string
}

interface Pending {
  originId?: string
  destinationId?: string
  preference?: Preference
  avoid: Avoid
  missing: ParseField[]
}

export interface Session {
  intent: Intent | null
  options: RouteResult[]
  chosenIndex: number
  /** A half-understood request waiting for the rider to fill a gap. */
  pending: Pending | null
  turns: Turn[]
}

export const createSession = (): Session => ({
  intent: null,
  options: [],
  chosenIndex: -1,
  pending: null,
  turns: [],
})

/** Router access. Sync in tests (core functions), async in the app (worker). */
export interface ChatRouter {
  planOptions(intent: Intent): RouteResult[] | Promise<RouteResult[]>
  planRoute(intent: Intent): RouteResult | Promise<RouteResult>
}

export interface ChatDeps {
  pack: RoutePack
  router: ChatRouter
  /** On-device model. Without it everything runs through rules and templates. */
  llm?: LlmComplete
}

export type ReplyKind =
  | 'options' // route options to show as cards
  | 'no_route'
  | 'clarify' // Tsupher needs a missing or ambiguous place
  | 'answer' // a fact about the current route
  | 'unsupported' // out of scope or not understood
  | 'reset'

export interface TsupherReply {
  kind: ReplyKind
  /** Key into copy.chat for the lead sentence; the UI owns the wording. */
  message:
    | 'found'
    | 'refined'
    | 'whatIf'
    | 'noRoute'
    | 'askOrigin'
    | 'askDestination'
    | 'askBoth'
    | 'pickOne'
    | 'unsupported'
    | 'reset'
    | 'answer'
  /** Deterministic text built from the RouteResult (summary, steps, why). */
  facts: string[]
  /** With route options: the published train fare for the same two stations, when the pack has one. */
  trainFare?: string
  options: RouteResult[]
  chosenIndex: number
  candidates?: ParseCandidate[]
  simulated: boolean
  lane: 'rules' | 'llm'
  intent: Intent | null
}

function remember(session: Session, turn: Turn) {
  session.turns = [...session.turns, turn].slice(-MAX_TURNS)
}

async function plan(session: Session, intent: Intent, deps: ChatDeps) {
  const [options, chosen] = await Promise.all([
    deps.router.planOptions(intent),
    deps.router.planRoute(intent),
  ])
  const ordered = orderOptions(options, chosen)
  session.intent = intent
  session.options = ordered.options
  session.chosenIndex = ordered.chosenIndex
  session.pending = null
  return ordered
}

const current = (session: Session): RouteResult | null => {
  const result = session.options[Math.max(session.chosenIndex, 0)]
  return result?.status === 'ok' ? result : null
}

function answer(ask: Ask, result: RouteResult, pack: RoutePack): string[] {
  switch (ask) {
    case 'fare':
    case 'time':
      return [explainSummary(result, pack)]
    case 'why':
      return [explainWhy(result)]
    case 'steps':
      return explainSteps(result, pack)
  }
}

/** Handles one rider message and returns what Tsupher should show. */
export async function handleUtterance(
  session: Session,
  text: string,
  deps: ChatDeps,
): Promise<TsupherReply> {
  const { pack } = deps
  remember(session, { from: 'user', text })

  const reply = (partial: Partial<TsupherReply> & Pick<TsupherReply, 'kind' | 'message'>): TsupherReply => ({
    facts: [],
    options: [],
    chosenIndex: -1,
    simulated: false,
    lane: 'rules',
    intent: session.intent,
    ...partial,
  })

  const planned = async (intent: Intent, message: TsupherReply['message'], lane: 'rules' | 'llm') => {
    const { options, chosenIndex } = await plan(session, intent, deps)
    const found = options.filter((option) => option.status === 'ok')
    const simulated = options.some((option) => option.simulated)
    // Two stations on one line have a published fare, whether or not a route joins them.
    const fares = lookupStationFares(pack, intent.originId, intent.destinationId, intent.fareEligibility)
    const name = (id: string) => pack.landmarks.find((landmark) => landmark.id === id)?.name ?? id
    const trainFare = fares.length > 0 ? describeStationFares(fares, name(intent.originId), name(intent.destinationId)).join(' ') : undefined
    if (found.length === 0) {
      if (trainFare) return reply({ kind: 'answer', message: 'answer', facts: [trainFare], lane, intent })
      return reply({ kind: 'no_route', message: 'noRoute', options, simulated, lane, intent })
    }
    const best = options[Math.max(chosenIndex, 0)]
    return reply({
      kind: 'options',
      message: simulated && message !== 'found' ? 'whatIf' : message,
      facts: [explainSummary(best, pack)],
      trainFare,
      options,
      chosenIndex,
      simulated,
      lane,
      intent,
    })
  }

  // 1. Answer to a clarifying question: fill the gap from this message.
  if (session.pending) {
    const pending = session.pending
    const read = readUtterance(text, pack)
    const one = (groups: string[][]) => {
      const ids = [...new Set(groups.flat())]
      return ids.length === 1 ? ids[0] : undefined
    }
    let originId = pending.originId ?? one(read.originIds)
    let destinationId = pending.destinationId ?? one(read.destinationIds)
    // A bare place is read as a destination; if only the origin was missing, it is the origin.
    if (!originId && pending.destinationId && one(read.destinationIds)) {
      originId = one(read.destinationIds)
      destinationId = pending.destinationId
    }
    if (originId && destinationId) {
      const merged: Avoid = {
        landmarkIds: [...new Set([...pending.avoid.landmarkIds, ...read.avoid.landmarkIds])],
        routeIds: [...new Set([...pending.avoid.routeIds, ...read.avoid.routeIds])],
        modes: [...new Set([...pending.avoid.modes, ...read.avoid.modes])],
        tags: [...new Set([...pending.avoid.tags, ...read.avoid.tags])],
      }
      return planned(
        { originId, destinationId, preference: read.preference ?? pending.preference ?? 'cheapest', avoid: merged },
        'found',
        'rules',
      )
    }
    // Still incomplete: fall through and read the message as a fresh request.
  }

  // 2. A complete new trip always wins, even mid-conversation. Rules only, so it is instant.
  const byRules = parseWithRules(text, pack)
  if (byRules.status === 'ok' && byRules.intent) return planned(byRules.intent, 'found', 'rules')

  // 3. A follow-up on the current trip. Rules first; the model only if rules found nothing.
  const followUp = async (intent: Intent): Promise<TsupherReply | null> => {
    const { delta, lane } = await mapFollowup(text, pack, intent, deps.llm)
    if (delta?.reset) {
      Object.assign(session, createSession(), { turns: session.turns })
      return reply({ kind: 'reset', message: 'reset', intent: null })
    }
    if (delta && changesRoute(delta)) return planned(applyDelta(intent, delta), 'refined', lane)
    if (delta?.ask) {
      const result = current(session)
      if (result) {
        return reply({
          kind: 'answer',
          message: 'answer',
          facts: answer(delta.ask, result, pack),
          simulated: result.simulated,
          lane,
        })
      }
    }
    return null
  }
  if (session.intent) {
    const handled = await followUp(session.intent)
    if (handled) return handled
  }

  // Not a follow-up: let the model try to read it as a trip (when a model is loaded).
  const parsed = deps.llm ? await parse(text, pack, { llm: deps.llm }) : byRules
  if (parsed.status === 'ok' && parsed.intent) return planned(parsed.intent, 'found', parsed.lane)

  // 4. An incomplete request: remember what was understood and ask for the rest.
  if (parsed.status === 'needs_clarification') {
    if (parsed.candidates?.length) {
      return reply({ kind: 'clarify', message: 'pickOne', candidates: parsed.candidates, lane: parsed.lane })
    }
    const missing = parsed.missing ?? []
    session.pending = {
      originId: parsed.partial?.originId,
      destinationId: parsed.partial?.destinationId,
      preference: parsed.partial?.preference,
      avoid: parsed.partial?.avoid ?? { landmarkIds: [], routeIds: [], modes: [], tags: [] },
      missing,
    }
    const message =
      missing.length === 2 ? 'askBoth' : missing[0] === 'origin' ? 'askOrigin' : 'askDestination'
    return reply({ kind: 'clarify', message, lane: parsed.lane })
  }

  // 5. Out of scope, or a follow-up with no trip to refer to. Never an invented answer.
  return reply({ kind: 'unsupported', message: 'unsupported', lane: parsed.lane })
}

/** Records Tsupher's side of the exchange so the last N turns stay available. */
export function recordReply(session: Session, text: string) {
  remember(session, { from: 'tsupher', text })
}
