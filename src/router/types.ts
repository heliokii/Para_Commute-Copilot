// Router contract. Phases 4-6 consume these shapes; keep them stable.

export type Mode = 'jeepney' | 'modern_jeepney' | 'uv' | 'bus' | 'train' | 'walk'

export type Preference = 'cheapest' | 'fastest' | 'fewest_transfers' | 'custom'

/**
 * Relative importance for the 'custom' preference. Any non-negative numbers.
 * At equal weights, 1 peso counts the same as 1 minute, and one transfer the
 * same as RouterConfig.customTransferMinutes minutes.
 */
export interface Weights {
  fare: number
  minutes: number
  transfers: number
}

export type RoundingRule = 'nearest_0.25' | 'nearest_1' | 'ceil_1' | 'none'

export interface Landmark {
  id: string
  name: string
  aliases: string[]
  /** Things like road names, e.g. "EDSA". Used by the avoid-list. */
  tags: string[]
  lat: number
  lon: number
}

export interface RouteStop {
  landmarkId: string
  /** 0 for the first stop. */
  distKmFromPrev: number
  /** 0 for the first stop. */
  minFromPrev: number
}

export interface Route {
  id: string
  mode: Mode
  name: string
  tags: string[]
  /** Forward order only. The return direction is a separate route. */
  stops: RouteStop[]
  fareTableId: string
  verified: boolean
  note?: string
}

export interface FareEntry {
  id: string
  mode: Mode
  baseFare: number
  /** Distance covered by baseFare. */
  baseKm: number
  perKm: number
  /** ISO date (YYYY-MM-DD). Shown as "as of". */
  effectiveDate: string
  roundingRule: RoundingRule
  sourceNote: string
}

export interface RoutePack {
  id: string
  corridor: string
  version: string
  note?: string
  landmarks: Landmark[]
  routes: Route[]
  fares: FareEntry[]
}

export interface Avoid {
  landmarkIds: string[]
  routeIds: string[]
  modes: Mode[]
  tags: string[]
}

export interface Intent {
  originId: string
  destinationId: string
  preference: Preference
  avoid: Avoid
  /** Used only when preference is 'custom'. */
  weights?: Weights
}

export interface Leg {
  /** WALK_ROUTE_ID for walking legs. */
  routeId: string
  mode: Mode
  boardId: string
  alightId: string
  distKm: number
  minutes: number
  fare: number
}

export type NoRouteReason =
  | 'unknown_origin'
  | 'unknown_destination'
  | 'same_origin_destination'
  | 'origin_avoided'
  | 'destination_avoided'
  | 'no_path'

export interface RouteResult {
  status: 'ok' | 'no_route'
  reason?: NoRouteReason
  preference: Preference
  legs: Leg[]
  totalFare: number
  /** Ride and walk time only. Waiting time is not modeled. */
  totalMinutes: number
  /** Ride legs minus one. Walking legs do not count. */
  transfers: number
  /** Oldest effectiveDate among the fare entries used. null if no fare was charged. */
  fareAsOf: string | null
  assumptions: string[]
  /** True when any avoid constraint was applied (a user-declared what-if). */
  simulated: boolean
  usedUnverifiedData: boolean
}

export interface RouterConfig {
  /** Max straight-line distance for a walking leg. */
  walkMaxMeters: number
  walkSpeedKmh: number
  /** Added per transfer when ranking 'fastest'. Not included in totalMinutes. */
  transferPenaltyMin: number
  /** What one transfer is worth, in minutes, for the 'custom' preference. */
  customTransferMinutes: number
}

export const WALK_ROUTE_ID = 'walk'
