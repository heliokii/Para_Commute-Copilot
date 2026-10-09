import { db, type Contribution } from '../db/db.ts'
import { useLive } from '../lib/useLive.ts'
import { parseImport, toCsv, toJson, type ContributionItem, type ContributionPayload } from '../lib/contributions.ts'

// The contribution queue: "May mali ba?" reports kept on this device. There is
// no sync. "Sync now" is an export: the rider makes a file and hands it over.

export const CONTRIBUTION_TYPE = 'route_issue'

const allContributions = () => db.contributions.orderBy('createdAt').reverse().toArray()

export function useContributions(): Contribution[] {
  return useLive(allContributions, [])
}

export async function addContribution(payload: Omit<ContributionPayload, 'uid'>): Promise<void> {
  await db.contributions.add({
    type: CONTRIBUTION_TYPE,
    status: 'queued',
    createdAt: Date.now(),
    payload: { ...payload, uid: crypto.randomUUID() },
  } as Contribution)
}

function asItem(row: Contribution): ContributionItem {
  return { createdAt: row.createdAt, status: row.status, payload: row.payload as ContributionPayload }
}

/** Rows that are really reports. Anything else in the table is left out of files. */
const reports = (rows: Contribution[]) =>
  rows.filter((row) => row.type === CONTRIBUTION_TYPE && typeof (row.payload as ContributionPayload | undefined)?.uid === 'string')

export interface ExportedFile {
  filename: string
  mime: string
  text: string
  count: number
}

/** Builds the file and marks queued reports as exported. "Exported" means a file was made, not that anyone received it. */
export async function exportContributions(format: 'json' | 'csv'): Promise<ExportedFile> {
  const rows = reports(await allContributions())
  const items = rows.map(asItem)
  const day = new Date().toISOString().slice(0, 10)
  await db.contributions.bulkPut(rows.filter((row) => row.status === 'queued').map((row) => ({ ...row, status: 'exported' })))
  return format === 'json'
    ? { filename: `para-ambag-${day}.json`, mime: 'application/json', text: toJson(items), count: items.length }
    : { filename: `para-ambag-${day}.csv`, mime: 'text/csv', text: toCsv(items), count: items.length }
}

export interface ImportSummary {
  added: number
  duplicates: number
  skipped: number
  error?: 'empty' | 'format' | 'too_many'
}

/** Adds reports from a team file. A report whose uid is already here is not added twice. */
export async function importContributions(text: string): Promise<ImportSummary> {
  const parsed = parseImport(text)
  if (parsed.error) return { added: 0, duplicates: 0, skipped: 0, error: parsed.error }
  const known = new Set(reports(await allContributions()).map((row) => (row.payload as ContributionPayload).uid))
  const fresh: ContributionItem[] = []
  for (const item of parsed.items) {
    if (known.has(item.payload.uid)) continue
    known.add(item.payload.uid)
    fresh.push(item)
  }
  await db.contributions.bulkAdd(fresh.map((item) => ({ type: CONTRIBUTION_TYPE, status: item.status, createdAt: item.createdAt, payload: item.payload }) as Contribution))
  return { added: fresh.length, duplicates: parsed.items.length - fresh.length, skipped: parsed.skipped }
}

/** Hands text to the browser as a file download. Nothing is sent anywhere. */
export function saveFile(file: ExportedFile) {
  const url = URL.createObjectURL(new Blob([file.text], { type: `${file.mime};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
