import type { Transaction } from 'dexie'

export const SAMPLE_LABEL = 'SAMPLE DATA, not verified'
export const SAMPLE_PACK_ID = 'sample-pack'

// Placeholder rows so the schema can be exercised offline. Nothing here is a
// real route, terminal or fare. Replace with the ride-verified pack (build step 2).
export function seedSampleData(tx: Transaction) {
  tx.table('routePacks').add({
    id: SAMPLE_PACK_ID,
    corridor: 'SAMPLE corridor',
    version: '0.0.0-sample',
    note: SAMPLE_LABEL,
  })

  tx.table('routes').bulkAdd([
    {
      packId: SAMPLE_PACK_ID,
      mode: 'sample',
      name: 'SAMPLE Route A (Point A to Point B)',
      note: SAMPLE_LABEL,
    },
    {
      packId: SAMPLE_PACK_ID,
      mode: 'sample',
      name: 'SAMPLE Route B (Point B to Point C)',
      note: SAMPLE_LABEL,
    },
  ])

  tx.table('fares').add({
    mode: 'sample',
    effectiveDate: '2026-01-01',
    baseFare: 1,
    baseKm: 1,
    perKm: 1,
    currency: 'PHP',
    source: 'none (placeholder values)',
    note: SAMPLE_LABEL,
  })
}
