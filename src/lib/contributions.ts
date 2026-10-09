import { parseCsv } from '../pack/csv.ts'

// The contribution queue's file formats. Pure functions: export and import of
// "May mali ba?" reports as JSON or CSV. Nothing here touches the network.

export const ISSUES = ['fare', 'route', 'time', 'gone', 'other'] as const
export type Issue = (typeof ISSUES)[number]

export const NOTE_MAX = 500
const ID_MAX = 80
const IMPORT_MAX_ITEMS = 1000

export interface ContributionPayload {
  /** Random id made when the report is saved. Import skips a report whose uid it already has. */
  uid: string
  issue: Issue
  note: string
  originId: string
  destinationId: string
  routeIds: string[]
  packId: string
  packVersion: string
  fareAsOf: string | null
}

export interface ContributionItem {
  createdAt: number
  status: string
  payload: ContributionPayload
}

export const JSON_FORMAT = 'para-contributions'
const CSV_HEADERS = ['uid', 'createdAt', 'status', 'issue', 'note', 'originId', 'destinationId', 'routeIds', 'packId', 'packVersion', 'fareAsOf']

export function toJson(items: readonly ContributionItem[], now = Date.now()): string {
  return JSON.stringify({ format: JSON_FORMAT, version: 1, exportedAt: now, items }, null, 2)
}

// A spreadsheet runs a cell that starts with one of these as a formula. Prefix a
// quote so a note can never do that; import takes the quote off again.
const FORMULA_START = /^'*[=+\-@\t\r]/
const GUARDED = /^'+[=+\-@\t\r]/

function cell(value: string): string {
  const guarded = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded
}

export function toCsv(items: readonly ContributionItem[]): string {
  const rows = items.map(({ createdAt, status, payload }) =>
    [payload.uid, String(createdAt), status, payload.issue, payload.note, payload.originId, payload.destinationId, payload.routeIds.join(';'), payload.packId, payload.packVersion, payload.fareAsOf ?? ''].map(cell).join(','),
  )
  return [CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n'
}

export interface ImportResult {
  items: ContributionItem[]
  /** Rows that were not valid and were left out. */
  skipped: number
  /** Set when the whole file was refused. */
  error?: 'empty' | 'format' | 'too_many'
}

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max

function validate(raw: unknown): ContributionItem | null {
  const item = raw as { createdAt?: unknown; status?: unknown; payload?: Record<string, unknown> } | null
  const payload = item?.payload
  if (!item || !payload || typeof payload !== 'object') return null
  const routeIds = payload.routeIds
  if (!isText(payload.uid, ID_MAX) || payload.uid === '') return null
  if (!ISSUES.includes(payload.issue as Issue)) return null
  if (!isText(payload.note, NOTE_MAX)) return null
  if (!isText(payload.originId, ID_MAX) || !isText(payload.destinationId, ID_MAX)) return null
  if (!Array.isArray(routeIds) || routeIds.length > 20 || !routeIds.every((id) => isText(id, ID_MAX))) return null
  if (!isText(payload.packId, ID_MAX) || !isText(payload.packVersion, ID_MAX)) return null
  if (payload.fareAsOf !== null && !isText(payload.fareAsOf, 20)) return null
  if (typeof item.createdAt !== 'number' || !Number.isFinite(item.createdAt)) return null
  return {
    createdAt: item.createdAt,
    status: 'imported',
    payload: {
      uid: payload.uid,
      issue: payload.issue as Issue,
      note: payload.note,
      originId: payload.originId,
      destinationId: payload.destinationId,
      routeIds: routeIds as string[],
      packId: payload.packId,
      packVersion: payload.packVersion,
      fareAsOf: payload.fareAsOf as string | null,
    },
  }
}

function fromRows(rows: readonly unknown[]): ImportResult {
  if (rows.length === 0) return { items: [], skipped: 0, error: 'empty' }
  if (rows.length > IMPORT_MAX_ITEMS) return { items: [], skipped: 0, error: 'too_many' }
  const items = rows.map(validate).filter((item): item is ContributionItem => item !== null)
  return { items, skipped: rows.length - items.length }
}

/** Reads a JSON or CSV file made by `toJson` or `toCsv`. Anything that does not check out is skipped, never trusted. */
export function parseImport(text: string): ImportResult {
  const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim()
  if (trimmed === '') return { items: [], skipped: 0, error: 'empty' }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed) as { format?: unknown; items?: unknown }
      if (data.format !== JSON_FORMAT || !Array.isArray(data.items)) return { items: [], skipped: 0, error: 'format' }
      return fromRows(data.items)
    } catch {
      return { items: [], skipped: 0, error: 'format' }
    }
  }

  const table = parseCsv(trimmed)
  if (!['uid', 'issue', 'note', 'createdAt'].every((header) => table.headers.includes(header))) return { items: [], skipped: 0, error: 'format' }
  return fromRows(
    table.records.map(({ values }) => ({
      createdAt: Number(values.createdAt),
      payload: {
        uid: values.uid,
        issue: values.issue,
        // parseCsv trims cells, so a note's own outer spaces are not kept. Guard quotes come off here.
        note: GUARDED.test(values.note) ? values.note.slice(1) : values.note,
        originId: values.originId,
        destinationId: values.destinationId,
        routeIds: values.routeIds ? values.routeIds.split(';') : [],
        packId: values.packId,
        packVersion: values.packVersion,
        fareAsOf: values.fareAsOf === '' ? null : values.fareAsOf,
      },
    })),
  )
}
