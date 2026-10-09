// Usage: npm run import:ncr [-- --init] [-- --root <dir>]
// Builds the Metro Manila route pack from the sourced stop inventory and the
// team's field worksheets. Needs Node 24+ (imports TypeScript directly).
//
//   --init        only create or refresh the worksheets in <root>/field. Filled cells are kept.
//   --root <dir>  data folder (default data/metro-manila). With another root the
//                 bundled pack is written to <root>/generated-pack.json, not into src/.
//
// A route is imported only when every stop has coordinates and every segment a
// measured distance and time. The app switches to the result only when it has
// routes and passes the same checks as "npm run validate:pack", including
// <root>/pack/ncr_boundary.geojson. Otherwise the bundled pack is written empty
// and the app keeps the sample pack. Exit code 1 when nothing was activated.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildPackFiles, worksheets, WORKSHEET_HEADERS } from '../src/pack/fromInventory.ts'
import { checkPackDir, printPackCheck } from './lib/packCheck.mjs'

const DEFAULT_ROOT = 'data/metro-manila'
const INVENTORY = 'data/metro-manila/source-assets/qcity-bus-stop-inventory-2026-10-10.json'
const PACK_ID = 'metro-manila'
const CORRIDOR = 'Metro Manila: Q City Bus'

const args = process.argv.slice(2)
const rootArg = args.indexOf('--root')
const root = resolve(rootArg === -1 ? DEFAULT_ROOT : args[rootArg + 1])
const fieldDir = join(root, 'field')
const packDir = join(root, 'pack')
const bundlePath = root === resolve(DEFAULT_ROOT) ? resolve('src/db/generated/metro-manila-pack.json') : join(root, 'generated-pack.json')

const inventory = JSON.parse(readFileSync(INVENTORY, 'utf8'))
const sheetNames = Object.keys(WORKSHEET_HEADERS)

// Worksheets first: new stops from the inventory are added, filled cells stay.
mkdirSync(fieldDir, { recursive: true })
const existing = {}
for (const name of sheetNames) {
  const path = join(fieldDir, `${name}.csv`)
  if (existsSync(path)) existing[name] = readFileSync(path, 'utf8')
}
const sheets = worksheets(inventory, existing)
for (const name of sheetNames) {
  if (sheets[name] !== existing[name]) writeFileSync(join(fieldDir, `${name}.csv`), sheets[name])
}
console.log(`Worksheets in ${fieldDir}`)
if (args.includes('--init')) process.exit(0)

const result = buildPackFiles(inventory, sheets)
mkdirSync(packDir, { recursive: true })
for (const [name, text] of Object.entries(result.files)) writeFileSync(join(packDir, `${name}.csv`), text)

console.log(`\nImported ${result.emitted.length} route(s): ${result.emitted.join(', ') || 'none'}`)
for (const item of result.skipped) console.log(`SKIP  ${item.routeId}: ${item.reason}`)
console.log('')

// The version changes whenever a measurement does, so the app reseeds.
const digest = createHash('sha256').update(JSON.stringify(result.files)).digest('hex').slice(0, 8)
const meta = { id: PACK_ID, corridor: CORRIDOR, version: `${inventory.capturedAt}-${digest}` }
const check = checkPackDir(packDir, meta)
printPackCheck(packDir, check)

const active = check.errors.length === 0 && check.pack.routes.length > 0
const bundle = active ? check.pack : { id: PACK_ID, corridor: CORRIDOR, version: 'empty', landmarks: [], routes: [], fares: [] }
mkdirSync(resolve(bundlePath, '..'), { recursive: true })
writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`)
console.log(
  active
    ? `\nActivated: ${bundlePath} now holds ${bundle.routes.length} route(s). Rebuild the app.`
    : `\nNot activated: ${bundlePath} is empty and the app keeps the sample pack.`,
)
process.exit(active ? 0 : 1)
