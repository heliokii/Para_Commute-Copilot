// Usage: npm run build && npm run test:e2e:real
// The real-data build with the network off: no SAMPLE DATA label, rail fare lookup from
// the pack's matrices, the OpenStreetMap basemap, station taps and the chat fare answer.
// Expected fares are read from data/metro-manila/*-fare-matrices.json (see src/fares/lookup.test.ts).
import { existsSync } from 'node:fs'
import { preview } from 'vite'
import { createReport, goOffline, launch } from './lib/browser.mjs'

const PORT = 4175
const BASE = `http://localhost:${PORT}/`

if (!existsSync('dist/sw.js')) {
  console.error('dist/sw.js not found. Run "npm run build" first (not build:sample).')
  process.exit(1)
}

const { check, finish } = createReport()
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' })
const browser = await launch()

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  const consoleErrors = []
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()))
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'networkidle0' })
  await goOffline(browser, page)
  const outside = []
  page.on('request', (request) => {
    const url = request.url()
    if (!url.startsWith(BASE) && !url.startsWith('data:') && !url.startsWith('blob:')) outside.push(url)
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.keyboard.press('Escape') // skip the splash

  const goTo = async (hash) => {
    await page.evaluate((target) => {
      location.hash = target
    }, hash)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  const visibleText = () => page.evaluate(() => document.body.innerText)
  const texts = (selector) => page.$$eval(selector, (elements) => elements.map((element) => element.textContent.replace(/\s+/g, ' ').trim()))

  async function pick(testId, query) {
    const input = `[data-testid=${testId}]`
    await page.waitForSelector(input, { visible: true, timeout: 5000 })
    await page.click(input, { clickCount: 3 })
    await page.keyboard.press('Backspace')
    await page.keyboard.type(query)
    await page.waitForSelector('[role=option]', { timeout: 5000 })
    await page.keyboard.press('Enter')
    return page.$eval(input, (element) => element.value)
  }

  // --- Fare lookup on the Ruta tab ---
  await goTo('#/ruta')
  await page.waitForSelector('[data-testid=fare-lookup]', { timeout: 10000 })
  check('Ruta: shows the fare lookup, not a route form', (await page.$('main:not([hidden]) button[type=submit]')) === null)
  check('Ruta: no SAMPLE DATA label on the real pack', !(await visibleText()).includes('SAMPLE DATA'))
  check('Picker: "dr santos" resolves to a rail station', (await pick('origin', 'dr santos')).includes('Dr. Santos'))
  check('Picker: "ninoy" resolves to a rail station', (await pick('destination', 'ninoy')).includes('Ninoy Aquino'))
  await page.waitForSelector('[data-testid=fare-row]', { timeout: 5000 })
  const lrt1 = await texts('main:not([hidden]) [data-testid=fare-row]')
  check('LRT-1 Dr. Santos to Ninoy Aquino: single journey ₱20.00 and stored value ₱19.00', lrt1.some((row) => row.includes('Single journey') && row.includes('₱20.00')) && lrt1.some((row) => row.includes('Stored value') && row.includes('₱19.00')), lrt1.join(' | '))
  check('Fare rows show an "as of" date and a source link', lrt1.every((row) => /as of \d{4}-\d{2}-\d{2}/.test(row)) && (await page.$$('main:not([hidden]) [data-testid=fare-row] a[href^="https://"]')).length === lrt1.length)

  check('Picker: MRT-3 "north avenue"', (await pick('origin', 'north avenue')).includes('North Ave'))
  check('Picker: MRT-3 "quezon avenue"', (await pick('destination', 'quezon avenue')).includes('Quezon Ave'))
  await page.waitForFunction(() => document.querySelector('main:not([hidden]) [data-testid=fare-row]')?.textContent.includes('MRT') === false && document.querySelector('main:not([hidden]) [data-testid=fare-row]')?.textContent.includes('₱6.00'), { timeout: 5000 })
  const mrt = await texts('main:not([hidden]) [data-testid=fare-row]')
  check('MRT-3 North Avenue to Quezon Avenue: ₱6.00 with the 50% promotion, normally ₱13.00', mrt.length === 1 && mrt[0].includes('₱6.00') && mrt[0].includes('₱13.00'), mrt.join(' | '))

  check('Cross-line pair has no fare and says so', (await pick('destination', 'taft')) && (await pick('origin', 'dr santos')) && (await page.waitForSelector('[data-testid=fare-result]', { timeout: 5000 })) && (await visibleText()).includes('Walang nakalistang pamasahe'))

  // --- Map ---
  await goTo('#/mapa')
  await page.waitForSelector('[data-testid=route-map]', { timeout: 10000 })
  const map = await page.evaluate(() => ({
    roads: document.querySelector('[data-testid=basemap-roads] path')?.getAttribute('d')?.length ?? 0,
    rail: [...document.querySelectorAll('[data-testid=basemap-rail] path')].map((path) => path.getAttribute('d')?.length ?? 0),
    credit: document.body.innerText.includes('OpenStreetMap contributors'),
  }))
  check('Map: OpenStreetMap roads are drawn from the bundled data', map.roads > 1000, `${map.roads} chars of path`)
  check('Map: rail track is drawn for LRT-1, LRT-2 and MRT-3', map.rail.slice(1).every((length) => length > 100), map.rail.join(','))
  check('Map: OpenStreetMap credit is shown', map.credit)
  check('Map: no SAMPLE DATA label', !(await visibleText()).includes('SAMPLE DATA'))

  // Zoom in on Baclaran area by wheel, then tap two stations.
  const box = await (await page.$('[data-testid=route-map]')).boundingBox()
  const tapStation = async (id) => {
    const point = await page.evaluate((stationId) => {
      const circle = document.querySelector(`[data-station="${stationId}"] circle`)
      const rect = circle?.getBoundingClientRect()
      return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null
    }, id)
    if (!point) return false
    await page.mouse.click(point.x, point.y)
    return true
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 6; i++) await page.mouse.wheel({ deltaY: -300 })
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const stationCount = await page.$$eval('[data-station]', (nodes) => nodes.length)
  check('Map: stations are drawn', stationCount > 0, `${stationCount} stations`)
  // Zoom in on the middle of the map (Guadalupe is near it) and tap the station's marker.
  await page.click('button[aria-label="Ibalik ang view"]')
  for (let i = 0; i < 7; i++) await page.click('button[aria-label="Palakihin"]')
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.evaluate(() => document.querySelector('[data-testid=route-map]')?.scrollIntoView())
  const tapped = await tapStation('rail-mrt3-guadalupe')
  const pickedOrigin = tapped ? await page.$eval('[data-testid=map-origin]', (element) => element.value) : ''
  check('Map: tapping a station picks it for the fare lookup', tapped && pickedOrigin.includes('Guadalupe'), tapped ? pickedOrigin : 'Guadalupe marker not on screen after zooming in')

  // --- Chat ---
  await goTo('#/chat')
  const chatInput = await page.waitForSelector('[data-testid=chat-input]', { timeout: 5000 })
  await chatInput.type('Paano pumunta sa Ninoy Aquino galing Dr. Santos?')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.body.innerText.includes('Pamasahe, Dr. Santos'), { timeout: 15000 }).catch(() => {})
  const chat = await visibleText()
  check('Chat: a station-to-station question gets the matrix fare, without invented time or route', chat.includes('₱20.00') && chat.includes('Walang oras o ruta'), chat.slice(-200).replace(/s+/g, ' '))

  check('Zero requests to other hosts', outside.length === 0, outside.join(', '))
  check('No console errors', consoleErrors.length === 0, consoleErrors.join(' | '))
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
finish()
