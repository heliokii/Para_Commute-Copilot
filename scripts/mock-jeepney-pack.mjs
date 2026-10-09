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
  ['mock-bgc', 'BGC Kanto (mock)', 14.55, 121.05],
  ['mock-coastal', 'Coastal Kanto (mock)', 14.49, 120.991],
  ['mock-sucat', 'Sucat Kanto (mock)', 14.456, 121.045],
]

// One made-up stop per Metro Manila city, so a rider can ask for a city by name.
// The point is hand-picked somewhere inside the city; it is not a real terminal.
// [id, city, lat, lon, extra names the chat should understand]
const CITY_STOPS = [
  ['mock-city-caloocan', 'Caloocan', 14.651, 120.972, ['Kalookan']],
  ['mock-city-laspinas', 'Las Piñas', 14.45, 120.983, []],
  ['mock-city-makati', 'Makati', 14.5665, 121.0295, []],
  ['mock-city-malabon', 'Malabon', 14.662, 120.957, []],
  ['mock-city-mandaluyong', 'Mandaluyong', 14.58, 121.034, []],
  ['mock-city-manila', 'Manila', 14.5898, 120.9818, ['Maynila', 'City of Manila']],
  // No bare "Marikina" alias: that name already means the LRT-2 station, which mock-j8 serves.
  ['mock-city-marikina', 'Marikina', 14.6335, 121.097, []],
  ['mock-city-muntinlupa', 'Muntinlupa', 14.418, 121.044, []],
  ['mock-city-navotas', 'Navotas', 14.657, 120.948, []],
  ['mock-city-paranaque', 'Parañaque', 14.48, 121.019, []],
  ['mock-city-pasay', 'Pasay', 14.538, 121.001, []],
  ['mock-city-pasig', 'Pasig', 14.572, 121.085, []],
  ['mock-city-qc', 'Quezon City', 14.647, 121.05, ['QC', 'Kyusi']],
  ['mock-city-sanjuan', 'San Juan', 14.602, 121.033, []],
  ['mock-city-taguig', 'Taguig', 14.528, 121.07, []],
  ['mock-city-valenzuela', 'Valenzuela', 14.7, 120.98, []],
]

// Made-up fare tables. Deliberately not the LTFRB numbers.
const FARES = [
  { id: 'mock-jeepney-fare', mode: 'jeepney', base: 12, baseKm: 4, perKm: 1.5 },
  { id: 'mock-modern-jeepney-fare', mode: 'modern_jeepney', base: 16, baseKm: 4, perKm: 2.25 },
]

// Each line runs both ways; the return trip is its own route, as the router expects.
const LINES = [
  { id: 'mock-j1', name: 'Quezon Ave – Quiapo', mode: 'jeepney', kmh: 13, stops: ['rail-mrt3-quezon_avenue', 'mock-scout', 'mock-roces', 'mock-banawe', 'mock-rotonda', 'mock-espana', 'mock-quiapo', 'rail-lrt1-carriedo'] },
  { id: 'mock-j2', name: 'Quiapo – Gil Puyat', mode: 'jeepney', kmh: 13, stops: ['mock-quiapo', 'mock-lawton', 'mock-city-manila', 'mock-taft-un', 'mock-taft-quirino', 'mock-taft-vito', 'rail-lrt1-gil_puyat'] },
  { id: 'mock-j3', name: 'Gil Puyat – Ayala', mode: 'jeepney', kmh: 13, stops: ['rail-lrt1-gil_puyat', 'mock-osmena', 'mock-tamo', 'mock-buendia', 'mock-paseo', 'mock-makati-ave', 'rail-mrt3-ayala'] },
  { id: 'mock-j4', name: 'Shaw – Pasig', mode: 'jeepney', kmh: 13, stops: ['rail-mrt3-shaw_boulevard', 'mock-shaw-uno', 'mock-kapitolyo', 'mock-pasig-tulay', 'mock-pasig-palengke'] },
  { id: 'mock-j5', name: 'Valenzuela – Monumento', mode: 'jeepney', kmh: 13, stops: ['mock-city-valenzuela', 'rail-lrt1-monumento'] },
  { id: 'mock-j6', name: 'Navotas – Monumento', mode: 'jeepney', kmh: 13, stops: ['mock-city-navotas', 'mock-city-malabon', 'mock-city-caloocan', 'rail-lrt1-monumento'] },
  { id: 'mock-j7', name: 'Monumento – Quezon City', mode: 'jeepney', kmh: 13, stops: ['rail-lrt1-monumento', 'rail-lrt1-balintawak', 'rail-mrt3-north_avenue', 'rail-mrt3-quezon_avenue', 'mock-city-qc'] },
  { id: 'mock-j8', name: 'Quezon City – Marikina', mode: 'jeepney', kmh: 13, stops: ['mock-city-qc', 'rail-mrt3-araneta_cubao', 'rail-lrt2-anonas', 'rail-lrt2-katipunan', 'rail-lrt2-santolan', 'rail-lrt2-marikina', 'mock-city-marikina'] },
  { id: 'mock-j9', name: 'Marikina – Pasig', mode: 'jeepney', kmh: 13, stops: ['mock-city-marikina', 'rail-lrt2-marikina', 'mock-city-pasig', 'mock-pasig-palengke'] },
  { id: 'mock-j10', name: 'Cubao – Shaw', mode: 'jeepney', kmh: 13, stops: ['rail-mrt3-araneta_cubao', 'mock-city-sanjuan', 'mock-city-mandaluyong', 'rail-mrt3-shaw_boulevard'] },
  { id: 'mock-j11', name: 'Mandaluyong – Ayala', mode: 'jeepney', kmh: 13, stops: ['mock-city-mandaluyong', 'rail-mrt3-boni', 'rail-mrt3-guadalupe', 'mock-city-makati', 'rail-mrt3-ayala'] },
  { id: 'mock-j12', name: 'Ayala – Taguig', mode: 'jeepney', kmh: 13, stops: ['rail-mrt3-ayala', 'mock-bgc', 'mock-city-taguig'] },
  { id: 'mock-j13', name: 'Gil Puyat – Parañaque', mode: 'jeepney', kmh: 13, stops: ['rail-lrt1-gil_puyat', 'mock-city-pasay', 'rail-lrt1-baclaran', 'mock-city-paranaque'] },
  { id: 'mock-j14', name: 'Baclaran – Las Piñas', mode: 'jeepney', kmh: 13, stops: ['rail-lrt1-baclaran', 'mock-coastal', 'mock-city-laspinas'] },
  { id: 'mock-j15', name: 'Parañaque – Muntinlupa', mode: 'jeepney', kmh: 13, stops: ['mock-city-paranaque', 'mock-sucat', 'mock-city-muntinlupa'] },
  { id: 'mock-j16', name: 'Las Piñas – Muntinlupa', mode: 'jeepney', kmh: 13, stops: ['mock-city-laspinas', 'mock-city-muntinlupa'] },
  { id: 'mock-m1', name: 'Quezon Ave – Gil Puyat Express', mode: 'modern_jeepney', kmh: 21, stops: ['rail-mrt3-quezon_avenue', 'mock-rotonda', 'mock-lawton', 'rail-lrt1-gil_puyat'] },
]

const railRows = readFileSync('data/metro-manila/rail-pack/landmarks.csv', 'utf8').split(/\r?\n/).slice(1).filter(Boolean)
const place = new Map([...STOPS, ...CITY_STOPS].map(([id, , lat, lon]) => [id, { lat, lon }]))
for (const row of railRows) {
  const [id, , , , lat, lon] = row.split(',')
  place.set(id, { lat: Number(lat), lon: Number(lon) })
}

const cell = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value))
const csv = (name, rows) => `${[PACK_HEADERS[name], ...rows].map((row) => row.map(cell).join(',')).join('\n')}\n`

const landmarks = [
  ...STOPS.map(([id, name, lat, lon]) => [id, name, name.replace(' (mock)', ''), '', lat, lon, NOTE]),
  ...CITY_STOPS.map(([id, city, lat, lon, extra]) => {
    const names = id === 'mock-city-marikina' ? [] : [city, ...(city.endsWith('City') ? [] : [`${city} City`]), ...extra]
    return [id, `${city} Sentro (mock)`, [`${city} Sentro`, ...names].join('|'), '', lat, lon, NOTE]
  }),
]
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
