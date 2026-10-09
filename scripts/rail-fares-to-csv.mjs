// Usage: node scripts/rail-fares-to-csv.mjs [outDir]
// Converts the transcribed LRT-1, LRT-2 and MRT-3 fare matrices into pack CSVs
// (default data/metro-manila/rail-pack). Fares only: no routes, so the app is unchanged.
// Station coordinates come from rail-station-coordinates.csv (OpenStreetMap, ODbL).
// Null matrix cells are skipped; the reverse direction is never inferred.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PACK_HEADERS } from '../src/pack/packFromCsv.ts'
import { parseCsv } from '../src/pack/csv.ts'
import { isInsideNcr, readNcrBoundary } from '../src/pack/ncrGeometry.ts'

const DIR = 'data/metro-manila'
const out = resolve(process.argv[2] ?? join(DIR, 'rail-pack'))
const LINES = ['lrt1', 'lrt2', 'mrt3']
const CAPTURED = '2026-10-10'
// Other names the same station carries in the OpenStreetMap data (captured 2026-10-10).
const OSM_NAMES = { 'lrt1:d_jose': ['Doroteo Jose'], 'lrt1:un_avenue': ['United Nations'] }

const esc = (c) => (/[",\n]/.test(String(c)) ? `"${String(c).replaceAll('"', '""')}"` : String(c))
const csv = (file, rows) => [PACK_HEADERS[file], ...rows.map((r) => PACK_HEADERS[file].map((h) => r[h] ?? ''))].map((r) => r.map(esc).join(',')).join('\n') + '\n'

const coords = new Map(parseCsv(readFileSync(join(DIR, 'rail-station-coordinates.csv'), 'utf8')).records.map((r) => [`${r.values.line}:${r.values.station_id}`, r.values]))

// Stations outside NCR (LRT-2 Antipolo is in Rizal) are left out, with their fares.
const boundary = readNcrBoundary(JSON.parse(readFileSync(join(DIR, 'pack/ncr_boundary.geojson'), 'utf8')))
if (!boundary) throw new Error('pack/ncr_boundary.geojson is not a readable NCR boundary; run scripts/build-map-data.mjs')

const rows = { landmarks: [], fares: [], fare_matrix: [], fare_promotions: [] }
const stats = []
for (const line of LINES) {
  const data = JSON.parse(readFileSync(join(DIR, `${line}-fare-matrices.json`), 'utf8'))
  const lid = (id) => `rail-${line}-${id}`
  const outside = new Set()
  for (const s of data.stationOrder) {
    const c = coords.get(`${line}:${s.id}`)
    if (!c) throw new Error(`no coordinates for ${line}:${s.id}`)
    if (!isInsideNcr([Number(c.lon), Number(c.lat)], boundary)) { outside.add(s.id); continue }
    // Riders type "North Avenue", the source says "North Ave.": add the spelled-out name as an alias.
    const spelled = s.name.replace(/\bAve\b\.?/g, 'Avenue').replace(/\bBlvd\b\.?/g, 'Boulevard').replace(/\bSt\b\.?/g, 'Street')
    const aliases = [...new Set([spelled, s.name, ...(OSM_NAMES[`${line}:${s.id}`] ?? [])].filter((alias) => alias !== `${s.name} (${data.line})`))].join('|')
    rows.landmarks.push({ id: lid(s.id), name: `${s.name} (${data.line})`, aliases, tags: 'train', lat: c.lat, lon: c.lon, note: `OSM ${c.osm_element}, ODbL` })
  }
  let cells = 0, skipped = 0
  const writeGrid = (fareId, promotionId, grid) => {
    grid.forEach((row, i) => row.forEach((fare, j) => {
      if (i === j || outside.has(data.stationOrder[i].id) || outside.has(data.stationOrder[j].id)) return
      if (fare === null || fare === undefined) { skipped++; return }
      rows.fare_matrix.push({ fare_entry_id: fareId, promotion_id: promotionId, origin_id: lid(data.stationOrder[i].id), destination_id: lid(data.stationOrder[j].id), fare })
      cells++
    }))
  }
  for (const p of data.products) {
    const isPromo = p.vehicleClass.includes('discount')
    // Discounted matrices ride on their scheduled product as a universal promotion.
    if (isPromo) {
      const scheduled = data.products.filter((b) => !b.vehicleClass.includes('discount'))
      // MRT-3 names its promo product differently; with one scheduled matrix there is no ambiguity.
      const base = scheduled.find((b) => b.product === p.product) ?? (scheduled.length === 1 ? scheduled[0] : undefined)
      if (!base) { console.log(`NOTE ${p.id}: no scheduled ${p.product} matrix in ${line}; kept as its own fare entry`) }
      else {
        rows.fare_promotions.push({ fare_entry_id: base.id, id: p.id, label: '50% all-passenger discount', eligibility: 'all', kind: 'matrix', effective_date: p.effectiveDate, expires_at: p.expiresAt ?? '', source_url: p.sourceUrl, source_note: `${p.sourceNote} Status: ${p.status}` })
        writeGrid(base.id, p.id, p.fares)
        continue
      }
    }
    // MRT-3 regular matrix states no date: use the capture date and say so.
    const dateNote = p.effectiveDate ? '' : ` Effective date not stated on the source; capture date ${CAPTURED} used.`
    rows.fares.push({ id: p.id, mode: 'train', product: p.product, vehicle_class: p.vehicleClass, rule: 'matrix', effective_date: p.effectiveDate ?? CAPTURED, expires_at: p.expiresAt ?? '', source_note: `${p.sourceNote}${dateNote}`, source_url: p.sourceUrl, conflict_note: p.status })
    writeGrid(p.id, '', p.fares)
  }
  if (outside.size) console.log(`${data.line}: left out ${[...outside].join(', ')} (outside the NCR boundary)`)
  stats.push(`${data.line}: ${data.stationOrder.length - outside.size} stations, ${data.products.length} products, ${cells} fares written, ${skipped} blank cells skipped`)
}

mkdirSync(out, { recursive: true })
for (const f of Object.keys(PACK_HEADERS)) writeFileSync(join(out, `${f}.csv`), csv(f, rows[f] ?? []))
console.log(stats.join('\n'))
console.log(`Wrote ${out}`)
