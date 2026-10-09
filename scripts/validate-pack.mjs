// Usage: npm run validate:pack [dir]   (default: data/pack)
// Loads the route pack CSVs and reports missing or inconsistent data.
// Exit code 1 if there are errors. Needs Node 24+ (imports TypeScript directly).
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PACK_HEADERS, packFromCsv } from '../src/pack/packFromCsv.ts'
import { isInsideNcr, readNcrBoundary } from '../src/pack/ncrGeometry.ts'

const dir = resolve(process.argv[2] ?? 'data/pack')
if (!existsSync(dir)) {
  console.error(`Folder not found: ${dir}`)
  console.error('Copy data/templates to data/pack, fill it in, then run this again.')
  process.exit(1)
}

const files = {}
for (const name of Object.keys(PACK_HEADERS)) {
  const path = join(dir, `${name}.csv`)
  if (existsSync(path)) files[name] = readFileSync(path, 'utf8')
}

const { pack, terminals, issues } = packFromCsv(files)
const errors = issues.filter((issue) => issue.level === 'error')
const warnings = issues.filter((issue) => issue.level === 'warning')
const boundaryPath = join(dir, 'ncr_boundary.geojson')
if (!existsSync(boundaryPath)) {
  errors.push({ file: 'landmarks', message: 'ncr_boundary.geojson is required for NCR geometry validation' })
} else {
  let boundary
  try { boundary = readNcrBoundary(JSON.parse(readFileSync(boundaryPath, 'utf8'))) } catch {}
  if (!boundary) errors.push({ file: 'landmarks', message: 'ncr_boundary.geojson must contain a Polygon or MultiPolygon' })
  else {
    for (const landmark of pack.landmarks) {
      if (!isInsideNcr([landmark.lon, landmark.lat], boundary)) {
        errors.push({ file: 'landmarks', message: `landmark "${landmark.id}" is outside the NCR boundary` })
      }
    }
  }
}

console.log(`Route pack in ${dir}`)
console.log(
  `  landmarks ${pack.landmarks.length}, routes ${pack.routes.length}, fare tables ${pack.fares.length}, terminals ${terminals.length}`,
)
console.log(
  `  ride-verified routes ${pack.routes.filter((route) => route.verified).length} of ${pack.routes.length}`,
)

for (const [label, list] of [['ERROR', errors], ['WARN ', warnings]]) {
  for (const issue of list) {
    const where = issue.row ? `${issue.file}.csv row ${issue.row}` : `${issue.file}.csv`
    console.log(`${label} ${where}: ${issue.message}`)
  }
}

console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`)
process.exit(errors.length > 0 ? 1 : 0)
