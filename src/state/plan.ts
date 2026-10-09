import { useSyncExternalStore } from 'react'
import { ACTIVE_PACK_ID } from '../db/seed.ts'
import { OVERLAY_PATHS } from '../lib/nav'
import { initRouter, planOptions, planRoute } from '../router/client.ts'
import { orderOptions } from '../router/order.ts'
import type { Intent, Preference, RoutePack, RouteResult, Weights } from '../router/types.ts'
import { recordRecent } from './recents'

// The plan session: what the rider asked for and the last result. In memory
// only, shared by the Ruta and Mapa tabs. Nothing here is written to disk.

export const AVOID_EDSA_TAG = 'EDSA'

export type StandardPreference = Exclude<Preference, 'custom'>

export interface PlanState {
  pack: RoutePack | null
  packError: boolean
  originId: string
  destinationId: string
  preference: StandardPreference
  avoidEdsa: boolean
  customEnabled: boolean
  weights: Weights
  status: 'idle' | 'searching' | 'done' | 'error'
  /** Results of the last search, the rider's chosen preference first. */
  options: RouteResult[]
  /** Index into options that matches the chosen preference, or -1. */
  chosenIndex: number
  selectedIndex: number
  /** The intent behind `options`, so screens can show what was asked. */
  searched: Intent | null
  /** Where the detail screen's back button goes: the results list or the chat. */
  detailBack: string
}

let state: PlanState = {
  pack: null,
  packError: false,
  originId: '',
  destinationId: '',
  preference: 'cheapest',
  avoidEdsa: false,
  customEnabled: false,
  weights: { fare: 5, minutes: 5, transfers: 5 },
  status: 'idle',
  options: [],
  chosenIndex: -1,
  selectedIndex: 0,
  searched: null,
  detailBack: OVERLAY_PATHS.results,
}

const listeners = new Set<() => void>()

export function setPlan(patch: Partial<PlanState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

export const getPlan = () => state

export function usePlan(): PlanState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

let packLoading: Promise<void> | null = null

/** Loads the route pack from Dexie into the router worker. Safe to call often. */
export function ensurePack(): Promise<void> {
  packLoading ??= initRouter(ACTIVE_PACK_ID)
    .then((pack) => setPlan({ pack, packError: false }))
    .catch((error) => {
      console.error('Route pack failed to load', error)
      packLoading = null
      setPlan({ packError: true })
    })
  return packLoading
}

export function currentIntent(from: PlanState = state): Intent {
  return {
    originId: from.originId,
    destinationId: from.destinationId,
    preference: from.customEnabled ? 'custom' : from.preference,
    avoid: {
      landmarkIds: [],
      routeIds: [],
      modes: [],
      tags: from.avoidEdsa ? [AVOID_EDSA_TAG] : [],
    },
    ...(from.customEnabled ? { weights: from.weights } : {}),
  }
}

/** Runs the router for the form values, or for a given trip. Every number comes from the router. */
export async function searchRoutes(override?: Intent): Promise<void> {
  const intent = override ?? currentIntent()
  setPlan({ status: 'searching' })
  try {
    await ensurePack()
    const [options, chosen] = await Promise.all([planOptions(intent), planRoute(intent)])
    // Show the option that answers the rider's own preference first.
    const ordered = orderOptions(options, chosen)
    setPlan({
      status: 'done',
      options: ordered.options,
      chosenIndex: ordered.chosenIndex,
      selectedIndex: 0,
      searched: intent,
      detailBack: OVERLAY_PATHS.results,
    })
    if (ordered.options.some((option) => option.status === 'ok')) recordRecent(intent)
  } catch (error) {
    console.error('Route search failed', error)
    setPlan({ status: 'error', options: [], chosenIndex: -1, searched: intent })
  }
}

/** Fills the plan form from a saved or recent trip and runs the router again. */
export async function openIntent(intent: Intent): Promise<void> {
  setPlan({
    originId: intent.originId,
    destinationId: intent.destinationId,
    avoidEdsa: intent.avoid.tags.includes(AVOID_EDSA_TAG),
    ...(intent.preference === 'custom'
      ? { customEnabled: true, weights: intent.weights ?? state.weights }
      : { customEnabled: false, preference: intent.preference }),
  })
  await searchRoutes(intent)
}

/** Forgets the form and the last result. The loaded route pack stays. */
export function resetPlan() {
  setPlan({
    originId: '',
    destinationId: '',
    preference: 'cheapest',
    avoidEdsa: false,
    customEnabled: false,
    weights: { fare: 5, minutes: 5, transfers: 5 },
    status: 'idle',
    options: [],
    chosenIndex: -1,
    selectedIndex: 0,
    searched: null,
    detailBack: OVERLAY_PATHS.results,
  })
}

/** The result shown on the detail and map screens. */
export function selectedResult(from: PlanState = state): RouteResult | null {
  const result = from.options[from.selectedIndex]
  return result?.status === 'ok' ? result : null
}

export function landmarkName(pack: RoutePack | null, id: string): string {
  return pack?.landmarks.find((landmark) => landmark.id === id)?.name ?? id
}

export function routeName(pack: RoutePack | null, id: string): string {
  return pack?.routes.find((route) => route.id === id)?.name ?? id
}
