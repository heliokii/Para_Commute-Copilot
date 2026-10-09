import mapJson from '../assets/ncr-map.json' with { type: 'json' }

// The offline basemap: OpenStreetMap roads, water, boundary and track geometry for
// Metro Manila, simplified by scripts/build-map-data.mjs and bundled with the app.
// © OpenStreetMap contributors, ODbL.

/** Lines are delta-coded integers: [x0, y0, dx1, dy1, ...] in 1/scale degrees (x = lon, y = lat). */
type Encoded = number[]

export type RoadClass = 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary'
export type RailLineId = 'lrt1' | 'lrt2' | 'mrt3' | 'other'

interface MapData {
  source: string
  capturedAt: string
  scale: number
  /** south, west, north, east */
  bbox: [number, number, number, number]
  boundary: Encoded[]
  sea: Encoded[]
  coast: Encoded[]
  lakes: Encoded[]
  waterways: Encoded[]
  roads: Record<RoadClass, Encoded[]>
  roadNames: [string, number, number][]
  /** name, x, y, 0 = city, 2 = district */
  places: [string, number, number, number][]
  rail: Record<RailLineId, Encoded[]>
}

const data = mapJson as unknown as MapData
const [SOUTH, WEST, NORTH, EAST] = data.bbox
const COS = Math.cos((((SOUTH + NORTH) / 2) * Math.PI) / 180)
const UNITS_PER_DEGREE = 1000 / (NORTH - SOUTH)

/** The map is WORLD_WIDTH x WORLD_HEIGHT units; north is up. */
export const WORLD_HEIGHT = 1000
export const WORLD_WIDTH = (EAST - WEST) * COS * UNITS_PER_DEGREE
export const MAP_ATTRIBUTION = `© OpenStreetMap contributors (ODbL), ${data.capturedAt}`

export function project(lon: number, lat: number): { x: number; y: number } {
  return { x: (lon - WEST) * COS * UNITS_PER_DEGREE, y: (NORTH - lat) * UNITS_PER_DEGREE }
}

const round = (value: number) => Math.round(value * 10) / 10

/** One SVG sub-path for a delta-coded line. */
function toPath(line: Encoded, close = false): string {
  let x = line[0]
  let y = line[1]
  const start = project(x / data.scale, y / data.scale)
  let d = `M${round(start.x)} ${round(start.y)}`
  for (let i = 2; i < line.length; i += 2) {
    x += line[i]
    y += line[i + 1]
    const point = project(x / data.scale, y / data.scale)
    d += `L${round(point.x)} ${round(point.y)}`
  }
  return close ? `${d}Z` : d
}

const joinPaths = (lines: Encoded[], close = false) => lines.map((line) => toPath(line, close)).join('')

export interface Basemap {
  boundary: string
  sea: string
  lakes: string
  coast: string
  waterways: string
  roads: Record<RoadClass, string>
  rail: Record<RailLineId, string>
  roadNames: { name: string; x: number; y: number }[]
  places: { name: string; x: number; y: number; district: boolean }[]
}

let cached: Basemap | null = null

/** Decodes the bundled data into SVG paths once, on first use. */
export function getBasemap(): Basemap {
  cached ??= {
    boundary: joinPaths(data.boundary, true),
    sea: joinPaths(data.sea, true),
    lakes: joinPaths(data.lakes, true),
    coast: joinPaths(data.coast),
    waterways: joinPaths(data.waterways),
    roads: {
      motorway: joinPaths(data.roads.motorway),
      trunk: joinPaths(data.roads.trunk),
      primary: joinPaths(data.roads.primary),
      secondary: joinPaths(data.roads.secondary),
      tertiary: joinPaths(data.roads.tertiary),
    },
    rail: {
      lrt1: joinPaths(data.rail.lrt1),
      lrt2: joinPaths(data.rail.lrt2),
      mrt3: joinPaths(data.rail.mrt3),
      other: joinPaths(data.rail.other),
    },
    roadNames: data.roadNames.map(([name, x, y]) => ({ name, ...project(x / data.scale, y / data.scale) })),
    places: data.places.map(([name, x, y, kind]) => ({ name, ...project(x / data.scale, y / data.scale), district: kind === 2 })),
  }
  return cached
}
