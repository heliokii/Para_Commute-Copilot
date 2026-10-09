// Shared by validate-pack.mjs and import-metro-manila-pack.mjs: loads the route
// pack CSVs in a folder and returns everything missing or inconsistent.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PACK_HEADERS, packFromCsv } from '../../src/pack/packFromCsv.ts'
import { isInsideNcr, readNcrBoundary } from '../../src/pack/ncrGeometry.ts'

export function checkPackDir(dir, meta) {
  const files = {}
  for (const name of Object.keys(PACK_HEADERS)) {
    const path = join(dir, `${name}.csv`)
    if (existsSync(path)) files[name] = readFileSync(path, 'utf8')
  }

  const { pack, terminals, issues } = packFromCsv(files, meta)
  const errors = issues.filter((issue) => issue.level === 'error')
  const warnings = issues.filter((issue) => issue.level === 'warning')
  const boundaryPath = join(dir, 'ncr_boundary.geojson')
  if (!existsSync(boundaryPath)) {
    errors.push({ file: 'landmarks', message: 'ncr_boundary.geojson is required for NCR geometry validation' })
  } else {
    let boundary = null
    try { boundary = readNcrBoundary(JSON.parse(readFileSync(boundaryPath, 'utf8'))) } catch { /* reported below */ }
    if (!boundary) errors.push({ file: 'landmarks', message: 'ncr_boundary.geojson must be a GeoJSON Feature or FeatureCollection named NCR (for example properties.name "NCR") with a Polygon or MultiPolygon' })
    else {
      for (const landmark of pack.landmarks) {
        if (!isInsideNcr([landmark.lon, landmark.lat], boundary)) {
          errors.push({ file: 'landmarks', message: `landmark "${landmark.id}" is outside the NCR boundary` })
        }
      }
    }
  }
  return { pack, terminals, errors, warnings }
}

export function printPackCheck(dir, { pack, terminals, errors, warnings }) {
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
}
