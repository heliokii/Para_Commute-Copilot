// Usage: npm run build && npm run check:offline
// Serves dist/, then checks in headless Chrome that the app works with the
// network off and with the server stopped. Exit code 1 on any failure.
// Set CHROME_PATH if Chrome or Edge is not in a default location.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'
import { findChrome } from './lib/browser.mjs'

const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const OFFLINE = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }

const chromePath = findChrome()
if (!existsSync('dist/sw.js')) {
  console.error('dist/sw.js not found. Run "npm run build" first.')
  process.exit(1)
}

const results = []
const check = (name, pass, detail = '') => results.push({ name, pass: Boolean(pass), detail })

// Dev-only code must not ship.
const distJs = readdirSync('dist/assets')
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(join('dist/assets', file), 'utf8'))
  .join('\n')
check(
  'Production build has no dev screens',
  !distJs.includes('Router harness (dev only)') &&
    !distJs.includes('Components (dev only)') &&
    !distJs.includes('Model benchmark (dev only)'),
)

const mascotBytes = readdirSync('dist/mascot').reduce((sum, file) => sum + statSync(join('dist/mascot', file)).size, 0)
check('Mascot assets under 1 MB', mascotBytes < 1024 * 1024, `${(mascotBytes / 1024).toFixed(0)} KiB`)

// The lazy WebLLM runtime chunk is large by nature and only loads when the model is used.
// It is reported on its own; the shell budget covers everything else.
const precached = [...readFileSync('dist/sw.js', 'utf8').matchAll(/url:"([^"]+)"/g)].map((match) => ({
  url: match[1],
  size: statSync(join('dist', match[1])).size,
}))
const runtimeChunks = precached.filter((entry) => entry.url.endsWith('.js') && entry.size > 2 * 1024 * 1024)
const shellBytes = precached.filter((entry) => !runtimeChunks.includes(entry)).reduce((sum, entry) => sum + entry.size, 0)
const runtimeBytes = runtimeChunks.reduce((sum, entry) => sum + entry.size, 0)
check('App shell precache under 2 MB', shellBytes < 2 * 1024 * 1024, `${(shellBytes / 1024).toFixed(0)} KiB`)
check(
  'AI runtime chunk is precached for offline use, and is the only large chunk',
  runtimeChunks.length === 1,
  `${runtimeChunks.map((entry) => entry.url).join(', ')} ${(runtimeBytes / 1024).toFixed(0)} KiB`,
)
check(
  'No Web Speech API in the bundle',
  !/webkitSpeechRecognition|(?<![A-Za-z])SpeechRecognition\b/.test(distJs),
)
check(
  'No cloud AI endpoint in the bundle',
  !/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/.test(distJs),
)

const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' })
const browser = await puppeteer.launch({ executablePath: chromePath, headless: true })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

  const consoleErrors = []
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()))
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  // --- First load, online ---
  const firstLoad = []
  page.on('request', (request) => firstLoad.push(request.url()))
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  const thirdParty = firstLoad.filter((url) => !url.startsWith(BASE) && !url.startsWith('data:'))
  check('First load: no third-party requests', thirdParty.length === 0, thirdParty.join(', '))

  const sw = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.active?.state
  })
  check('Service worker registers and activates', sw === 'activated' || sw === 'activating', sw)

  await page.reload({ waitUntil: 'networkidle0' })
  check('Service worker controls the page', await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]')?.getAttribute('href')
    return (await fetch(href)).json()
  })
  check(
    'Manifest: standalone, start_url "/", theme color, icons',
    manifest.display === 'standalone' && manifest.start_url === '/' && manifest.theme_color && manifest.icons.length >= 2,
  )

  // --- Network off (page and service worker) ---
  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', OFFLINE)
  for (const target of browser.targets()) {
    if (target.type() !== 'service_worker') continue
    const session = await target.createCDPSession()
    await session.send('Network.enable')
    await session.send('Network.emulateNetworkConditions', OFFLINE)
  }

  const fromNetwork = []
  const failed = []
  page.on('response', (response) => {
    if (!response.fromServiceWorker() && !response.fromCache()) fromNetwork.push(response.url())
  })
  page.on('requestfailed', (request) => failed.push(`${request.url()} ${request.failure()?.errorText}`))

  await page.reload({ waitUntil: 'networkidle0' })
  await page.keyboard.press('Escape') // skip the splash
  const home = await page.evaluate(() => ({
    text: document.body.innerText,
    pill: document.querySelector('main:not([hidden]) [role=status]')?.textContent ?? '',
    mascot: [...document.images].filter((image) => image.src.includes('/mascot/') && image.naturalWidth > 0).length,
  }))
  check('Offline reload: Home renders', home.text.includes('Kumusta!') && home.text.includes('Saan ka papunta?'))
  check('Offline: status pill shows Offline', home.pill === 'Offline', home.pill)
  check('Offline: mascot images load from cache', home.mascot > 0, String(home.mascot))

  await page.evaluate(() => {
    location.hash = '#/offline'
  })
  await page.waitForSelector('[data-testid=bytes-sent]', { timeout: 5000 })
  const bytes = await page.$eval('[data-testid=bytes-sent]', (element) => element.textContent)
  check('Offline Mode screen: bytes sent is 0 and labeled app-measured', bytes.includes('Bytes sent: 0 (sukat ng app)'), bytes)
  check('Offline: every response served by service worker or cache', fromNetwork.length === 0, fromNetwork.join(', '))
  check('Offline: no failed requests', failed.length === 0, failed.join(' | '))
  check(
    'Offline: self-hosted fonts loaded',
    await page.evaluate(() => document.fonts.check('16px "Inter Variable"') && document.fonts.check('600 16px "Fredoka Variable"')),
  )

  // --- Proof panel: every row is read from the running app ---
  await page.waitForFunction(
    () => document.querySelector('[data-testid=proof-sw]')?.dataset.ok === 'true' && document.querySelector('[data-testid=proof-pack]')?.dataset.ok === 'true',
    { timeout: 10000, polling: 200 },
  ).catch(() => {})
  const proof = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-testid^=proof-]')].map((row) => [
        row.dataset.testid.replace('proof-', ''),
        { ok: row.dataset.ok, text: row.innerText.replace(/\s+/g, ' ') },
      ]),
    ),
  )
  check('Proof: service worker row is true because a worker controls the page', proof.sw?.ok === 'true', proof.sw?.text)
  check('Proof: route pack row shows the loaded version and fare date', proof.pack?.ok === 'true' && /Bersyon 0\.\d+\.\d+-synthetic/.test(proof.pack.text) && /as of \d{4}-\d{2}-\d{2}/.test(proof.pack.text), proof.pack?.text)
  check('Proof: AI row is not ticked when no model is installed', proof.model?.ok === 'false' && /Hindi pa naka-install|Walang WebGPU/.test(proof.model.text), proof.model?.text)
  check('Proof: no inference is claimed before one happens', proof.inference?.ok === 'null', proof.inference?.text)
  check('Proof: zero requests to other servers, counted by the browser', proof['cross-origin']?.ok === 'true' && / 0 /.test(proof['cross-origin'].text + ' '), proof['cross-origin']?.text)

  // --- Local data, still offline ---
  await page.evaluate(() => {
    location.hash = '#/about'
  })
  await page.waitForFunction(() => document.body.innerText.includes('On this device'), { timeout: 5000 })
  const about = await page.evaluate(() => document.body.innerText)
  check('Offline: About lists libraries and the sample-data label', about.includes('dexie') && about.includes('SAMPLE DATA, not verified'))
  check('About: shows the route pack version, fare date and model licences', /Route pack: synthetic-pack, bersyon/.test(about) && /Pamasahe as of \d{4}-\d{2}-\d{2}/.test(about) && about.includes('Apache-2.0'))
  check('Mascot is named Tsupher, never "Kuya Para"', !/kuya para/i.test(home.text + about) && home.text.includes('Tsupher'))

  const local = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('ParaDB')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const idb = open.result
          const stores = [...idb.objectStoreNames]
          const tx = idb.transaction(stores)
          const rows = {}
          let left = stores.length
          for (const store of stores) {
            const query = tx.objectStore(store).getAll()
            query.onsuccess = () => {
              rows[store] = query.result
              if (--left === 0) resolve({ stores, rows })
            }
          }
        }
      }),
  )
  check(
    'Dexie: the 6 tables from CLAUDE.md 7.3 plus favorites and settings (version 2)',
    local.stores.join(',') === 'contributions,fares,favorites,landmarks,routePacks,routes,settings,terminals',
    local.stores.join(','),
  )
  const { routePacks, routes, landmarks, fares } = local.rows
  check(
    'Dexie: one route pack with landmarks, routes with stops, and dated fares',
    routePacks.length === 1 &&
      landmarks.length > 0 &&
      routes.length > 0 &&
      routes.every((route) => route.stops?.length >= 2) &&
      fares.length > 0 &&
      fares.every((fare) => /^\d{4}-\d{2}-\d{2}$/.test(fare.effectiveDate)),
    `pack ${routePacks[0]?.id} v${routePacks[0]?.version}: ${landmarks.length} landmarks, ${routes.length} routes, ${fares.length} fares`,
  )
  check(
    'Dexie: unverified data is marked',
    routes.every((route) => route.verified === true || route.verified === false) &&
      (routes.every((route) => route.verified) || /not verified/i.test(routePacks[0]?.note ?? '')),
  )

  // --- Server stopped: nothing left to answer on the network ---
  await client.send('Network.emulateNetworkConditions', { ...OFFLINE, offline: false })
  await new Promise((resolve) => {
    server.httpServer.closeAllConnections?.()
    server.httpServer.close(resolve)
  })
  let serverUp = true
  try {
    await fetch(BASE)
  } catch {
    serverUp = false
  }
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  const stillRenders = await page.evaluate(() => (document.querySelector('#root')?.childElementCount ?? 0) > 0)
  check('App loads with the server stopped', !serverUp && stillRenders)

  check('No console errors', consoleErrors.length === 0, consoleErrors.join(' | '))
} finally {
  await browser.close()
  if (server.httpServer.listening) await new Promise((resolve) => server.httpServer.close(resolve))
}

for (const result of results) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  [${result.detail}]` : ''}`)
}
const failures = results.filter((result) => !result.pass).length
console.log(`\n${results.length - failures} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
