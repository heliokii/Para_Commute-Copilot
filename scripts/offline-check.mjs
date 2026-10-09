// Usage: npm run build && npm run check:offline
// Serves dist/, then checks in headless Chrome that the app works with the
// network off and with the server stopped. Exit code 1 on any failure.
// Set CHROME_PATH if Chrome or Edge is not in a default location.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const OFFLINE = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }

const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((path) => path && existsSync(path))

if (!chromePath) {
  console.error('No Chrome or Edge found. Set CHROME_PATH.')
  process.exit(1)
}
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
  !distJs.includes('Router harness (dev only)') && !distJs.includes('Components (dev only)'),
)

const mascotBytes = readdirSync('dist/mascot').reduce((sum, file) => sum + statSync(join('dist/mascot', file)).size, 0)
check('Mascot assets under 1 MB', mascotBytes < 1024 * 1024, `${(mascotBytes / 1024).toFixed(0)} KiB`)

const precacheBytes = [...readFileSync('dist/sw.js', 'utf8').matchAll(/url:"([^"]+)"/g)]
  .map((match) => statSync(join('dist', match[1])).size)
  .reduce((sum, size) => sum + size, 0)
check('Precache under 2 MB', precacheBytes < 2 * 1024 * 1024, `${(precacheBytes / 1024).toFixed(0)} KiB`)

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

  // --- Local data, still offline ---
  await page.evaluate(() => {
    location.hash = '#/about'
  })
  await page.waitForFunction(() => document.body.innerText.includes('On this device'), { timeout: 5000 })
  const about = await page.evaluate(() => document.body.innerText)
  check('Offline: About lists libraries and the sample-data label', about.includes('dexie') && about.includes('SAMPLE DATA, not verified'))
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
    'Dexie: 6 tables from CLAUDE.md 7.3',
    local.stores.join(',') === 'contributions,fares,landmarks,routePacks,routes,terminals',
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
