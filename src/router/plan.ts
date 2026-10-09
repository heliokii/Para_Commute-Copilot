import { DEFAULT_ROUTER_CONFIG } from './config.ts'
import { buildGraph, type Edge } from './graph.ts'
import { MinHeap } from './heap.ts'
import type {
  Avoid,
  Intent,
  Leg,
  Mode,
  NoRouteReason,
  Preference,
  RoutePack,
  RouteResult,
  RouterConfig,
} from './types.ts'
import { WALK_ROUTE_ID } from './types.ts'

const PREFERENCES: Preference[] = ['cheapest', 'fastest', 'fewest_transfers']

interface Label {
  landmarkId: string
  lastRouteId: string
  hasRidden: boolean
  fareCentavos: number
  minutes: number
  transfers: number
  cost: [number, number, number]
  /** Insertion order: the final, deterministic tie-breaker. */
  seq: number
  prev: Label | null
  edge: Edge | null
}

function costOf(
  preference: Preference,
  fareCentavos: number,
  minutes: number,
  transfers: number,
  config: RouterConfig,
): [number, number, number] {
  switch (preference) {
    case 'fastest':
      return [minutes + transfers * config.transferPenaltyMin, fareCentavos, transfers]
    case 'fewest_transfers':
      return [transfers, minutes, fareCentavos]
    case 'cheapest':
    default:
      return [fareCentavos, minutes, transfers]
  }
}

function lessLabel(a: Label, b: Label) {
  for (let i = 0; i < 3; i++) {
    if (a.cost[i] !== b.cost[i]) return a.cost[i] < b.cost[i]
  }
  return a.seq < b.seq
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function normalizeAvoid(avoid: Partial<Avoid> | undefined): Avoid {
  return {
    landmarkIds: stringList(avoid?.landmarkIds),
    routeIds: stringList(avoid?.routeIds),
    modes: stringList(avoid?.modes) as Mode[],
    tags: stringList(avoid?.tags),
  }
}

function noRoute(
  reason: NoRouteReason,
  preference: Preference,
  simulated: boolean,
  assumptions: string[] = [],
): RouteResult {
  return {
    status: 'no_route',
    reason,
    preference,
    legs: [],
    totalFare: 0,
    totalMinutes: 0,
    transfers: 0,
    fareAsOf: null,
    assumptions,
    simulated,
    usedUnverifiedData: false,
  }
}

/**
 * Deterministic route search. Dijkstra over (landmark, last route, has ridden)
 * with a lexicographic cost chosen by preference. Never throws on user input.
 */
export function planRoute(
  pack: RoutePack,
  intent: Intent,
  config: RouterConfig = DEFAULT_ROUTER_CONFIG,
): RouteResult {
  const preference = PREFERENCES.includes(intent?.preference) ? intent.preference : 'cheapest'
  const avoid = normalizeAvoid(intent?.avoid)
  const simulated =
    avoid.landmarkIds.length + avoid.routeIds.length + avoid.modes.length + avoid.tags.length > 0

  const landmarkIds = new Set((pack?.landmarks ?? []).map((landmark) => landmark.id))
  if (!landmarkIds.has(intent?.originId)) return noRoute('unknown_origin', preference, simulated)
  if (!landmarkIds.has(intent?.destinationId)) {
    return noRoute('unknown_destination', preference, simulated)
  }
  if (intent.originId === intent.destinationId) {
    return noRoute('same_origin_destination', preference, simulated)
  }

  const graph = buildGraph(pack, avoid, config)
  if (graph.avoidedLandmarks.has(intent.originId)) {
    return noRoute('origin_avoided', preference, simulated, graph.assumptions)
  }
  if (graph.avoidedLandmarks.has(intent.destinationId)) {
    return noRoute('destination_avoided', preference, simulated, graph.assumptions)
  }

  let seq = 0
  const heap = new MinHeap<Label>(lessLabel)
  const settled = new Set<string>()
  heap.push({
    landmarkId: intent.originId,
    lastRouteId: '',
    hasRidden: false,
    fareCentavos: 0,
    minutes: 0,
    transfers: 0,
    cost: [0, 0, 0],
    seq: seq++,
    prev: null,
    edge: null,
  })

  let goal: Label | null = null
  while (heap.size > 0) {
    const label = heap.pop()!
    const key = `${label.landmarkId}|${label.lastRouteId}|${label.hasRidden ? 1 : 0}`
    if (settled.has(key)) continue
    settled.add(key)

    if (label.landmarkId === intent.destinationId) {
      goal = label
      break
    }

    for (const edge of graph.edgesFrom.get(label.landmarkId) ?? []) {
      // No back-to-back legs on one route (blocks fare splitting) and no walk after a walk.
      if (edge.routeId === label.lastRouteId) continue
      const isRide = edge.routeId !== WALK_ROUTE_ID
      const hasRidden = label.hasRidden || isRide
      if (settled.has(`${edge.alightId}|${edge.routeId}|${hasRidden ? 1 : 0}`)) continue

      const fareCentavos = label.fareCentavos + edge.fareCentavos
      const minutes = label.minutes + edge.minutes
      const transfers = label.transfers + (isRide && label.hasRidden ? 1 : 0)
      heap.push({
        landmarkId: edge.alightId,
        lastRouteId: edge.routeId,
        hasRidden,
        fareCentavos,
        minutes,
        transfers,
        cost: costOf(preference, fareCentavos, minutes, transfers, config),
        seq: seq++,
        prev: label,
        edge,
      })
    }
  }

  if (!goal) return noRoute('no_path', preference, simulated, graph.assumptions)

  const edges: Edge[] = []
  for (let label: Label | null = goal; label?.edge; label = label.prev) edges.unshift(label.edge)

  const legs: Leg[] = edges.map((edge) => ({
    routeId: edge.routeId,
    mode: edge.mode,
    boardId: edge.boardId,
    alightId: edge.alightId,
    distKm: edge.distKm,
    minutes: edge.minutes,
    fare: edge.fareCentavos / 100,
  }))

  const fareDates = [...new Set(edges.flatMap((edge) => edge.fareEntry?.effectiveDate ?? []))].sort()
  const assumptions = [
    ...graph.assumptions,
    'Waiting time is not modeled. Minutes are ride and walk time only.',
  ]
  if (preference === 'fastest' && goal.transfers > 0) {
    assumptions.push(
      `Ranking added ${config.transferPenaltyMin} min per transfer. It is not included in totalMinutes.`,
    )
  }
  if (edges.some((edge) => edge.routeId === WALK_ROUTE_ID)) {
    assumptions.push(
      `Walking legs use straight-line distance at ${config.walkSpeedKmh} km/h, up to ${config.walkMaxMeters} m.`,
    )
  }
  if (fareDates.length > 1) {
    assumptions.push('Legs use fare tables with different effective dates. The oldest is shown.')
  }

  return {
    status: 'ok',
    preference,
    legs,
    totalFare: goal.fareCentavos / 100,
    totalMinutes: goal.minutes,
    transfers: goal.transfers,
    fareAsOf: fareDates[0] ?? null,
    assumptions,
    simulated,
    usedUnverifiedData: edges.some((edge) => !edge.verified),
  }
}

const legSequenceKey = (result: RouteResult) =>
  result.legs.map((leg) => `${leg.routeId}:${leg.boardId}>${leg.alightId}`).join('|')

/**
 * Cheapest, fastest and fewest-transfers results, de-duplicated by leg sequence.
 * A duplicate keeps the label of the first preference that produced it.
 */
export function planOptions(
  pack: RoutePack,
  baseIntent: Intent,
  config: RouterConfig = DEFAULT_ROUTER_CONFIG,
): RouteResult[] {
  const results = PREFERENCES.map((preference) =>
    planRoute(pack, { ...baseIntent, preference }, config),
  )
  const found = results.filter((result) => result.status === 'ok')
  if (found.length === 0) return [results[0]]

  const seen = new Set<string>()
  return found.filter((result) => {
    const key = legSequenceKey(result)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
