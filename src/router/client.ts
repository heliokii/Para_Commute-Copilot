import { db } from '../db/db.ts'
import { seedReady } from '../db/seed.ts'
import type { RouterRequest, RouterResponse } from './protocol.ts'
import type { Intent, RoutePack, RouteResult } from './types.ts'

type Outgoing = RouterRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never

let worker: Worker | null = null
let nextId = 1
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (reason: Error) => void }
>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./router.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<RouterResponse>) => {
    const response = event.data
    const waiting = pending.get(response.id)
    if (!waiting) return
    pending.delete(response.id)
    if (response.ok) waiting.resolve(response.result)
    else waiting.reject(new Error(response.error))
  }
  worker.onerror = (event) => {
    for (const waiting of pending.values()) waiting.reject(new Error(event.message))
    pending.clear()
  }
  return worker
}

function call<T>(request: Outgoing): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
    getWorker().postMessage({ ...request, id })
  })
}

/** Reads one route pack from Dexie in the shape the router expects. */
export async function loadPack(packId: string): Promise<RoutePack | null> {
  await seedReady
  const packRow = await db.routePacks.get(packId)
  if (!packRow) return null
  const [landmarks, routes, fares] = await Promise.all([
    db.landmarks.where('packId').equals(packId).toArray(),
    db.routes.where('packId').equals(packId).toArray(),
    db.fares.filter((fare) => fare.packId === packId).toArray(),
  ])
  const strip = <T extends { packId?: string }>(row: T): Omit<T, 'packId'> => {
    const copy = { ...row }
    delete copy.packId
    return copy
  }
  return {
    ...packRow,
    landmarks: landmarks.map(strip),
    routes: routes.map(strip),
    fares: fares.map(strip),
  }
}

/** Loads the pack from Dexie and hands it to the router worker. */
export async function initRouter(packId: string): Promise<RoutePack> {
  const pack = await loadPack(packId)
  if (!pack) throw new Error(`Route pack "${packId}" not found in local database`)
  await call<null>({ type: 'setPack', pack })
  return pack
}

export function planRoute(intent: Intent): Promise<RouteResult> {
  return call<RouteResult>({ type: 'planRoute', intent })
}

export function planOptions(intent: Intent): Promise<RouteResult[]> {
  return call<RouteResult[]>({ type: 'planOptions', intent })
}
