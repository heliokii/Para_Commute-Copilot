import { ACTIVE_PACK } from './activePack.ts'
import { db } from './db.ts'

export const SAMPLE_LABEL = 'SAMPLE DATA, not verified'
export const ACTIVE_PACK_ID = ACTIVE_PACK.id

// Loads the active pack into Dexie. That is the synthetic pack (no real route,
// terminal or fare) until "npm run import:ncr" produces a validated real one.
async function ensureSeed() {
  const existing = await db.routePacks.get(ACTIVE_PACK.id)
  if (existing?.version === ACTIVE_PACK.version) return

  const { landmarks, routes, fares, ...packRow } = ACTIVE_PACK
  const packId = packRow.id
  await db.transaction('rw', db.routePacks, db.routes, db.landmarks, db.terminals, db.fares, async () => {
    await Promise.all([
      db.routePacks.delete(packId),
      db.routes.where('packId').equals(packId).delete(),
      db.landmarks.where('packId').equals(packId).delete(),
      db.terminals.where('packId').equals(packId).delete(),
      db.fares.filter((fare) => fare.packId === packId).delete(),
    ])
    await db.routePacks.put(packRow)
    await db.landmarks.bulkPut(landmarks.map((landmark) => ({ ...landmark, packId })))
    await db.routes.bulkPut(routes.map((route) => ({ ...route, packId })))
    await db.fares.bulkPut(fares.map((fare) => ({ ...fare, packId })))
  })
}

/** Resolves once the local database holds the current active pack. */
export const seedReady: Promise<void> = ensureSeed().catch((error) => {
  console.error('ParaDB seed failed', error)
})
