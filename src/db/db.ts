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
  status: string
  createdAt: number
  payload?: unknown
}

export type ParaDB = Dexie & {
  routePacks: EntityTable<RoutePackRow, 'id'>
  routes: EntityTable<RouteRow, 'id'>
  landmarks: EntityTable<LandmarkRow, 'id'>
  terminals: EntityTable<Terminal, 'id'>
  fares: EntityTable<FareRow, 'id'>
  contributions: EntityTable<Contribution, 'id'>
}

export const db = new Dexie('ParaDB') as ParaDB

// Schema from CLAUDE.md section 7.3.
db.version(1).stores({
  routePacks: 'id, corridor, version',
  routes: '++id, packId, mode, name',
  landmarks: '++id, packId, name, lat, lon',
  terminals: '++id, packId, name',
  fares: '++id, mode, effectiveDate',
  contributions: '++id, type, status, createdAt',
})
