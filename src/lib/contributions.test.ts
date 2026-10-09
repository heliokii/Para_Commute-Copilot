import { describe, expect, it } from 'vitest'
import { parseImport, toCsv, toJson, type ContributionItem } from './contributions.ts'

const item = (overrides: Partial<ContributionItem['payload']> = {}, status = 'queued'): ContributionItem => ({
  createdAt: 1_790_000_000_000,
  status,
  payload: {
    uid: 'u-1',
    issue: 'fare',
    note: 'Mas mura raw, ₱12 lang.',
    originId: 'A',
    destinationId: 'F',
    routeIds: ['R1', 'R3'],
    packId: 'synthetic-pack',
    packVersion: '0.2.0-synthetic',
    fareAsOf: '2026-01-01',
    ...overrides,
  },
})

// What import returns: the same report, now marked as imported.
const imported = (source: ContributionItem) => ({ ...source, status: 'imported' })

describe('contribution files', () => {
  it('JSON round trip keeps every field', () => {
    const items = [item(), item({ uid: 'u-2', issue: 'gone', note: '', fareAsOf: null, routeIds: [] })]
    const result = parseImport(toJson(items))
    expect(result).toEqual({ items: items.map(imported), skipped: 0 })
  })

  it('CSV round trip keeps every field, including commas, quotes and line breaks in a note', () => {
    const items = [
      item({ note: 'Sabi ng driver: "₱15", hindi ₱13,\nlinya ito' }),
      item({ uid: 'u-2', issue: 'other', note: '', fareAsOf: null, routeIds: [] }),
    ]
    const result = parseImport(toCsv(items))
    expect(result).toEqual({ items: items.map(imported), skipped: 0 })
  })

  it('CSV: a note that starts like a spreadsheet formula is quoted in the file and restored on import', () => {
    const items = [item({ note: '=HYPERLINK("http://x","hi")' }), item({ uid: 'u-2', note: '+1' }), item({ uid: 'u-3', note: '-5' }), item({ uid: 'u-4', note: '@sum' }), item({ uid: 'u-5', note: "'=already quoted" })]
    const csv = toCsv(items)
    for (const line of csv.split('\r\n').slice(1)) expect(line).not.toMatch(/,[=+\-@]/)
    expect(csv).toContain("'=HYPERLINK")
    expect(parseImport(csv).items.map((entry) => entry.payload.note)).toEqual(items.map((entry) => entry.payload.note))
  })

  it('refuses a file that is not ours', () => {
    expect(parseImport('').error).toBe('empty')
    expect(parseImport('hello world').error).toBe('format')
    expect(parseImport('{"format":"something-else","items":[]}').error).toBe('format')
    expect(parseImport('{not json').error).toBe('format')
    expect(parseImport(toJson([])).error).toBe('empty')
  })

  it('skips rows that fail validation and counts them', () => {
    const good = item()
    const bad = [
      item({ uid: '' }),
      item({ issue: 'nope' as never }),
      item({ note: 'x'.repeat(501) }),
      { ...item(), createdAt: Number.NaN },
      item({ routeIds: 'R1' as never }),
    ]
    const result = parseImport(toJson([good, ...bad]))
    expect(result.items).toHaveLength(1)
    expect(result.skipped).toBe(bad.length)
  })

  it('never takes status or extra fields from a file', () => {
    const file = JSON.parse(toJson([item()]))
    file.items[0].status = 'exported'
    file.items[0].payload.admin = true
    const [entry] = parseImport(JSON.stringify(file)).items
    expect(entry.status).toBe('imported')
    expect(entry.payload).not.toHaveProperty('admin')
  })

  it('refuses a file with too many reports', () => {
    const many = Array.from({ length: 1001 }, (_, index) => item({ uid: `u-${index}` }))
    expect(parseImport(toJson(many)).error).toBe('too_many')
  })
})
