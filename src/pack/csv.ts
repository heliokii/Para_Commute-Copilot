/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  // Drop a leading byte-order mark (Excel adds one).
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

export interface CsvRecord {
  /** 1-based line of the record in the file, header is row 1. */
  row: number
  values: Record<string, string>
}

export interface CsvTable {
  headers: string[]
  records: CsvRecord[]
}

export function parseCsv(text: string): CsvTable {
  const [headerRow, ...dataRows] = parseCsvRows(text)
  const headers = (headerRow ?? []).map((header) => header.trim())
  const records = dataRows.map((cells, index) => ({
    row: index + 2,
    values: Object.fromEntries(headers.map((header, col) => [header, (cells[col] ?? '').trim()])),
  }))
  return { headers, records }
}
