// Usage: npm run build && npm run test:e2e
// End-to-end plan flow with the network off: plan -> results -> detail -> map,
// then an avoid what-if and a no-route case. Runs against the production build.
// Expected values are the hand-computed ones in src/router/__fixtures__/synthetic-pack.ts.
import { existsSync } from 'node:fs'
import { preview } from 'vite'
import { createReport, goOffline, launch } from './lib/browser.mjs'

const PORT = 4174
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
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  const consoleErrors = []
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()))
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  // First load online so the service worker can install, then cut the network.
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'networkidle0' })
  await goOffline(browser, page)

  const fromNetwork = []
  const failed = []
  page.on('response', (response) => {
    if (!response.fromServiceWorker() && !response.fromCache()) fromNetwork.push(response.url())
  })
  page.on('requestfailed', (request) => failed.push(request.url()))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.keyboard.press('Escape') // skip the splash
  check('Offline: navigator reports offline', await page.evaluate(() => !navigator.onLine))

  const goTo = async (hash) => {
    await page.evaluate((target) => {
      location.hash = target
    }, hash)
    // Let React render the new screen before the next click.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  const text = (selector) => page.$eval(selector, (element) => element.textContent.trim())
  const texts = (selector) => page.$$eval(selector, (elements) => elements.map((element) => element.textContent.trim()))
  const visibleText = () => page.evaluate(() => document.body.innerText)

  async function pick(testId, query) {
    const input = `[data-testid=${testId}]`
    await page.waitForSelector(input, { visible: true, timeout: 5000 })
    // Focusing selects the current text, so typing replaces it.
    await page.focus(input)
    await page.keyboard.type(query)
    await page.waitForSelector('[role=option]', { timeout: 5000 })
    await page.keyboard.press('Enter')
    return page.$eval(input, (element) => element.value)
  }

  async function search() {
    await page.click('main:not([hidden]) button[type=submit]')
    await page.waitForFunction(() => location.hash === '#/ruta/results', { timeout: 5000 })
    await page.waitForSelector('[data-testid=route-option], [data-testid=no-route-reason]', { timeout: 5000 })
  }

  // --- Plan ---
  await goTo('#/ruta')
  await page.waitForSelector('[data-testid=origin]', { timeout: 10000 })
  // Fuzzy autocomplete: a typo and an alias.
  check('Picker: typo "alhpa" resolves to SYN Alpha Terminal', (await pick('origin', 'alhpa')) === 'SYN Alpha Terminal')
  check('Picker: alias "foxtrot" resolves to SYN Foxtrot Station', (await pick('destination', 'foxtrot')) === 'SYN Foxtrot Station')
  check('Plan screen shows the SAMPLE DATA label', (await visibleText()).includes('SAMPLE DATA, not verified'))
  await search()

  // --- Results ---
  const fares = await texts('[data-testid=option-fare]')
  check('Results: three options, chosen (cheapest) first', fares.join(' ') === '₱26.00 ₱35.25 ₱30.25', fares.join(' '))
  const first = await text('[data-testid=route-option]')
  check('Results: first card is labeled Mas mura and Pinili mo', first.includes('Mas mura') && first.includes('Pinili mo'))
  check('Results: unverified badge and fare as-of date shown', first.includes('Hindi pa verified') && first.includes('as of 2026-01-01'))
  check('Results: not marked simulated without an avoid', !first.includes('Simulated'))

  // --- Detail ---
  await page.click('[data-testid=route-option]')
  await page.waitForSelector('[data-testid=leg]', { timeout: 5000 })
  const legs = await texts('[data-testid=leg]')
  check('Detail: two legs with board and alight points', legs.length === 2 && legs[0].includes('SYN Alpha Terminal') && legs[1].includes('SYN Foxtrot Station'), `${legs.length} legs`)
  check('Detail: per-leg fare shown', legs.every((leg) => leg.includes('₱13.00')))
  check('Detail: total is ₱26.00', (await text('[data-testid=detail-total]')) === '₱26.00')
  check('Detail: Tandaan shows only the route note', (await visibleText()).includes('SYNTHETIC SAMPLE DATA, not verified'))

  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Paano nakuha'))?.click()
  })
  await page.waitForSelector('[data-testid=fare-sheet]', { timeout: 5000 })
  const sheet = await text('[data-testid=fare-sheet]')
  check('Fare sheet: base, per-km, effective date and source', sheet.includes('Base (unang 4 km)') && sheet.includes('₱1.50') && sheet.includes('2026-01-01') && sheet.includes('SYNTHETIC, not a real fare'))
  await page.keyboard.press('Escape')

  // --- Trip placeholder ---
  await goTo('#/ruta/trip')
  await page.waitForFunction(() => document.body.innerText.includes('Trip mode'), { timeout: 5000 })
  check('Simulan ang Ruta opens the Trip placeholder', true)

  // --- Map ---
  await goTo('#/mapa')
  await page.waitForSelector('[data-testid=route-map] polyline[data-leg]', { timeout: 5000 })
  const map = await page.evaluate(() => ({
    heading: document.querySelector('[data-testid=map-heading]')?.textContent ?? '',
    legs: [...document.querySelectorAll('[data-testid=route-map] polyline[data-leg]')].map((line) => line.dataset.leg),
    stops: [...document.querySelectorAll('[data-testid=route-map] [data-stop]')].map((stop) => stop.dataset.stop).sort(),
    images: document.querySelectorAll('[data-testid=route-map] image').length,
    text: document.querySelector('main:not([hidden])')?.innerText ?? '',
  }))
  check('Map: in sync with the selected route', map.heading.includes('SYN Alpha Terminal') && map.heading.includes('SYN Foxtrot Station'), map.heading)
  check('Map: one polyline per leg (R1, R3)', map.legs.join(',') === 'R1,R3', map.legs.join(','))
  check('Map: stops along the route are marked', map.stops.join('') === 'ABCEF', map.stops.join(''))
  check('Map: schematic SVG only, no tiles or images', map.images === 0)
  check('Map: legend and no Street View tab', ['Jeepney', 'UV Express', 'Bus', 'MRT/LRT'].every((label) => map.text.includes(label)) && !/street view/i.test(map.text))
  const viewBefore = await page.$eval('[data-testid=route-map]', (svg) => svg.getAttribute('viewBox'))
  await page.click('button[aria-label=Palakihin]')
  const viewAfter = await page.$eval('[data-testid=route-map]', (svg) => svg.getAttribute('viewBox'))
  check('Map: zoom control changes the view', viewBefore !== viewAfter, `${viewBefore} -> ${viewAfter}`)

  // --- What-if: avoid EDSA (simulated) ---
  await goTo('#/modes')
  await page.waitForSelector('[data-testid=mode-avoid-edsa]', { timeout: 5000 })
  await page.click('[data-testid=mode-avoid-edsa]')
  await goTo('#/ruta')
  check('Plan form kept its values across tabs', (await page.$eval('[data-testid=origin]', (element) => element.value)) === 'SYN Alpha Terminal')
  await search()
  const avoidFares = await texts('[data-testid=option-fare]')
  const avoidFirst = await text('[data-testid=route-option]')
  check('Avoid EDSA: cheapest becomes ₱30.25', avoidFares[0] === '₱30.25', avoidFares.join(' '))
  check('Avoid EDSA: every option is marked Simulated', (await texts('[data-testid=route-option]')).every((card) => card.includes('Simulated')) && avoidFirst.includes('Simulated'))

  // --- Custom preference ---
  await goTo('#/modes')
  await page.waitForSelector('[data-testid=mode-avoid-edsa]', { timeout: 5000 })
  await page.click('[data-testid=mode-avoid-edsa]') // off again
  await page.click('[data-testid=mode-custom]')
  await page.waitForSelector('[data-testid=weight-fare]', { timeout: 5000 })
  await goTo('#/ruta')
  await search()
  const customFirst = await text('[data-testid=route-option]')
  // Equal weights: R2 A>C + R3 C>F scores lowest (35.25 + 27 + 10).
  check('Custom preference: equal weights pick the ₱35.25 option', customFirst.includes('Custom') && customFirst.includes('₱35.25'))

  // --- No route ---
  await goTo('#/ruta')
  check('Picker: "hotel" resolves to SYN Hotel Island', (await pick('destination', 'hotel')) === 'SYN Hotel Island')
  await search()
  const reason = await text('[data-testid=no-route-reason]')
  check('No route: Confused state shows the router reason in Taglish', reason.startsWith('Walang rutang nagdudugtong'), reason)

  // --- Model setup screen, still offline: it must not reach for the network ---
  await goTo('#/setup')
  await page.waitForFunction(
    () => /Tulog pa si Tsupher|Walang WebGPU|Gising na si Tsupher/.test(document.body.innerText),
    { timeout: 15000 },
  )
  const setup = await visibleText()
  check(
    'Setup screen works offline and reports the real model state',
    /Tulog pa si Tsupher|Walang WebGPU/.test(setup),
    setup.includes('Walang WebGPU') ? 'no WebGPU' : 'model not downloaded',
  )
  check('Setup screen warns to use WiFi or explains the fallback', /Mag-WiFi muna|Gumagana pa rin ang Plan a Route/.test(setup))

  check('Offline: every response served by service worker or cache', fromNetwork.length === 0, fromNetwork.join(', '))
  check('Offline: no failed requests', failed.length === 0, failed.join(', '))
  check('No console errors', consoleErrors.length === 0, consoleErrors.join(' | '))
} catch (error) {
  check('E2E ran to completion', false, error.message)
} finally {
  await browser.close()
  await new Promise((resolve) => {
    server.httpServer.closeAllConnections?.()
    server.httpServer.close(resolve)
  })
}

finish()
