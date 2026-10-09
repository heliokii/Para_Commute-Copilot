import { copy } from '../copy'
import { db, type Favorite } from '../db/db.ts'
import { useLive } from '../lib/useLive.ts'
import type { Avoid, Intent, Preference, RoutePack, Weights } from '../router/types.ts'
import { showToast } from './toast'

// Saved routes and places. A saved route is the question (origin, destination,
// preference, avoid-list), not its answer: opening it runs the router again, so
// the fare and time are never stale copies.

export interface RouteFavorite {
  intent: Intent
  packId: string
  packVersion: string
}

export interface PlaceFavorite {
  landmarkId: string
  packId: string
}

const sortedList = (list: readonly string[]) => [...list].sort().join(',')

/** Same trip, preference and avoid-list give the same id, so saving twice is one row. */
export function routeFavoriteId(intent: Intent): string {
  const { landmarkIds, routeIds, modes, tags } = intent.avoid
  const weights = intent.preference === 'custom' && intent.weights ? `:${Object.values(intent.weights).join('/')}` : ''
  return `route:${intent.originId}>${intent.destinationId}:${intent.preference}${weights}:${sortedList(landmarkIds)}|${sortedList(routeIds)}|${sortedList(modes)}|${sortedList(tags)}`
}

export const placeFavoriteId = (landmarkId: string) => `place:${landmarkId}`

const PREFERENCES: Preference[] = ['cheapest', 'fastest', 'fewest_transfers', 'custom']
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')

function asAvoid(value: unknown): Avoid | null {
  const avoid = value as Partial<Avoid> | null
  if (!avoid || !isStrings(avoid.landmarkIds) || !isStrings(avoid.routeIds) || !isStrings(avoid.modes) || !isStrings(avoid.tags)) return null
  return avoid as Avoid
}

/** A stored route favorite, or null if the row is not shaped like one. */
export function asRouteFavorite(payload: unknown): RouteFavorite | null {
  const value = payload as Partial<RouteFavorite> | null
  const intent = value?.intent as Partial<Intent> | undefined
  const avoid = asAvoid(intent?.avoid)
  if (!intent || !avoid || typeof intent.originId !== 'string' || typeof intent.destinationId !== 'string') return null
  if (!PREFERENCES.includes(intent.preference as Preference)) return null
  if (typeof value?.packId !== 'string' || typeof value.packVersion !== 'string') return null
  return {
    intent: { originId: intent.originId, destinationId: intent.destinationId, preference: intent.preference as Preference, avoid, ...(intent.weights ? { weights: intent.weights as Weights } : {}) },
    packId: value.packId,
    packVersion: value.packVersion,
  }
}

export function asPlaceFavorite(payload: unknown): PlaceFavorite | null {
  const value = payload as Partial<PlaceFavorite> | null
  return typeof value?.landmarkId === 'string' && typeof value.packId === 'string' ? { landmarkId: value.landmarkId, packId: value.packId } : null
}

const allFavorites = () => db.favorites.orderBy('createdAt').reverse().toArray()

/** Newest first. Updates by itself when a favorite is saved or removed. */
export function useFavorites(): Favorite[] {
  return useLive(allFavorites, [])
}

/** Saves the route if it is not saved, removes it if it is. Returns true when it is saved afterwards. */
export async function toggleRouteFavorite(intent: Intent, packId: string, packVersion: string): Promise<boolean> {
  const id = routeFavoriteId(intent)
  if (await db.favorites.get(id)) {
    await db.favorites.delete(id)
    return false
  }
  const payload: RouteFavorite = { intent, packId, packVersion }
  await db.favorites.put({ id, kind: 'route', payload, createdAt: Date.now() })
  return true
}

export async function togglePlaceFavorite(landmarkId: string, packId: string): Promise<boolean> {
  const id = placeFavoriteId(landmarkId)
  if (await db.favorites.get(id)) {
    await db.favorites.delete(id)
    return false
  }
  const payload: PlaceFavorite = { landmarkId, packId }
  await db.favorites.put({ id, kind: 'place', payload, createdAt: Date.now() })
  return true
}

/** Saves or removes a route and says so in a toast (the Love sprite on save). */
export async function toggleRoute(intent: Intent, pack: RoutePack | null): Promise<void> {
  if (!pack) return
  try {
    const saved = await toggleRouteFavorite(intent, pack.id, pack.version)
    showToast(saved ? copy.fav.saved : copy.fav.removed, saved ? 'love' : null)
  } catch (error) {
    console.error('Favorite not saved', error)
    showToast(copy.fav.error)
  }
}
