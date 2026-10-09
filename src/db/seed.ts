import { SYNTHETIC_PACK } from '../router/__fixtures__/synthetic-pack.ts'
import { db } from './db.ts'

export const SAMPLE_LABEL = 'SAMPLE DATA, not verified'
export const ACTIVE_PACK_ID = SYNTHETIC_PACK.id

// Loads the synthetic pack so the router can be exercised offline. Nothing in it
// is a real route, terminal or fare. Replace with the ride-verified pack later.
async function ensureSeed() {
  const existing = await db.routePacks.get(SYNTHETIC_PACK.id)
  if (existing?.version === SYNTHETIC_PACK.version) return

  const { landmarks, routes, fares, ...packRow } = SYNTHETIC_PACK
  const packId = packRow.id
  await db.transaction('rw', db.routePacks, db.routes, db.landmarks, db.fares, async () => {
    // Only sample rows have ever lived in these tables, so a full replace is safe.
    await Promise.all([
      db.routePacks.clear(),
      db.routes.clear(),
      db.landmarks.clear(),
      db.fares.clear(),
    ])
    await db.routePacks.put(packRow)
    await db.landmarks.bulkPut(landmarks.map((landmark) => ({ ...landmark, packId })))
    await db.routes.bulkPut(routes.map((route) => ({ ...route, packId })))
    await db.fares.bulkPut(fares.map((fare) => ({ ...fare, packId })))
  })
}

/** Resolves once the local database holds the current sample pack. */
export const seedReady: Promise<void> = ensureSeed().catch((error) => {
  console.error('ParaDB seed failed', error)
})
