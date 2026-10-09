// Usage: npm run build && npm run check:migrate
// Proves the Dexie version 2 migration on a POPULATED version 1 database.
// A version 1 "ParaDB" is written with the raw IndexedDB API (exactly the schema the
// submission build declared), on a page of the app's own origin that does not run
// the app. Then the production build opens it. Every old row must survive and the
// two new tables must exist.
import { existsSync } from 'node:fs'
import { preview } from 'vite'
import { createReport, launch } from './lib/browser.mjs'

const PORT = 4176
const BASE = `http://localhost:${PORT}/`

if (!existsSync('dist/sw.js')) {
  console.error('dist/sw.js not found. Run "npm run build" first.')
  process.exit(1)
}

const { check, finish } = createReport()
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' })
const browser = await launch()

try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))

  // robots.txt is a plain file on the app's origin: it runs no app code and registers no service worker.
  await page.goto(`${BASE}robots.txt`)
  const v1 = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('ParaDB', 10) // Dexie version 1 is IndexedDB version 10
        request.onupgradeneeded = () => {
          const idb = request.result
          const store = (name, keyPath, autoIncrement, indexes) => {
            const created = idb.createObjectStore(name, { keyPath, autoIncrement })
            for (const index of indexes) created.createIndex(index, index)
          }
          store('routePacks', 'id', false, ['corridor', 'version'])
          store('routes', 'id', true, ['packId', 'mode', 'name'])
          store('landmarks', 'id', true, ['packId', 'name', 'lat', 'lon'])
          store('terminals', 'id', true, ['packId', 'name'])
          store('fares', 'id', true, ['mode', 'effectiveDate'])
          store('contributions', 'id', true, ['type', 'status', 'createdAt'])
        }
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const idb = request.result
          const tx = idb.transaction(idb.objectStoreNames, 'readwrite')
          // An older sample pack: the app's own seeding (unchanged since Phase 2) replaces the pack tables
          // when the version differs. Terminals and contributions are never touched by it, so those rows
          // are what the migration itself must keep.
          tx.objectStore('routePacks').put({ id: 'synthetic-pack', corridor: 'SYNTHETIC corridor', version: '0.0.0-v1', note: 'v1 row' })
          tx.objectStore('landmarks').add({ packId: 'synthetic-pack', name: 'V1 Landmark', aliases: [], tags: [], lat: 0, lon: 0, id: 1 })
          tx.objectStore('terminals').add({ packId: 'synthetic-pack', name: 'V1 Terminal A' })
          tx.objectStore('terminals').add({ packId: 'synthetic-pack', name: 'V1 Terminal B' })
          tx.objectStore('contributions').add({ type: 'route_issue', status: 'queued', createdAt: 1_790_000_000_000, payload: { note: 'v1 report' } })
          tx.oncomplete = () => {
            const info = { version: idb.version, stores: [...idb.objectStoreNames].sort() }
            idb.close()
            resolve(info)
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  check('Fixture: a populated version 1 database was written (IndexedDB version 10, six tables)', v1.version === 10 && v1.stores.length === 6, JSON.stringify(v1))

  // The plain-text page asked for a favicon that does not exist; only errors from the app count.
  errors.length = 0

  // Now the app opens it.
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.waitForSelector('#root > *', { timeout: 30000 })
  const after = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('ParaDB')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const idb = request.result
          const stores = [...idb.objectStoreNames].sort()
          const read = (name) =>
            new Promise((done) => {
              const query = idb.transaction(name).objectStore(name).getAll()
              query.onsuccess = () => done(query.result)
            })
          Promise.all(['terminals', 'contributions', 'landmarks', 'routePacks', 'favorites', 'settings'].map(read)).then(([terminals, contributions, landmarks, routePacks, favorites, settings]) => {
            const info = { version: idb.version, stores, terminals, contributions, landmarks, routePacks, favorites, settings }
            idb.close()
            resolve(info)
          })
        }
      }),
  )

  check('Migrated to IndexedDB version 20 (Dexie version 2)', after.version === 20, String(after.version))
  check(
    'The two new tables exist next to the six old ones',
    after.stores.join(',') === 'contributions,fares,favorites,landmarks,routePacks,routes,settings,terminals',
    after.stores.join(','),
  )
  check('Old rows survived: both terminals', after.terminals.map((row) => row.name).join('|') === 'V1 Terminal A|V1 Terminal B', JSON.stringify(after.terminals))
  check(
    'Old rows survived: the queued report keeps its payload and status',
    after.contributions.length === 1 && after.contributions[0].status === 'queued' && after.contributions[0].payload?.note === 'v1 report',
    JSON.stringify(after.contributions),
  )
  check('The v1 pack was refreshed by the existing seeding, as in every earlier release', after.routePacks.length === 1 && after.routePacks[0].version === '0.2.0-synthetic' && after.landmarks.length === 8, JSON.stringify(after.routePacks))
  check('New tables start empty', after.favorites.length === 0 && after.settings.length === 0)

  // A second open needs no upgrade and must keep everything.
  await page.reload({ waitUntil: 'networkidle0' })
  const again = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('ParaDB')
        request.onsuccess = () => {
          const idb = request.result
          const query = idb.transaction('terminals').objectStore('terminals').count()
          query.onsuccess = () => {
            const info = { version: idb.version, terminals: query.result }
            idb.close()
            resolve(info)
          }
        }
      }),
  )
  check('Opening the migrated database again changes nothing', again.version === 20 && again.terminals === 2, JSON.stringify(again))
  check('No console errors during the migration', errors.length === 0, errors.join(' | '))
} catch (error) {
  check('Migration check ran to completion', false, error.message)
} finally {
  await browser.close()
  await new Promise((resolve) => {
    server.httpServer.closeAllConnections?.()
    server.httpServer.close(resolve)
  })
}

finish()
