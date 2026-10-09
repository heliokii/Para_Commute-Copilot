// Usage: node scripts/mock-jeepney-pack.mjs && npm run import:ncr
// Writes data/metro-manila/mock-pack/*.csv: MADE-UP jeepney routes, stops and fares,
// so the route planner, the map and the chat have something to show next to the real
// train fares. None of it is a real route, a real stop or a real fare. Every id starts
// with "mock-", every name ends in "(mock)" or "(MOCK)", routes are verified=false, and
// the app shows a "MOCK DATA" badge on anything that uses them (src/lib/modes.ts isMockRoute).
// Stop coordinates are picked by hand to sit inside Metro Manila; distances are the straight
// line times 1.25 and minutes assume a made-up speed. Routes end at real rail stations so
// they join the map's train network.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { haversineKm } from '../src/router/geo.ts'
import { PACK_HEADERS } from '../src/pack/packFromCsv.ts'

const OUT = 'data/metro-manila/mock-pack'
const MADE_ON = '2026-10-10'
const SOURCE_URL = 'https://github.com/heliokii/AppBuilder2026/blob/main/data/metro-manila/mock-pack/README.md'
const NOTE = 'MOCK DATA: gawa-gawa lang para sa demo. Hindi totoong ruta, hintuan o pamasahe.'

// [id, name, lat, lon]
const STOPS = [
  ['mock-scout', 'Scout Kanto (mock)', 14.639, 121.03],
  ['mock-roces', 'Roces Kanto (mock)', 14.633, 121.0205],
  ['mock-banawe', 'Banawe Kanto (mock)', 14.6268, 121.0115],
  ['mock-rotonda', 'Rotonda Stop (mock)', 14.6177, 121.002],
  ['mock-espana', 'España Gate (mock)', 14.6098, 120.9893],
  ['mock-quiapo', 'Quiapo Paradahan (mock)', 14.5992, 120.9838],
  ['mock-lawton', 'Lawton Stop (mock)', 14.5935, 120.9812],
  ['mock-taft-un', 'Taft Kanto UN (mock)', 14.5822, 120.9848],
  ['mock-taft-quirino', 'Taft Kanto Quirino (mock)', 14.5703, 120.9916],
  ['mock-taft-vito', 'Taft Kanto Vito Cruz (mock)', 14.5635, 120.9948],
  ['mock-osmena', 'Osmeña Kanto (mock)', 14.5553, 121.005],
  ['mock-tamo', 'Pasong Tamo Stop (mock)', 14.5572, 121.0118],
  ['mock-buendia', 'Buendia Kanto (mock)', 14.5606, 121.0165],
  ['mock-paseo', 'Paseo Stop (mock)', 14.5573, 121.0218],
  ['mock-makati-ave', 'Makati Ave Kanto (mock)', 14.5548, 121.0243],
  ['mock-shaw-uno', 'Shaw Kanto Uno (mock)', 14.579, 121.0585],
  ['mock-kapitolyo', 'Kapitolyo Stop (mock)', 14.5745, 121.0635],
  ['mock-pasig-tulay', 'Pasig Tulay (mock)', 14.569, 121.0705],
  ['mock-pasig-palengke', 'Pasig Palengke (mock)', 14.5605, 121.076],
]

// Made-up fare tables. Deliberately not the LTFRB numbers.
const FARES = [
  { id: 'mock-jeepney-fare', mode: 'jeepney', base: 12, baseKm: 4, perKm: 1.5 },
  { id: 'mock-modern-jeepney-fare', mode: 'modern_jeepney', base: 16, baseKm: 4, perKm: 2.25 },
]

// Each line runs both ways; the return trip is its own route, as the router expects.
const LINES = [
  { id: 'mock-j1', name: 'Quezon Ave – Quiapo', mode: 'jeepney', kmh: 13, stops: ['rail-mrt3-quezon_avenue', 'mock-scout', 'mock-roces', 'mock-banawe', 'mock-rotonda', 'mock-espana', 'mock-quiapo', 'rail-lrt1-carriedo'] },
  { id: 'mock-j2', name: 'Quiapo – Gil Puyat', mode: 'jeepney', kmh: 13, stops: ['mock-quiapo', 'mock-lawton', 'mock-taft-un', 'mock-taft-quirino', 'mock-taft-vito', 'rail-lrt1-gil_puyat'] },
  { id: 'mock-j3', name: 'Gil Puyat – Ayala', mode: 'jeepney', kmh: 13, stops: ['rail-lrt1-gil_puyat', 'mock-osmena', 'mock-tamo', 'mock-buendia', 'mock-paseo', 'mock-makati-ave', 'rail-mrt3-ayala'] },
  { id: 'mock-j4', name: 'Shaw – Pasig', mode: 'jeepney', kmh: 13, stops: ['rail-mrt3-shaw_boulevard', 'mock-shaw-uno', 'mock-kapitolyo', 'mock-pasig-tulay', 'mock-pasig-palengke'] },
  { id: 'mock-m1', name: 'Quezon Ave – Gil Puyat Express', mode: 'modern_jeepney', kmh: 21, stops: ['rail-mrt3-quezon_avenue', 'mock-rotonda', 'mock-lawton', 'rail-lrt1-gil_puyat'] },
]

const railRows = readFileSync('data/metro-manila/rail-pack/landmarks.csv', 'utf8').split(/\r?\n/).slice(1).filter(Boolean)
const place = new Map(STOPS.map(([id, , lat, lon]) => [id, { lat, lon }]))
for (const row of railRows) {
  const [id, , , , lat, lon] = row.split(',')
  place.set(id, { lat: Number(lat), lon: Number(lon) })
}

const cell = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value))
const csv = (name, rows) => `${[PACK_HEADERS[name], ...rows].map((row) => row.map(cell).join(',')).join('\n')}\n`

const landmarks = STOPS.map(([id, name, lat, lon]) => [id, name, name.replace(' (mock)', ''), '', lat, lon, NOTE])
const fares = FARES.map((fare) => [fare.id, fare.mode, 'mock-fare', 'standard', 'distance', fare.base, fare.baseKm, fare.perKm, MADE_ON, '', 'nearest_0.25', NOTE, SOURCE_URL, '', ''])
const routes = []
const routeStops = []
for (const line of LINES) {
  const fareId = FARES.find((fare) => fare.mode === line.mode).id
  for (const [suffix, stops] of [['a', line.stops], ['b', line.stops.toReversed()]]) {
    const id = `${line.id}${suffix}`
    const [from, to] = suffix === 'a' ? line.name.split(' – ') : line.name.split(' – ').toReversed()
    routes.push([id, line.mode, `${from} – ${to} (MOCK)`, '', fareId, 'false', '', '', NOTE])
    stops.forEach((stop, index) => {
      const here = place.get(stop)
      const before = place.get(stops[index - 1])
      if (!here) throw new Error(`Unknown stop ${stop}`)
      const km = index === 0 ? 0 : Math.max(0.2, Math.round(haversineKm(before.lat, before.lon, here.lat, here.lon) * 1.25 * 10) / 10)
      const minutes = index === 0 ? 0 : Math.max(1, Math.round((km / line.kmh) * 60))
      routeStops.push([id, index + 1, stop, km, minutes, '', 'made up', MADE_ON, 'mock', index === 0 ? NOTE : ''])
    })
  }
}

mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/landmarks.csv`, csv('landmarks', landmarks))
writeFileSync(`${OUT}/fares.csv`, csv('fares', fares))
writeFileSync(`${OUT}/routes.csv`, csv('routes', routes))
writeFileSync(`${OUT}/route_stops.csv`, csv('route_stops', routeStops))
console.log(`${OUT}: ${landmarks.length} mock stops, ${routes.length} mock routes, ${fares.length} mock fare tables`)
