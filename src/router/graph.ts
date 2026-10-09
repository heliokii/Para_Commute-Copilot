import { fareForLeg } from './fare.ts'
import { haversineKm } from './geo.ts'
import type { Avoid, FareEligibility, FareEntry, Mode, Route, RoutePack, RouterConfig } from './types.ts'
import { WALK_ROUTE_ID } from './types.ts'

export interface Edge {
  routeId: string
  mode: Mode
  boardId: string
  alightId: string
  distKm: number
  minutes: number
  fareCentavos: number
  /** undefined for walking edges. */
  fareEntry?: FareEntry
  fareEffectiveDate?: string
  verified: boolean
}

export interface Graph {
  /** Outgoing edges per landmark id, in a stable order. */
  edgesFrom: Map<string, Edge[]>
  avoidedLandmarks: Set<string>
  assumptions: string[]
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

const round3 = (value: number) => Math.round(value * 1000) / 1000

function intersects(values: readonly string[] | undefined, avoided: Set<string>) {
  return (values ?? []).some((value) => avoided.has(value))
}

function routeIsUsable(route: Route) {
  return Array.isArray(route.stops) && route.stops.length >= 2
}

/** Applies the avoid-list, then builds every candidate leg and walking edge. */
export function buildGraph(pack: RoutePack, avoid: Avoid, config: RouterConfig, fareEligibility: FareEligibility = 'adult'): Graph {
  const avoidRoutes = new Set(avoid.routeIds)
  const avoidModes = new Set<string>(avoid.modes)
  const avoidTags = new Set(avoid.tags)
  const avoidedLandmarks = new Set(avoid.landmarkIds)
  const assumptions: string[] = []

  const landmarks = [...pack.landmarks].sort(byId)
  for (const landmark of landmarks) {
    if (intersects(landmark.tags, avoidTags)) avoidedLandmarks.add(landmark.id)
  }
  const known = new Set(landmarks.map((landmark) => landmark.id))
  const fares = new Map(pack.fares.map((fare) => [fare.id, fare]))

  const edgesFrom = new Map<string, Edge[]>()
  const addEdge = (edge: Edge) => {
    const list = edgesFrom.get(edge.boardId)
    if (list) list.push(edge)
    else edgesFrom.set(edge.boardId, [edge])
  }

  for (const route of [...pack.routes].sort(byId)) {
    if (avoidRoutes.has(route.id) || avoidModes.has(route.mode)) continue
    if (intersects(route.tags, avoidTags)) continue
    if (!routeIsUsable(route)) continue

    const fareEntry = fares.get(route.fareTableId)
    if (!fareEntry) {
      assumptions.push(`Route ${route.id} skipped: fare table "${route.fareTableId}" is missing.`)
      continue
    }

    const stops = route.stops
    const routeEdges: Edge[] = []
    let fareGap: string | undefined
    for (let board = 0; board < stops.length - 1; board++) {
      const boardId = stops[board].landmarkId
      // Boarding at an unknown or avoided stop is not possible.
      if (!known.has(boardId) || avoidedLandmarks.has(boardId)) continue

      let distKm = 0
      let minutes = 0
      for (let alight = board + 1; alight < stops.length; alight++) {
        const stop = stops[alight]
        // Riding through an avoided stop counts as using it, so stop extending.
        if (!known.has(stop.landmarkId) || avoidedLandmarks.has(stop.landmarkId)) break
        distKm += stop.distKmFromPrev
        minutes += stop.minFromPrev
        if (stop.landmarkId === boardId) continue
        const legDist = round3(distKm)
        const calculation = fareForLeg(boardId, stop.landmarkId, legDist, fareEntry, undefined, fareEligibility)
        if (!calculation) {
          fareGap = `${boardId} to ${stop.landmarkId}`
          break
        }
        routeEdges.push({
          routeId: route.id,
          mode: route.mode,
          boardId,
          alightId: stop.landmarkId,
          distKm: legDist,
          minutes: round3(minutes),
          fareCentavos: calculation.centavos,
          fareEffectiveDate: calculation.effectiveDate,
          fareEntry,
          verified: route.verified === true,
        })
      }
      if (fareGap) break
    }
    if (fareGap) {
      assumptions.push(`Route ${route.id} skipped: fare table "${fareEntry.id}" has no current fare for ${fareGap}.`)
      continue
    }
    for (const edge of routeEdges) addEdge(edge)
  }

  if (!avoidModes.has('walk') && config.walkMaxMeters > 0 && config.walkSpeedKmh > 0) {
    const maxKm = config.walkMaxMeters / 1000
    for (const from of landmarks) {
      if (avoidedLandmarks.has(from.id)) continue
      for (const to of landmarks) {
        if (to.id === from.id || avoidedLandmarks.has(to.id)) continue
        const distKm = haversineKm(from.lat, from.lon, to.lat, to.lon)
        if (!(distKm <= maxKm)) continue
        addEdge({
          routeId: WALK_ROUTE_ID,
          mode: 'walk',
          boardId: from.id,
          alightId: to.id,
          distKm: round3(distKm),
          // Whole minutes, rounded up.
          minutes: Math.ceil((distKm / config.walkSpeedKmh) * 60),
          fareCentavos: 0,
          verified: true,
        })
      }
    }
  }

  return { edgesFrom, avoidedLandmarks, assumptions }
}
