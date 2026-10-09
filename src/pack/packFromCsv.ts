import { haversineKm } from '../router/geo.ts'
import type {
  FareEntry,
  FarePromotion,
  FareRule,
  Landmark,
  Mode,
  RoundingRule,
  Route,
  RoutePack,
} from '../router/types.ts'
import { parseCsv, type CsvRecord } from './csv.ts'

// Builds a RoutePack from the team's CSV files (docs/DATA_COLLECTION.md) and
// reports everything missing or inconsistent. Pure: no file or network access.

export type PackFile = 'landmarks' | 'routes' | 'route_stops' | 'fares' | 'fare_matrix' | 'fare_promotions' | 'terminals'

export const PACK_HEADERS: Record<PackFile, string[]> = {
  landmarks: ['id', 'name', 'aliases', 'tags', 'lat', 'lon', 'note'],
  routes: ['id', 'mode', 'name', 'tags', 'fare_table_id', 'verified', 'verified_date', 'verified_by', 'note'],
  route_stops: ['route_id', 'seq', 'landmark_id', 'dist_km_from_prev', 'min_from_prev', 'min_from_prev_rush', 'method', 'measured_date', 'measured_by', 'note'],
  fares: ['id', 'mode', 'product', 'vehicle_class', 'rule', 'base_fare', 'base_km', 'per_km', 'effective_date', 'expires_at', 'rounding_rule', 'source_note', 'source_url', 'photo_ref', 'conflict_note'],
  fare_matrix: ['fare_entry_id', 'promotion_id', 'origin_id', 'destination_id', 'fare'],
  fare_promotions: ['fare_entry_id', 'id', 'label', 'eligibility', 'kind', 'value', 'effective_date', 'expires_at', 'source_url', 'source_note'],
  terminals: ['id', 'name', 'landmark_id', 'lat', 'lon', 'routes_served', 'verified_date', 'note'],
}

const REQUIRED: Record<PackFile, string[]> = {
  landmarks: ['id', 'name', 'lat', 'lon'],
  routes: ['id', 'mode', 'name', 'fare_table_id', 'verified'],
  route_stops: ['route_id', 'seq', 'landmark_id', 'dist_km_from_prev', 'min_from_prev'],
  fares: ['id', 'mode', 'product', 'vehicle_class', 'rule', 'effective_date', 'source_note', 'source_url'],
  fare_matrix: ['fare_entry_id', 'origin_id', 'destination_id', 'fare'],
  fare_promotions: ['fare_entry_id', 'id', 'label', 'eligibility', 'kind', 'effective_date', 'source_note', 'source_url'],
  terminals: ['id', 'name'],
}

const MODES: Mode[] = ['jeepney', 'modern_jeepney', 'uv', 'bus', 'train', 'walk']
const ROUNDING_RULES: RoundingRule[] = ['nearest_0.25', 'nearest_1', 'ceil_1', 'none']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** A stated hop this many times longer than the straight line gets a warning. */
const DETOUR_WARN_RATIO = 3
/** Slack for GPS noise when a stated hop is shorter than the straight line. */
const SHORT_HOP_TOLERANCE = 0.95

export interface PackIssue {
  level: 'error' | 'warning'
  file: PackFile
  /** Line in the CSV file, header is row 1. Absent for whole-file issues. */
  row?: number
  message: string
}

export interface TerminalEntry {
  id: string
  name: string
  landmarkId: string
  routesServed: string[]
}

export interface PackFromCsvResult {
  pack: RoutePack
  terminals: TerminalEntry[]
  issues: PackIssue[]
}

const splitList = (value: string) =>
  value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)

const isValidDate = (value: string) => {
  if (!ISO_DATE.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}

const isHttpsUrl = (value: string) => {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}
const fareMatrixKey = (fareEntryId: string) => JSON.stringify(['fare', fareEntryId])
const promotionMatrixKey = (fareEntryId: string, promotionId: string) => JSON.stringify(['promotion', fareEntryId, promotionId])

export function packFromCsv(
  files: Partial<Record<PackFile, string>>,
  meta: { id?: string; corridor?: string; version?: string } = {},
): PackFromCsvResult {
  const issues: PackIssue[] = []
  const error = (file: PackFile, message: string, row?: number) =>
    issues.push({ level: 'error', file, row, message })
  const warn = (file: PackFile, message: string, row?: number) =>
    issues.push({ level: 'warning', file, row, message })

  function load(file: PackFile): CsvRecord[] {
    const text = files[file]
    if (text === undefined) {
      error(file, `${file}.csv is missing`)
      return []
    }
    const table = parseCsv(text)
    const missing = REQUIRED[file].filter((header) => !table.headers.includes(header))
    if (missing.length > 0) {
      error(file, `missing column(s): ${missing.join(', ')}`)
      return []
    }
    if (table.records.length === 0) warn(file, 'no data rows')
    for (const record of table.records) {
      for (const header of REQUIRED[file]) {
        if (record.values[header] === '') error(file, `"${header}" is empty`, record.row)
      }
    }
    return table.records
  }

  function number(file: PackFile, record: CsvRecord, column: string): number {
    const raw = record.values[column]
    const value = raw === '' ? Number.NaN : Number(raw)
    if (raw !== '' && !Number.isFinite(value)) {
      error(file, `"${column}" is not a number: "${raw}"`, record.row)
    }
    return value
  }

  function requiredNumber(file: PackFile, record: CsvRecord, column: string): number {
    if (record.values[column] === '') {
      error(file, `"${column}" is required and must be a number`, record.row)
      return Number.NaN
    }
    return number(file, record, column)
  }

  function uniqueId(file: PackFile, record: CsvRecord, seen: Set<string>): string {
    const id = record.values.id
    if (id !== '' && seen.has(id)) error(file, `duplicate id "${id}"`, record.row)
    seen.add(id)
    return id
  }

  function mode(file: PackFile, record: CsvRecord): Mode {
    const value = record.values.mode
    if (value !== '' && !MODES.includes(value as Mode)) {
      error(file, `unknown mode "${value}" (use ${MODES.join(', ')})`, record.row)
    }
    return value as Mode
  }

  // --- landmarks ---
  const landmarkIds = new Set<string>()
  const landmarks: Landmark[] = load('landmarks').map((record) => {
    const lat = number('landmarks', record, 'lat')
    const lon = number('landmarks', record, 'lon')
    if (Number.isFinite(lat) && Math.abs(lat) > 90) error('landmarks', `lat out of range: ${lat}`, record.row)
    if (Number.isFinite(lon) && Math.abs(lon) > 180) error('landmarks', `lon out of range: ${lon}`, record.row)
    return {
      id: uniqueId('landmarks', record, landmarkIds),
      name: record.values.name,
      aliases: splitList(record.values.aliases ?? ''),
      tags: splitList(record.values.tags ?? ''),
      lat,
      lon,
    }
  })
  const landmarkById = new Map(landmarks.map((landmark) => [landmark.id, landmark]))

  // --- fares ---
  const matrices = new Map<string, Record<string, Record<string, number>>>()
  const matrixRows = load('fare_matrix')
  const matrixPairs = new Set<string>()
  for (const record of matrixRows) {
    const fareEntryId = record.values.fare_entry_id
    const promotionId = record.values.promotion_id ?? ''
    const key = promotionId ? promotionMatrixKey(fareEntryId, promotionId) : fareMatrixKey(fareEntryId)
    const originId = record.values.origin_id
    const destinationId = record.values.destination_id
    const pairKey = JSON.stringify([key, originId, destinationId])
    if (matrixPairs.has(pairKey)) error('fare_matrix', `duplicate origin/destination pair "${originId}" to "${destinationId}"`, record.row)
    matrixPairs.add(pairKey)
    const value = number('fare_matrix', record, 'fare')
    if (value < 0) error('fare_matrix', '"fare" is negative', record.row)
    const byOriginDestination = matrices.get(key) ?? Object.create(null) as Record<string, Record<string, number>>
    const byOrigin = Object.hasOwn(byOriginDestination, originId)
      ? byOriginDestination[originId]
      : Object.create(null) as Record<string, number>
    byOrigin[destinationId] = value
    byOriginDestination[originId] = byOrigin
    matrices.set(key, byOriginDestination)
  }

  const promotionIds = new Set<string>()
  const promotionRecords = new Map<string, { fareEntryId: string; promotion: FarePromotion }>()
  for (const record of load('fare_promotions')) {
    const fareEntryId = record.values.fare_entry_id
    const id = record.values.id
    if (promotionIds.has(id)) error('fare_promotions', `duplicate id "${id}"`, record.row)
    promotionIds.add(id)
    const effectiveDate = record.values.effective_date
    if (!isValidDate(effectiveDate)) error('fare_promotions', `"effective_date" must be YYYY-MM-DD, got "${effectiveDate}"`, record.row)
    const expiresAt = record.values.expires_at ?? ''
    if (expiresAt !== '' && (!isValidDate(expiresAt) || expiresAt < effectiveDate)) {
      error('fare_promotions', `"expires_at" must be on/after effective_date, got "${expiresAt}"`, record.row)
    }
    const eligibility = record.values.eligibility
    if (!['all', 'student', 'senior', 'pwd'].includes(eligibility)) {
      error('fare_promotions', `unknown eligibility "${eligibility}"`, record.row)
    }
    const kind = record.values.kind
    const sourceUrl = record.values.source_url
    const sourceNote = record.values.source_note
    if (!isHttpsUrl(sourceUrl)) error('fare_promotions', '"source_url" must be an HTTPS URL', record.row)
    if (sourceNote === '') error('fare_promotions', '"source_note" is required', record.row)
    let promotionRule: FarePromotion['rule']
    if (kind === 'percent_off') {
      const percent = requiredNumber('fare_promotions', record, 'value')
      if (percent < 0 || percent > 100) error('fare_promotions', '"value" must be between 0 and 100', record.row)
      promotionRule = { kind: 'percent_off', percent }
    } else if (kind === 'matrix') {
      const byOriginDestination = matrices.get(promotionMatrixKey(fareEntryId, id)) ?? {}
      if (Object.keys(byOriginDestination).length === 0) error('fare_promotions', `matrix promotion "${id}" has no fare_matrix rows`, record.row)
      promotionRule = { kind: 'matrix', byOriginDestination }
    } else {
      error('fare_promotions', `unknown kind "${kind}" (use percent_off or matrix)`, record.row)
      promotionRule = { kind: 'percent_off', percent: 0 }
    }
    promotionRecords.set(id, {
      fareEntryId,
      promotion: {
        id,
        label: record.values.label,
        eligibility: eligibility as FarePromotion['eligibility'],
        effectiveDate,
        ...(expiresAt ? { expiresAt } : {}),
        rule: promotionRule,
        ...(sourceUrl ? { sourceUrl } : {}),
        sourceNote,
      },
    })
  }

  const fareIds = new Set<string>()
  const fares: FareEntry[] = load('fares').map((record) => {
    const id = uniqueId('fares', record, fareIds)
    if (!isHttpsUrl(record.values.source_url)) error('fares', '"source_url" must be an HTTPS URL', record.row)
    if (record.values.product === '') error('fares', '"product" is required', record.row)
    if (record.values.vehicle_class === '') error('fares', '"vehicle_class" is required', record.row)
    if (record.values.source_note === '') error('fares', '"source_note" is required', record.row)
    const ruleKind = record.values.rule
    let fareRule: FareRule
    if (ruleKind === 'distance') {
      const baseFare = requiredNumber('fares', record, 'base_fare')
      const baseKm = requiredNumber('fares', record, 'base_km')
      const perKm = requiredNumber('fares', record, 'per_km')
      for (const [column, value] of [['base_fare', baseFare], ['base_km', baseKm], ['per_km', perKm]] as const) {
        if (value < 0) error('fares', `"${column}" is negative`, record.row)
      }
      const rounding = record.values.rounding_rule ?? ''
      if (rounding !== '' && !ROUNDING_RULES.includes(rounding as RoundingRule)) {
        error('fares', `unknown rounding_rule "${rounding}" (use ${ROUNDING_RULES.join(', ')})`, record.row)
      }
      if (rounding === '') warn('fares', 'rounding_rule is empty, router default nearest_0.25 applies', record.row)
      fareRule = { kind: 'distance', baseFare, baseKm, perKm, roundingRule: (rounding || 'nearest_0.25') as RoundingRule }
    } else if (ruleKind === 'matrix') {
      const byOriginDestination = matrices.get(fareMatrixKey(id)) ?? {}
      if (Object.keys(byOriginDestination).length === 0) error('fares', `matrix fare "${id}" has no fare_matrix rows`, record.row)
      fareRule = { kind: 'matrix', byOriginDestination }
    } else {
      error('fares', `unknown rule "${ruleKind}" (use distance or matrix)`, record.row)
      fareRule = { kind: 'distance', baseFare: 0, baseKm: 0, perKm: 0, roundingRule: 'nearest_0.25' }
    }
    const effectiveDate = record.values.effective_date
    if (!isValidDate(effectiveDate)) {
      error('fares', `"effective_date" must be YYYY-MM-DD, got "${effectiveDate}"`, record.row)
    }
    const expiresAt = record.values.expires_at ?? ''
    if (expiresAt !== '' && (!isValidDate(expiresAt) || expiresAt < effectiveDate)) {
      error('fares', `"expires_at" must be on/after effective_date, got "${expiresAt}"`, record.row)
    }
    if ((record.values.conflict_note ?? '') !== '') {
      warn('fares', `sources conflict: ${record.values.conflict_note}`, record.row)
    }
    return {
      id,
      mode: mode('fares', record),
      product: record.values.product,
      vehicleClass: record.values.vehicle_class,
      rule: fareRule,
      effectiveDate,
      ...(expiresAt ? { expiresAt } : {}),
      promotions: [...promotionRecords.values()]
        .filter((item) => item.fareEntryId === id)
        .map((item) => item.promotion),
      ...(record.values.source_url ? { sourceUrl: record.values.source_url } : {}),
      sourceNote: record.values.source_note,
    }
  })
  const fareById = new Map(fares.map((fare) => [fare.id, fare]))
  for (const item of promotionRecords.values()) {
    if (!fareById.has(item.fareEntryId)) error('fare_promotions', `fare_entry_id "${item.fareEntryId}" is not in fares.csv`)
  }
  for (const record of matrixRows) {
    const fareEntryId = record.values.fare_entry_id
    const promotionId = record.values.promotion_id ?? ''
    if (!fareById.has(fareEntryId)) error('fare_matrix', `fare_entry_id "${fareEntryId}" is not in fares.csv`, record.row)
    if (promotionId && promotionRecords.get(promotionId)?.fareEntryId !== fareEntryId) {
      error('fare_matrix', `promotion_id "${promotionId}" is not on fare_entry_id "${fareEntryId}"`, record.row)
    }
    if (!landmarkById.has(record.values.origin_id)) error('fare_matrix', `origin_id "${record.values.origin_id}" is not in landmarks.csv`, record.row)
    if (!landmarkById.has(record.values.destination_id)) error('fare_matrix', `destination_id "${record.values.destination_id}" is not in landmarks.csv`, record.row)
  }

  // --- route stops, grouped by route ---
  const stopsByRoute = new Map<string, { seq: number; record: CsvRecord }[]>()
  for (const record of load('route_stops')) {
    const routeId = record.values.route_id
    const list = stopsByRoute.get(routeId) ?? []
    list.push({ seq: number('route_stops', record, 'seq'), record })
    stopsByRoute.set(routeId, list)
  }

  // --- routes ---
  const routeIds = new Set<string>()
  const usedLandmarks = new Set<string>()
  const routes: Route[] = load('routes').map((record) => {
    const id = uniqueId('routes', record, routeIds)
    const routeMode = mode('routes', record)

    const verifiedRaw = record.values.verified.toLowerCase()
    if (verifiedRaw !== '' && verifiedRaw !== 'true' && verifiedRaw !== 'false') {
      error('routes', `"verified" must be true or false, got "${record.values.verified}"`, record.row)
    }
    const verified = verifiedRaw === 'true'
    if (verified && !isValidDate(record.values.verified_date ?? '')) {
      error('routes', 'verified is true but verified_date is missing or not YYYY-MM-DD', record.row)
    }
    if (verified && (record.values.verified_by ?? '') === '') {
      error('routes', 'verified is true but verified_by is empty', record.row)
    }
    if (!verified) warn('routes', `route "${id}" is not ride-verified`, record.row)

    const fare = fareById.get(record.values.fare_table_id)
    if (record.values.fare_table_id !== '' && !fare) {
      error('routes', `fare_table_id "${record.values.fare_table_id}" is not in fares.csv`, record.row)
    } else if (fare && fare.mode !== routeMode) {
      warn('routes', `route mode "${routeMode}" differs from fare table mode "${fare.mode}"`, record.row)
    }

    const stopRows = [...(stopsByRoute.get(id) ?? [])].sort((a, b) => a.seq - b.seq)
    if (stopRows.length < 2) error('routes', `route "${id}" has fewer than 2 stops in route_stops.csv`, record.row)
    const seenSeq = new Set<number>()
    const stops = stopRows.map(({ seq, record: stopRecord }, index) => {
      const row = stopRecord.row
      if (seenSeq.has(seq)) error('route_stops', `duplicate seq ${seq} on route "${id}"`, row)
      seenSeq.add(seq)

      const landmarkId = stopRecord.values.landmark_id
      const landmark = landmarkById.get(landmarkId)
      if (landmarkId !== '' && !landmark) {
        error('route_stops', `landmark_id "${landmarkId}" is not in landmarks.csv`, row)
      }
      usedLandmarks.add(landmarkId)

      const distKmFromPrev = number('route_stops', stopRecord, 'dist_km_from_prev')
      const minFromPrev = number('route_stops', stopRecord, 'min_from_prev')
      if (index === 0) {
        if (distKmFromPrev !== 0 || minFromPrev !== 0) {
          error('route_stops', 'first stop of a route must have distance 0 and minutes 0', row)
        }
      } else {
        if (!(distKmFromPrev > 0)) error('route_stops', '"dist_km_from_prev" must be greater than 0', row)
        if (!(minFromPrev > 0)) error('route_stops', '"min_from_prev" must be greater than 0', row)

        const previous = landmarkById.get(stopRows[index - 1].record.values.landmark_id)
        if (landmark && previous && distKmFromPrev > 0) {
          const straight = haversineKm(previous.lat, previous.lon, landmark.lat, landmark.lon)
          if (distKmFromPrev < straight * SHORT_HOP_TOLERANCE) {
            error(
              'route_stops',
              `stated ${distKmFromPrev} km is shorter than the straight line (${straight.toFixed(2)} km). Check distance or coordinates.`,
              row,
            )
          } else if (straight > 0.2 && distKmFromPrev > straight * DETOUR_WARN_RATIO) {
            warn(
              'route_stops',
              `stated ${distKmFromPrev} km is over ${DETOUR_WARN_RATIO}x the straight line (${straight.toFixed(2)} km). Confirm it.`,
              row,
            )
          }
        }
        const rush = stopRecord.values.min_from_prev_rush ?? ''
        if (rush !== '' && number('route_stops', stopRecord, 'min_from_prev_rush') < minFromPrev) {
          warn('route_stops', 'rush-hour minutes are lower than off-peak minutes', row)
        }
      }
      return { landmarkId, distKmFromPrev, minFromPrev }
    })

    const note = record.values.note ?? ''
    return {
      id,
      mode: routeMode,
      name: record.values.name,
      tags: splitList(record.values.tags ?? ''),
      stops,
      fareTableId: record.values.fare_table_id,
      verified,
      ...(note ? { note } : {}),
    }
  })

  for (const routeId of stopsByRoute.keys()) {
    if (!routeIds.has(routeId)) {
      const row = stopsByRoute.get(routeId)![0].record.row
      error('route_stops', `route_id "${routeId}" is not in routes.csv`, row)
    }
  }
  for (const landmark of landmarks) {
    if (!usedLandmarks.has(landmark.id)) {
      warn('landmarks', `landmark "${landmark.id}" is not a stop on any route`)
    }
  }
  for (const fare of fares) {
    if (!routes.some((route) => route.fareTableId === fare.id)) {
      warn('fares', `fare table "${fare.id}" is not used by any route`)
    }
  }

  // --- terminals ---
  const terminalIds = new Set<string>()
  const terminals: TerminalEntry[] = load('terminals').map((record) => {
    const landmarkId = record.values.landmark_id ?? ''
    if (landmarkId === '') {
      warn('terminals', 'no landmark_id, the terminal cannot be linked to a route stop', record.row)
    } else if (!landmarkById.has(landmarkId)) {
      error('terminals', `landmark_id "${landmarkId}" is not in landmarks.csv`, record.row)
    }
    const routesServed = splitList(record.values.routes_served ?? '')
    for (const routeId of routesServed) {
      if (!routeIds.has(routeId)) error('terminals', `routes_served "${routeId}" is not in routes.csv`, record.row)
    }
    if ((record.values.verified_date ?? '') === '') {
      warn('terminals', 'terminal has no verified_date (not checked on site)', record.row)
    }
    return { id: uniqueId('terminals', record, terminalIds), name: record.values.name, landmarkId, routesServed }
  })

  return {
    pack: {
      id: meta.id ?? 'csv-pack',
      corridor: meta.corridor ?? '',
      version: meta.version ?? '0.0.0',
      landmarks,
      routes,
      fares,
    },
    terminals,
    issues,
  }
}
