import Dexie, { type EntityTable } from 'dexie'
import type { FareEntry, Landmark, Route } from '../router/types.ts'

export interface RoutePackRow {
  id: string
  corridor: string
  version: string
  note?: string
}

// Router shapes plus the pack they belong to. Rows carry their own string ids.
export type RouteRow = Route & { packId: string }
export type LandmarkRow = Landmark & { packId: string }
export type FareRow = FareEntry & { packId: string }

export interface Terminal {
  id: number
  packId: string
  name: string
}

export interface Contribution {
  id: number
  type: string
  /** queued: saved here; exported: a file was made (not that anyone received it); imported: came from a team file. */
  status: string
  createdAt: number
  payload?: unknown
}

/** A saved route or place. Keyed by a string built from its content, so saving twice is one row. */
export interface Favorite {
  id: string
  kind: 'route' | 'place'
  payload: unknown
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export type ParaDB = Dexie & {
  routePacks: EntityTable<RoutePackRow, 'id'>
  routes: EntityTable<RouteRow, 'id'>
  landmarks: EntityTable<LandmarkRow, 'id'>
  terminals: EntityTable<Terminal, 'id'>
  fares: EntityTable<FareRow, 'id'>
  contributions: EntityTable<Contribution, 'id'>
  favorites: EntityTable<Favorite, 'id'>
  settings: EntityTable<Setting, 'key'>
}

export const db = new Dexie('ParaDB') as ParaDB

// Schema from CLAUDE.md section 7.3.
export const SCHEMA_V1 = {
  routePacks: 'id, corridor, version',
  routes: '++id, packId, mode, name',
  landmarks: '++id, packId, name, lat, lon',
  terminals: '++id, packId, name',
  fares: '++id, mode, effectiveDate',
  contributions: '++id, type, status, createdAt',
}
db.version(1).stores(SCHEMA_V1)

// Version 2 (Phase 9) only adds tables, so no upgrade function is needed and every
// v1 row stays as it was. scripts/migrate-check.mjs proves it on a populated v1 database.
db.version(2).stores({
  ...SCHEMA_V1,
  favorites: 'id, kind, createdAt',
  settings: 'key',
})
