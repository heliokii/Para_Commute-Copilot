// Usage: npm run validate:pack [dir]   (default: data/pack)
// Loads the route pack CSVs and reports missing or inconsistent data.
// Exit code 1 if there are errors. Needs Node 24+ (imports TypeScript directly).
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkPackDir, printPackCheck } from './lib/packCheck.mjs'

const dir = resolve(process.argv[2] ?? 'data/pack')
if (!existsSync(dir)) {
  console.error(`Folder not found: ${dir}`)
  console.error('Copy data/templates to data/pack, fill it in, then run this again.')
  process.exit(1)
}

const result = checkPackDir(dir)
printPackCheck(dir, result)
process.exit(result.errors.length > 0 ? 1 : 0)
