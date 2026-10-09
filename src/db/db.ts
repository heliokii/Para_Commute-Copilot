import Dexie, { type EntityTable } from 'dexie'
import { seedSampleData } from './seed'

export interface RoutePack {
  id: string
  corridor: string
  version: string
  note?: string
}

export interface Route {
  id: number
  packId: string
  mode: string
  name: string
  note?: string
}

export interface Landmark {
  id: number
  packId: string
  name: string
  lat: number
  lon: number
}

export interface Terminal {
  id: number
  packId: string
  name: string
}

export interface Fare {
  id: number
  mode: string
  /** ISO date (YYYY-MM-DD) the fare took effect. Shown as "as of". */
  effectiveDate: string
  baseFare: number
  baseKm: number
  perKm: number
  currency: string
  source?: string
  note?: string
}

export interface Contribution {
  id: number
  type: string
  status: string
  createdAt: number
  payload?: unknown
}

export type ParaDB = Dexie & {
  routePacks: EntityTable<RoutePack, 'id'>
  routes: EntityTable<Route, 'id'>
  landmarks: EntityTable<Landmark, 'id'>
  terminals: EntityTable<Terminal, 'id'>
  fares: EntityTable<Fare, 'id'>
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

// Runs once, when the database is first created.
db.on('populate', (tx) => seedSampleData(tx))
