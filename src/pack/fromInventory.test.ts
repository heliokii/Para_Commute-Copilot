import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv.ts'
import { buildPackFiles, routeId, stopKey, worksheets, type Inventory } from './fromInventory.ts'
import { packFromCsv } from './packFromCsv.ts'

// Made-up stops and numbers, for the transform only. Not a real route.
const INVENTORY: Inventory = {
  capturedAt: '2026-10-10',
  serviceStatusSource: 'https://example.org/guide',
  serviceStatusSourceDate: '2026-08-04',
  routes: [
    { route: 1, name: 'Old', status: 'historical-stop-list', sourceUrl: 'https://example.org/1', directions: { outbound: ['A', 'B'] } },
    { route: 2, name: 'Test', status: 'procurement-stop-list', sourceUrl: 'https://example.org/2', directions: { outbound: ['A', 'B', 'C'], return: ['C', 'B', 'A'] } },
    { route: 6, name: 'No order', status: 'current-stop-list', sourceUrl: 'https://example.org/6' },
  ],
}

function filled(skipSegment = '') {
  const blank = worksheets(INVENTORY)
  const coordinates: Record<string, [string, string]> = { 'qcb-a': ['14.60', '121.00'], 'qcb-b': ['14.61', '121.00'], 'qcb-c': ['14.62', '121.00'] }
  const stop_coordinates = blank.stop_coordinates
    .trim()
    .split('\n')
    .map((line, index) => {
      if (index === 0) return line
      const [key, name] = line.split(',')
      return [key, name, ...coordinates[key], 'gps', '2026-10-10', 'tester', ''].join(',')
    })
    .join('\n') + '\n'
  const segment_measurements = blank.segment_measurements
    .trim()
    .split('\n')
    .map((line, index) => {
      if (index === 0) return line
      const [route, seq, from, to] = line.split(',')
      return `${route}#${seq}` === skipSegment ? line : [route, seq, from, to, '1.5', '6', '', 'ride', '2026-10-10', 'tester', ''].join(',')
    })
    .join('\n') + '\n'
  return { ...blank, stop_coordinates, segment_measurements }
}

describe('worksheets', () => {
  it('lists each sourced stop once and each segment per direction, with measurements blank', () => {
    const sheets = worksheets(INVENTORY)
    const stops = parseCsv(sheets.stop_coordinates).records
    expect(stops.map((record) => record.values.stop_key)).toEqual(['qcb-a', 'qcb-b', 'qcb-c'])
    expect(stops.every((record) => record.values.lat === '' && record.values.lon === '')).toBe(true)
    const segments = parseCsv(sheets.segment_measurements).records
    expect(segments).toHaveLength(4)
    expect(segments.every((record) => record.values.dist_km === '' && record.values.min === '')).toBe(true)
  })

  it('keeps what the team already filled in', () => {
    const sheets = filled()
    expect(worksheets(INVENTORY, sheets)).toEqual(sheets)
  })

  it('gives one stop name one key', () => {
    expect(stopKey('IBP Road–Litex')).toBe('qcb-ibp-road-litex')
    expect(stopKey('Mindanao Avenue–D. Muñoz Street')).toBe('qcb-mindanao-avenue-d-munoz-street')
  })
})

describe('buildPackFiles', () => {
  it('emits nothing from blank worksheets and says why', () => {
    const result = buildPackFiles(INVENTORY, worksheets(INVENTORY))
    expect(result.emitted).toEqual([])
    expect(parseCsv(result.files.routes).records).toEqual([])
    expect(parseCsv(result.files.fares).records).toEqual([])
    expect(result.skipped.find((item) => item.routeId === routeId(2, 'outbound'))?.reason).toBe(
      '3 of 3 stops have no coordinates; 2 of 2 segments have no measured distance and time',
    )
  })

  it('never emits a historical route or one without a stated stop order', () => {
    const result = buildPackFiles(INVENTORY, filled())
    expect(result.emitted).toEqual(['qcb-2-outbound', 'qcb-2-return'])
    expect(result.skipped.map((item) => item.routeId)).toEqual(['qcb-1', 'qcb-6'])
  })

  it('leaves out a direction with one unmeasured segment and keeps the other', () => {
    const result = buildPackFiles(INVENTORY, filled('qcb-2-return#3'))
    expect(result.emitted).toEqual(['qcb-2-outbound'])
    expect(result.skipped.find((item) => item.routeId === 'qcb-2-return')?.reason).toBe(
      '1 of 2 segments have no measured distance and time',
    )
  })

  it('produces a pack the validator accepts, unverified, with a sourced free fare', () => {
    const result = buildPackFiles(INVENTORY, filled())
    const { pack, issues } = packFromCsv(result.files)
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(pack.routes.map((route) => [route.id, route.verified, route.stops.length])).toEqual([
      ['qcb-2-outbound', false, 3],
      ['qcb-2-return', false, 3],
    ])
    expect(pack.fares).toHaveLength(1)
    expect(pack.fares[0].sourceUrl).toBe('https://example.org/guide')
    expect(pack.fares[0].effectiveDate).toBe('2026-08-04')
  })

  it('marks a route verified only with a ride-check date and name', () => {
    const sheets = filled()
    const route_checks = sheets.route_checks.replace('qcb-2-outbound,Q City Bus 2: A to C,,', 'qcb-2-outbound,Q City Bus 2: A to C,2026-10-11,tester')
    const { pack } = packFromCsv(buildPackFiles(INVENTORY, { ...sheets, route_checks }).files)
    expect(pack.routes.map((route) => route.verified)).toEqual([true, false])
  })

  it('gives the same output twice', () => {
    expect(buildPackFiles(INVENTORY, filled())).toEqual(buildPackFiles(INVENTORY, filled()))
  })
})
