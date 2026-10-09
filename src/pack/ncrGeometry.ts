type Point = [number, number]
type Ring = Point[]
export type Polygon = Ring[]
type MultiPolygon = Polygon[]

export type NcrBoundary = MultiPolygon

function isPolygon(value: unknown): value is Polygon {
  return Array.isArray(value) && value.length > 0 && value.every((ring) =>
    Array.isArray(ring) && ring.length >= 4 && ring.every((point) =>
      Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])) &&
      ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
}

function isNcrFeature(feature: unknown): boolean {
  const properties = (feature as { properties?: Record<string, unknown> })?.properties
  if (!properties) return false
  return Object.entries(properties).some(([key, value]) => {
    if (typeof value !== 'string') return false
    const field = key.toLowerCase()
    const text = value.trim().toLowerCase()
    return ['region', 'region_name', 'adm1_en', 'name', 'adm1_pcode', 'pcode', 'reg_name'].includes(field) &&
      ['ncr', 'national capital region', 'metro manila', 'ph13'].includes(text)
  })
}

function onSegment(point: Point, a: Point, b: Point): boolean {
  const cross = (point[1] - a[1]) * (b[0] - a[0]) - (point[0] - a[0]) * (b[1] - a[1])
  if (Math.abs(cross) > 1e-10) return false
  return point[0] >= Math.min(a[0], b[0]) - 1e-10 && point[0] <= Math.max(a[0], b[0]) + 1e-10 &&
    point[1] >= Math.min(a[1], b[1]) - 1e-10 && point[1] <= Math.max(a[1], b[1]) + 1e-10
}

function inRing(point: Point, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i]
    if (onSegment(point, a, b)) return true
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

function inPolygon(point: Point, polygon: Polygon): boolean {
  return inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole))
}

export function isInsideNcr(point: Point, boundary: NcrBoundary): boolean {
  return boundary.some((polygon) => inPolygon(point, polygon))
}

export function readNcrBoundary(input: unknown): NcrBoundary | null {
  if (!input || typeof input !== 'object') return null
  const object = input as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown[] }
  if (object.type === 'FeatureCollection' && Array.isArray(object.features)) {
    const polygons = object.features.flatMap((feature) => {
      if (!isNcrFeature(feature)) return []
      const geometry = (feature as { geometry?: { type?: string; coordinates?: unknown } })?.geometry
      if (geometry?.type === 'Polygon' && isPolygon(geometry.coordinates)) return [geometry.coordinates]
      if (geometry?.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.every(isPolygon)) return geometry.coordinates
      return []
    })
    return polygons.length ? polygons : null
  }
  if (object.type !== 'Feature' || !isNcrFeature(input)) return null
  const geometry = object.geometry as { type?: string; coordinates?: unknown }
  if (geometry?.type === 'Polygon' && isPolygon(geometry.coordinates)) return [geometry.coordinates]
  if (geometry?.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.every(isPolygon)) return geometry.coordinates
  return null
}
