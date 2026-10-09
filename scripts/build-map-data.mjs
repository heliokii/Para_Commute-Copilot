// Usage: node scripts/build-map-data.mjs [--refresh]
// Builds src/assets/ncr-map.json, the offline basemap for the Mapa screen, and the
// NCR boundary used by pack validation. Data: OpenStreetMap contributors, ODbL.
// Raw Overpass responses are cached in .cache/map so a rerun needs no network
// (--refresh ignores the cache). Only the simplified result is committed.
//
// Output coordinates are integers in 1e-4 degree units (about 11 m). Lines are
// delta-coded: [x0, y0, dx1, dy1, ...] with x = lon, y = lat.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BBOX = [14.35, 120.9, 14.8, 121.2] // south, west, north, east
const CACHE = '.cache/map'
const OUT = 'src/assets/ncr-map.json'
const BOUNDARY_OUT = 'data/metro-manila/pack/ncr_boundary.geojson'
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const SCALE = 1e4
const refresh = process.argv.includes('--refresh')
mkdirSync(CACHE, { recursive: true })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Returns the parsed response, or null after `attempts` failures when `attempts` < 8 (callers may split the query). */
async function overpass(name, query, attempts = 8) {
  const file = join(CACHE, `${name}.json`)
  if (!refresh && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  for (let attempt = 0; attempt < attempts; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length]
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'ParaApp-data-import/0.1', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(180_000),
      })
      const text = await response.text()
      if (text.trimStart().startsWith('{')) {
        writeFileSync(file, text)
        console.log(`fetched ${name} (${(text.length / 1e6).toFixed(1)} MB) from ${new URL(url).host}`)
        return JSON.parse(text)
      }
      console.log(`${name}: ${new URL(url).host} busy, retrying`)
    } catch (error) {
      console.log(`${name}: ${new URL(url).host} ${error.message}, retrying`)
    }
    await sleep(4000 * (attempt + 1))
  }
  if (attempts < 8) return null
  throw new Error(`Overpass failed for ${name}`)
}

const bbox = BBOX.join(',')

// Heavy queries run per tile so a busy server can still answer; ways are deduplicated by id.
function tiles(rows, cols) {
  const [s, w, n, e] = BBOX
  const out = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push([s + ((n - s) * r) / rows, w + ((e - w) * c) / cols, s + ((n - s) * (r + 1)) / rows, w + ((e - w) * (c + 1)) / cols].map((v) => v.toFixed(5)).join(','))
  }
  return out
}
// A tile the servers keep refusing is split into four and retried, down to a depth of 2.
async function tiled(name, rows, cols, build) {
  const seen = new Map()
  const take = (data) => { for (const el of data.elements) seen.set(`${el.type}${el.id}`, el) }
  const run = async (key, box, depth) => {
    const last = depth >= 2
    const data = await overpass(key, build(box.join(',')), last ? 6 : 3)
    if (data) return take(data)
    if (last) {
      // A sliver the servers will not answer is left out and reported; it is not worth failing the build.
      console.log(`WARNING ${key}: skipped after repeated failures (${box.join(',')})`)
      return
    }
    const [s, w, n, e] = box.map(Number)
    const ms = (s + n) / 2, mw = (w + e) / 2
    const quarters = [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]]
    for (const [i, quarter] of quarters.entries()) await run(`${key}.${i}`, quarter.map((v) => v.toFixed(5)), depth + 1)
  }
  for (const [i, box] of tiles(rows, cols).entries()) await run(`${name}-${i}`, box.split(','), 0)
  return { elements: [...seen.values()] }
}

// --- simplification ---------------------------------------------------------
function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = dx * dx + dy * dy
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}
function simplify(points, tolerance) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()
    let max = 0, index = -1
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e])
      if (d > max) { max = d; index = i }
    }
    if (max > tolerance && index !== -1) { keep[index] = 1; stack.push([s, index], [index, e]) }
  }
  return points.filter((_, i) => keep[i])
}
// Geometry as quantised [x, y] integer pairs.
const quantise = (geometry) => geometry.map((p) => [Math.round(p.lon * SCALE), Math.round(p.lat * SCALE)])
function dedupe(points) {
  return points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1])
}
function encode(points) {
  const out = [points[0][0], points[0][1]]
  for (let i = 1; i < points.length; i++) out.push(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  return out
}
const line = (way, tolerance) => {
  const points = simplify(dedupe(quantise(way.geometry)), tolerance)
  return points.length >= 2 ? encode(points) : null
}

// Stitch way fragments (arrays of [x, y]) into closed rings.
function stitch(fragments) {
  const rings = []
  const pool = fragments.map((f) => f.slice())
  while (pool.length) {
    let ring = pool.pop()
    let grew = true
    while (grew && !(ring.length > 3 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1])) {
      grew = false
      for (let i = 0; i < pool.length; i++) {
        const f = pool[i]
        const end = ring.at(-1)
        const same = (a, b) => a[0] === b[0] && a[1] === b[1]
        if (same(end, f[0])) ring = ring.concat(f.slice(1))
        else if (same(end, f.at(-1))) ring = ring.concat(f.slice().reverse().slice(1))
        else if (same(ring[0], f.at(-1))) ring = f.concat(ring.slice(1))
        else if (same(ring[0], f[0])) ring = f.slice().reverse().concat(ring.slice(1))
        else continue
        pool.splice(i, 1)
        grew = true
        break
      }
    }
    rings.push(ring)
  }
  return rings
}

// --- boundary ---------------------------------------------------------------
const boundaryData = await overpass(
  'boundary',
  `[out:json][timeout:120];relation["boundary"="administrative"]["admin_level"="3"]["name"~"^(Metro Manila|National Capital Region)$"];out geom;`,
)
const ncr = boundaryData.elements.find((e) => e.type === 'relation')
if (!ncr) throw new Error('NCR boundary relation not found')
const outer = ncr.members.filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry)
const rings = stitch(outer.map((m) => dedupe(quantise(m.geometry))))
const closed = rings.filter((r) => r.length > 3 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1])
if (closed.length === 0) throw new Error('NCR boundary rings did not close')
const boundaryRings = closed.map((r) => simplify(r, 2)).filter((r) => r.length > 3)
writeFileSync(
  BOUNDARY_OUT,
  `${JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: 'NCR', source: 'OpenStreetMap relation ' + ncr.id, license: 'ODbL', note: 'OSM-derived, simplified to about 20 m. Not a legal boundary.' },
      geometry: { type: 'MultiPolygon', coordinates: boundaryRings.map((r) => [r.map(([x, y]) => [x / SCALE, y / SCALE])]) },
    }],
  })}\n`,
)
console.log(`boundary: ${boundaryRings.length} ring(s), ${boundaryRings.reduce((n, r) => n + r.length, 0)} points`)

// --- layers -----------------------------------------------------------------
const roadClasses = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']
const roadsData = await tiled('roads', 3, 3, (box) => `[out:json][timeout:120][bbox:${box}];way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"];out geom tags;`)
const roads = Object.fromEntries(roadClasses.map((c) => [c, []]))
const roadNames = new Map()
for (const way of roadsData.elements) {
  const cls = way.tags.highway
  const encoded = line(way, cls === 'tertiary' ? 2 : 1)
  if (!encoded) continue
  roads[cls].push(encoded)
  if (way.tags.name && (cls === 'motorway' || cls === 'trunk' || cls === 'primary')) {
    const mid = way.geometry[Math.floor(way.geometry.length / 2)]
    const key = way.tags.name
    const length = way.geometry.length
    if (!roadNames.has(key) || roadNames.get(key).length < length) roadNames.set(key, { length, x: Math.round(mid.lon * SCALE), y: Math.round(mid.lat * SCALE) })
  }
}

const waterData = await tiled('water', 2, 2, (box) => `[out:json][timeout:120][bbox:${box}];(way["natural"="coastline"];way["natural"="water"]["name"];way["waterway"~"^(river|canal)$"]["name"];relation["natural"="water"]["name"~"Laguna de Bay|Laguna Lake"];);out geom tags;`)
const coast = [], coastRaw = [], waterways = [], lakes = []
for (const el of waterData.elements) {
  if (el.type === 'relation') {
    for (const m of el.members ?? []) {
      if (m.type === 'way' && m.role === 'outer' && m.geometry) lakes.push(m.geometry)
    }
    continue
  }
  if (el.tags?.natural === 'coastline') { coastRaw.push(dedupe(quantise(el.geometry))); const e = line(el, 2); if (e) coast.push(e) }
  else if (el.tags?.waterway) { const e = line(el, 1.5); if (e) waterways.push(e) }
  else if (el.tags?.natural === 'water' && el.geometry) lakes.push(el.geometry)
}
const lakeRings = stitch(lakes.map((g) => dedupe(quantise(g))))
  .filter((r) => r.length > 3 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1])
  .map((r) => simplify(r, 3))
  .filter((r) => r.length > 3)
  .map(encode)

// Sea polygon: the longest coastline chain (Manila Bay), closed around the west edge of the box.
// Chains are undirected, so start the polygon at whichever end is further south.
const chains = stitch(coastRaw).sort((a, b) => b.length - a.length)
let sea = []
if (chains[0]) {
  const chain = chains[0][0][1] <= chains[0].at(-1)[1] ? chains[0] : chains[0].slice().reverse()
  // Past each end of the chain the coast keeps going beyond the box, so run straight out to the
  // box edge (a little past it) and across the west side. The bay is west of the chain.
  const west = Math.round((BBOX[1] - 0.3) * SCALE)
  const top = Math.round((BBOX[2] + 0.05) * SCALE)
  const bottom = Math.round((BBOX[0] - 0.05) * SCALE)
  const ring = simplify(chain, 2).concat([[chain.at(-1)[0], top], [west, top], [west, bottom], [chain[0][0], bottom], chain[0]])
  sea = [encode(ring)]
}

const placeData = await overpass(
  'places',
  `[out:json][timeout:60][bbox:${bbox}];(node["place"~"^(city|town|suburb)$"]["name"];relation["boundary"="administrative"]["admin_level"="5"]["name"];);out center tags;`,
)
const places = placeData.elements
  .map((e) => {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon
    if (lat === undefined) return null
    // Manila's administrative districts ("Capital District" and the like) are not names riders use.
    if (/District/.test(e.tags.name)) return null
    const kind = e.tags.place ?? 'city'
    return [e.tags.name, Math.round(lon * SCALE), Math.round(lat * SCALE), kind === 'suburb' ? 2 : 0]
  })
  .filter(Boolean)

const railData = await overpass(
  'rail',
  `[out:json][timeout:120][bbox:${bbox}];way["railway"~"^(light_rail|subway)$"]["service"!~"."];out geom tags;`,
)
// Attribute each track way to the line whose stations it runs along (nearest station-to-station
// segment), using the station coordinates in rail-station-coordinates.csv. Ways further than 300 m
// from every line are kept as 'other'.
const stationCsv = readFileSync('data/metro-manila/rail-station-coordinates.csv', 'utf8').trim().split(/\r?\n/).slice(1)
const stationsByLine = {}
for (const row of stationCsv) {
  const [lineId, , , lat, lon] = row.split(',')
  ;(stationsByLine[lineId] ??= []).push([Number(lon), Number(lat)])
}
const COS = Math.cos((14.575 * Math.PI) / 180)
const distToSegment = (p, a, b) => {
  const f = (q) => [q[0] * COS, q[1]]
  return perpDist(f(p), f(a), f(b)) * 111_320
}
const lineOf = (way) => {
  const samples = [0.25, 0.5, 0.75].map((t) => way.geometry[Math.floor((way.geometry.length - 1) * t)]).map((g) => [g.lon, g.lat])
  let best = null, bestDistance = Infinity
  for (const [lineId, stations] of Object.entries(stationsByLine)) {
    let total = 0
    for (const sample of samples) {
      let min = Infinity
      for (let i = 1; i < stations.length; i++) min = Math.min(min, distToSegment(sample, stations[i - 1], stations[i]))
      total += min
    }
    if (total / samples.length < bestDistance) { bestDistance = total / samples.length; best = lineId }
  }
  return bestDistance <= 300 ? best : 'other'
}
const rail = { lrt1: [], lrt2: [], mrt3: [], other: [] }
for (const way of railData.elements) {
  const e = line(way, 0.5)
  if (e) rail[lineOf(way)].push(e)
}

const map = {
  source: 'OpenStreetMap contributors, ODbL',
  capturedAt: new Date().toISOString().slice(0, 10),
  scale: SCALE,
  bbox: BBOX,
  boundary: boundaryRings.map(encode),
  sea,
  coast,
  lakes: lakeRings,
  waterways,
  roads,
  roadNames: [...roadNames].map(([name, v]) => [name, v.x, v.y]),
  places,
  rail,
}
mkdirSync('src/assets', { recursive: true })
writeFileSync(OUT, JSON.stringify(map))
const size = readFileSync(OUT).length
console.log(`wrote ${OUT}: ${(size / 1e6).toFixed(2)} MB`)
for (const cls of roadClasses) console.log(`  ${cls}: ${roads[cls].length}`)
console.log(`  coast ${coast.length}, lakes ${lakeRings.length}, waterways ${waterways.length}, rail ${Object.entries(rail).map(([k, v]) => k + ' ' + v.length).join(' ')}, places ${places.length}, road names ${roadNames.size}`)
