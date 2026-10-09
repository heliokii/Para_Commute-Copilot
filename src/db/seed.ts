import { SYNTHETIC_PACK } from '../router/__fixtures__/synthetic-pack.ts'
import { ACTIVE_PACK } from './activePack.ts'
import { db } from './db.ts'

export const SAMPLE_LABEL = 'SAMPLE DATA, not verified'
export const ACTIVE_PACK_ID = ACTIVE_PACK.id

// Loads the active pack into Dexie: the real Metro Manila pack once "npm run import:ncr"
// has produced a validated one, otherwise the synthetic sample pack.
async function ensureSeed() {
  const existing = await db.routePacks.get(ACTIVE_PACK.id)
  if (existing?.version === ACTIVE_PACK.version) return

  const { landmarks, routes, fares, ...packRow } = ACTIVE_PACK
  const packId = packRow.id
  await db.transaction('rw', db.routePacks, db.routes, db.landmarks, db.terminals, db.fares, async () => {
    // An install that ran the sample pack before the real one existed: drop the sample rows.
    if (packId !== SYNTHETIC_PACK.id) {
      const sampleId = SYNTHETIC_PACK.id
      await Promise.all([
        db.routePacks.delete(sampleId),
        db.routes.where('packId').equals(sampleId).delete(),
        db.landmarks.where('packId').equals(sampleId).delete(),
        db.terminals.where('packId').equals(sampleId).delete(),
        db.fares.filter((fare) => fare.packId === sampleId).delete(),
      ])
    }
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
