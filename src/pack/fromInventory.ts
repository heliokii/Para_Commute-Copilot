import { parseCsv } from './csv.ts'
import { PACK_HEADERS, type PackFile } from './packFromCsv.ts'

// Turns a sourced stop inventory plus the team's field worksheets into route
// pack CSVs. Pure: no file, network or clock access. Nothing is estimated: a
// route with one unmeasured stop or segment is left out and reported.

export interface InventoryRoute {
  route: number
  name: string
  status: string
  sourceUrl: string
  /** Direction name to ordered stop names. Absent when the source gives no order. */
  directions?: Record<string, string[]>
}

export interface Inventory {
  capturedAt: string
  /** Page that states the service is running and free. */
  serviceStatusSource: string
  serviceStatusSourceDate: string
  routes: InventoryRoute[]
}

export type Worksheet = 'stop_coordinates' | 'segment_measurements' | 'route_checks'

export const WORKSHEET_HEADERS: Record<Worksheet, string[]> = {
  stop_coordinates: ['stop_key', 'stop_name', 'lat', 'lon', 'method', 'measured_date', 'measured_by', 'note'],
  segment_measurements: ['route_id', 'seq', 'from_stop_key', 'to_stop_key', 'dist_km', 'min', 'min_rush', 'method', 'measured_date', 'measured_by', 'note'],
  route_checks: ['route_id', 'route_name', 'verified_date', 'verified_by', 'note'],
}

export const FREE_FARE_ID = 'fare-qcb-free'

const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)
const toCsv = (headers: string[], rows: Record<string, string>[]) =>
  [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
    .map((cells) => cells.map(cell).join(','))
    .join('\n') + '\n'

/** "IBP Road–Litex" becomes "qcb-ibp-road-litex". Same name, same key, on every route. */
export function stopKey(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `qcb-${slug}`
}

export const routeId = (route: number, direction: string) => `qcb-${route}-${direction}`

/** Why a route cannot be imported at all, whatever the team measures. */
export function blocked(route: InventoryRoute): string | null {
  if (route.status.startsWith('historical')) return 'the stop list is historical, not the current one'
  if (!route.directions) return 'the source does not state the stop order per direction'
  return null
}

interface Variant {
  id: string
  name: string
  sourceUrl: string
  stops: string[]
}

function variants(inventory: Inventory): Variant[] {
  return inventory.routes
    .filter((route) => blocked(route) === null)
    .flatMap((route) =>
      Object.entries(route.directions!).map(([direction, stops]) => ({
        id: routeId(route.route, direction),
        name: `Q City Bus ${route.route}: ${stops[0]} to ${stops.at(-1)}`,
        sourceUrl: route.sourceUrl,
        stops,
      })),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
}

const rowsBy = (csv: string | undefined, key: (values: Record<string, string>) => string) =>
  new Map((csv ? parseCsv(csv).records : []).map((record) => [key(record.values), record.values]))

const segmentKey = (values: Record<string, string>) => `${values.route_id}#${values.seq}`

/**
 * The worksheets the team fills in, prefilled with the sourced stop names and
 * order. Cells already filled in `existing` are kept.
 */
export function worksheets(
  inventory: Inventory,
  existing: Partial<Record<Worksheet, string>> = {},
): Record<Worksheet, string> {
  const list = variants(inventory)
  const names = new Map<string, string>()
  for (const variant of list) {
    for (const name of variant.stops) {
      const key = stopKey(name)
      const clash = names.get(key)
      if (clash !== undefined && clash !== name) throw new Error(`stop names "${clash}" and "${name}" share the key ${key}`)
      names.set(key, name)
    }
  }

  const oldStops = rowsBy(existing.stop_coordinates, (values) => values.stop_key)
  const oldSegments = rowsBy(existing.segment_measurements, segmentKey)
  const oldChecks = rowsBy(existing.route_checks, (values) => values.route_id)

  const stopRows = [...names]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, name]) => ({ ...oldStops.get(key), stop_key: key, stop_name: name }))
  const segmentRows = list.flatMap((variant) =>
    variant.stops.slice(1).map((name, index) => {
      const row = { route_id: variant.id, seq: String(index + 2) }
      return {
        ...oldSegments.get(segmentKey(row)),
        ...row,
        from_stop_key: stopKey(variant.stops[index]),
        to_stop_key: stopKey(name),
      }
    }),
  )
  const checkRows = list.map((variant) => ({ ...oldChecks.get(variant.id), route_id: variant.id, route_name: variant.name }))

  return {
    stop_coordinates: toCsv(WORKSHEET_HEADERS.stop_coordinates, stopRows),
    segment_measurements: toCsv(WORKSHEET_HEADERS.segment_measurements, segmentRows),
    route_checks: toCsv(WORKSHEET_HEADERS.route_checks, checkRows),
  }
}

export interface ImportResult {
  files: Record<PackFile, string>
  emitted: string[]
  skipped: { routeId: string; reason: string }[]
}

const isNumber = (raw: string | undefined) => raw !== undefined && raw !== '' && Number.isFinite(Number(raw))
const isPositive = (raw: string | undefined) => isNumber(raw) && Number(raw) > 0

/** Route pack CSVs for every route whose stops and segments are all measured. */
export function buildPackFiles(inventory: Inventory, sheets: Partial<Record<Worksheet, string>>): ImportResult {
  const stops = rowsBy(sheets.stop_coordinates, (values) => values.stop_key)
  const segments = rowsBy(sheets.segment_measurements, segmentKey)
  const checks = rowsBy(sheets.route_checks, (values) => values.route_id)

  const skipped: ImportResult['skipped'] = inventory.routes.flatMap((route) => {
    const reason = blocked(route)
    return reason ? [{ routeId: `qcb-${route.route}`, reason }] : []
  })
  const emitted: string[] = []
  const usedStops = new Set<string>()
  const routeRows: Record<string, string>[] = []
  const stopRows: Record<string, string>[] = []

  for (const variant of variants(inventory)) {
    const keys = variant.stops.map(stopKey)
    const noCoordinates = keys.filter((key) => !isNumber(stops.get(key)?.lat) || !isNumber(stops.get(key)?.lon)).length
    const measured = keys.slice(1).map((_, index) => segments.get(`${variant.id}#${index + 2}`))
    const noMeasurement = measured.filter((row) => !isPositive(row?.dist_km) || !isPositive(row?.min)).length
    if (noCoordinates > 0 || noMeasurement > 0) {
      const missing = [
        noCoordinates > 0 ? `${noCoordinates} of ${keys.length} stops have no coordinates` : '',
        noMeasurement > 0 ? `${noMeasurement} of ${measured.length} segments have no measured distance and time` : '',
      ].filter(Boolean)
      skipped.push({ routeId: variant.id, reason: missing.join('; ') })
      continue
    }

    const check = checks.get(variant.id)
    const verified = Boolean(check?.verified_date && check.verified_by)
    emitted.push(variant.id)
    keys.forEach((key) => usedStops.add(key))
    routeRows.push({
      id: variant.id,
      mode: 'bus',
      name: variant.name,
      tags: 'Q City Bus',
      fare_table_id: FREE_FARE_ID,
      verified: String(verified),
      verified_date: verified ? check!.verified_date : '',
      verified_by: verified ? check!.verified_by : '',
      note: `Stop list from ${variant.sourceUrl}`,
    })
    keys.forEach((key, index) => {
      const row = measured[index - 1]
      stopRows.push({
        route_id: variant.id,
        seq: String(index + 1),
        landmark_id: key,
        dist_km_from_prev: index === 0 ? '0' : row!.dist_km,
        min_from_prev: index === 0 ? '0' : row!.min,
        min_from_prev_rush: row?.min_rush ?? '',
        method: row?.method ?? '',
        measured_date: row?.measured_date ?? '',
        measured_by: row?.measured_by ?? '',
        note: row?.note ?? '',
      })
    })
  }

  const landmarkRows = [...usedStops].sort().map((key) => {
    const row = stops.get(key)!
    return { id: key, name: row.stop_name, aliases: '', tags: '', lat: row.lat, lon: row.lon, note: row.note ?? '' }
  })
  // The city runs the service free of charge. The date is the route guide's own
  // "last updated" date, since the guide does not say when free rides began.
  const fareRows = emitted.length === 0 ? [] : [{
    id: FREE_FARE_ID,
    mode: 'bus',
    product: 'free',
    vehicle_class: 'city_bus',
    rule: 'distance',
    base_fare: '0',
    base_km: '0',
    per_km: '0',
    effective_date: inventory.serviceStatusSourceDate,
    expires_at: '',
    rounding_rule: 'none',
    source_note: `Free service per the Quezon City route guide, last updated ${inventory.serviceStatusSourceDate} (guide date, not the start of free rides)`,
    source_url: inventory.serviceStatusSource,
    photo_ref: '',
    conflict_note: '',
  }]

  const rows: Record<PackFile, Record<string, string>[]> = {
    landmarks: landmarkRows,
    routes: routeRows,
    route_stops: stopRows,
    fares: fareRows,
    fare_matrix: [],
    fare_promotions: [],
    terminals: [],
  }
  const files = Object.fromEntries(
    (Object.keys(PACK_HEADERS) as PackFile[]).map((file) => [file, toCsv(PACK_HEADERS[file], rows[file])]),
  ) as Record<PackFile, string>
  return { files, emitted, skipped: skipped.sort((a, b) => a.routeId.localeCompare(b.routeId)) }
}
