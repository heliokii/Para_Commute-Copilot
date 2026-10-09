import { describe, expect, it } from 'vitest'
import { isInsideNcr, readNcrBoundary, type NcrBoundary, type Polygon } from './ncrGeometry.ts'

const square: Polygon = [[[120, 14], [121, 14], [121, 15], [120, 15], [120, 14]]]

describe('NCR boundary geometry', () => {
  it('reads GeoJSON FeatureCollections and includes polygon edges', () => {
    const boundary = readNcrBoundary({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { REGION: 'NCR' }, geometry: { type: 'Polygon', coordinates: square } }] })!
    expect(isInsideNcr([120.5, 14.5], boundary)).toBe(true)
    expect(isInsideNcr([120, 14.5], boundary)).toBe(true)
    expect(isInsideNcr([121.1, 14.5], boundary)).toBe(false)
  })

  it('respects polygon holes and multipolygon components', () => {
    const polygonWithHole = [square[0], [[120.4, 14.4], [120.6, 14.4], [120.6, 14.6], [120.4, 14.6], [120.4, 14.4]]] as NcrBoundary[number]
    expect(isInsideNcr([120.5, 14.5], [polygonWithHole])).toBe(false)
    const otherPolygon: Polygon = [[[122, 14], [123, 14], [123, 15], [122, 15], [122, 14]]]
    const multipolygon: NcrBoundary = [square, otherPolygon]
    expect(isInsideNcr([122.5, 14.5], multipolygon)).toBe(true)
  })

  it('rejects absent and non-polygon boundary geometries', () => {
    expect(readNcrBoundary(null)).toBeNull()
    expect(readNcrBoundary({ type: 'Point', coordinates: [121, 14] })).toBeNull()
    expect(readNcrBoundary({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { REGION: 'Region IV-A' }, geometry: { type: 'Polygon', coordinates: square } },
    ] })).toBeNull()
  })
})
