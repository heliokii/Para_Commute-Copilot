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
  const resultsText = await visibleText()
  check('Results: route pack version shown', /Route pack: synthetic-pack, bersyon/.test(resultsText))
  // The sample fare table is dated 2026-01-01, which is past the 180-day limit.
  check('Results: stale-fare warning shown for an old fare table', (await page.$('[data-testid=stale-warning]')) !== null && resultsText.includes('Maaaring may bagong fare matrix'))

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

  // --- Trip mode (simulated GPS) ---
  // Real GPS cannot run here; the replay feeds the same code path as watchPosition.
  await goTo('#/ruta/trip')
  await page.waitForSelector('[data-testid=trip-use-sim]', { timeout: 5000 })
  const consent = await visibleText()
  check('Trip: location explained in Taglish before any permission', consent.includes('Nasa phone mo lang ang lokasyon mo') && consent.includes('Hindi gumagana ang app sa background'))
  await page.click('[data-testid=trip-use-sim]')
  await page.waitForSelector('[data-testid=sim-banner]', { timeout: 5000 })
  check('Trip: Simulated GPS banner shown', (await text('[data-testid=sim-banner]')).includes('Simulated GPS'))
  const tripFirst = await visibleText()
  check('Trip: current leg, next landmark and distance shown', tripFirst.includes('Baba sa SYN Charlie Junction') && tripFirst.includes('Susunod na landmark') && (await page.$('[role=progressbar]')) !== null)
  await page.click('[data-testid=trip-speed-3600]')
  await page.waitForSelector('[data-testid=trip-alert]', { timeout: 20000 })
  const alertText = await text('[data-testid=trip-alert]')
  check('Trip: alert screen says Malapit na ang babaan with the Para po! bubble', alertText.includes('Malapit na ang babaan!') && alertText.includes('Para po!') && alertText.includes('Sige, Tsupher!'))
  check('Trip: alert names the stop and a distance', /\d+(\.\d)? (km|m) na lang bago ang SYN Charlie Junction/.test(alertText), alertText)
  check('Trip: alert uses the Jumping sprite', (await page.$('[data-testid=trip-alert] img[src*="tsupher-jumping"]')) !== null)
  check('Trip: Simulated GPS banner stays on the alert screen', (await page.$('[data-testid=trip-alert] [data-testid=sim-banner]')) !== null)
  await page.click('[data-testid=trip-dismiss]')
  check('Trip: dismiss closes the alert', (await page.$('[data-testid=trip-alert]')) === null)
  await page.waitForFunction(() => document.querySelector('[data-testid=trip-leg]')?.textContent.includes('SYN Foxtrot Station'), { timeout: 20000 })
  check('Trip: passing the alight point advances to leg 2', (await visibleText()).includes('Leg 2 sa 2'))
  await page.evaluate(() => document.querySelector('[data-testid=trip-alighted]').click())
  await page.waitForSelector('[data-testid=trip-done]', { timeout: 5000 })
  check('Trip: Nakababa na ako on the last leg finishes the trip', (await text('[data-testid=trip-done]')).includes('Nakarating ka na!'))

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

  // --- Tsupher chat, rules lane (no model in this profile) ---
  const say = async (textToSend) => {
    const before = await page.$$eval('[data-testid=tsupher-message]', (nodes) => nodes.length)
    await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 5000 })
    await page.focus('[data-testid=chat-input]')
    await page.keyboard.type(textToSend)
    await page.keyboard.press('Enter')
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll('[data-testid=tsupher-message]').length > count &&
        !document.querySelector('[data-testid=typing]'),
      { timeout: 10000, polling: 100 },
      before,
    )
    return lastReply()
  }
  const lastReply = () =>
    page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-testid=tsupher-message]')]
      const node = nodes[nodes.length - 1]
      return {
        kind: node.dataset.kind,
        text: node.innerText,
        fares: [...node.querySelectorAll('[data-testid=chat-option-fare]')].map((fare) => fare.textContent),
      }
    })

  // The Home prompt card opens the chat and sends the question.
  await goTo('#/')
  await page.waitForSelector('#ask', { visible: true, timeout: 5000 })
  await page.focus('#ask')
  await page.keyboard.type('Paano pumunta sa Foxtrot galing Alpha?')
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () => location.hash === '#/chat' && document.querySelector('[data-testid=chat-option-fare]') && !document.querySelector('[data-testid=typing]'),
    { timeout: 10000 },
  )
  let chatReply = await lastReply()
  check('Chat: Home prompt opens the chat with route options', chatReply.kind === 'options' && chatReply.fares.join(' ') === '₱26.00 ₱35.25 ₱30.25', chatReply.fares.join(' '))
  check('Chat: header names Tsupher, never "Kuya Para"', await page.evaluate(() => [...document.querySelectorAll('h1')].find((heading) => heading.offsetParent)?.textContent === 'Tsupher' && !/kuya para/i.test(document.body.innerText)))
  check('Chat: summary line comes from the RouteResult', chatReply.text.includes('Sige! Ito ang nahanap ko:') && !chatReply.text.includes('Simulation'))

  chatReply = await say('may mas mura?')
  check('Chat follow-up "may mas mura?": cheapest stays first', chatReply.fares[0] === '₱26.00' && chatReply.text.includes('Pinili mo'), chatReply.fares.join(' '))

  // Quick-reply chip: a what-if, labeled as a simulation.
  const before = await page.$$eval('[data-testid=tsupher-message]', (nodes) => nodes.length)
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Iwas EDSA')?.click()
  })
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid=tsupher-message]').length > count && !document.querySelector('[data-testid=typing]'),
    { timeout: 10000, polling: 100 },
    before,
  )
  chatReply = await lastReply()
  check('Chat what-if "Iwas EDSA": new cheapest is ₱30.25', chatReply.fares[0] === '₱30.25', chatReply.fares.join(' '))
  check('Chat what-if: Tsupher says it is a simulation and every card is tagged', chatReply.text.includes('Simulation lang ito') && (chatReply.text.match(/Simulated/g) ?? []).length >= chatReply.fares.length)

  chatReply = await say('bakit ito?')
  check('Chat "bakit ito?": answered from the RouteResult', chatReply.kind === 'answer' && chatReply.text.includes('₱30.25'), chatReply.text)

  chatReply = await say('Anong ulam mamaya?')
  check('Chat out-of-scope: polite refusal, no invented answer', chatReply.kind === 'unsupported' && chatReply.fares.length === 0 && chatReply.text.includes('ruta at pamasahe lang'))

  chatReply = await say('okay na ang EDSA, mas mabilis')
  check('Chat: lifting the avoid removes the simulation label and applies "mas mabilis"', chatReply.kind === 'options' && !chatReply.text.includes('Simulated') && chatReply.fares[0] === '₱35.25', chatReply.fares.join(' '))

  // Option card -> Route detail -> back to the chat.
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid=chat-option]')]
    cards[cards.length - 1].click()
  })
  await page.waitForSelector('[data-testid=leg]', { timeout: 5000 })
  check('Chat option card opens Route detail', (await texts('[data-testid=leg]')).length > 0)
  await page.click('a[aria-label=Bumalik]')
  await page.waitForFunction(() => location.hash === '#/chat', { timeout: 5000 })
  check('Detail back button returns to the chat with the conversation intact', (await page.$$eval('[data-testid=tsupher-message]', (nodes) => nodes.length)) >= 6)
  check('Chat: mic stays disabled', await page.evaluate(() => [...document.querySelectorAll('button[aria-disabled=true]')].some((button) => button.getAttribute('aria-label')?.includes('Boses'))))

  // --- Error boundary: a crashing screen shows Tsupher and a retry, not a blank page ---
  // navigator.onLine is read while rendering the status pill; make it throw once.
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get() {
        if (window.__crash) throw new Error('simulated render failure')
        return original.get.call(this)
      },
    })
    window.__crash = true
  })
  await goTo('#/offline')
  await page.waitForFunction(() => document.body.innerText.includes('Naku, may nasira'), { timeout: 5000 }).catch(() => {})
  const crashed = await visibleText()
  check('Error boundary: crash screen with Tsupher and a retry', crashed.includes('Naku, may nasira') && crashed.includes('Subukan ulit') && (await page.$('img[src*="tsupher-sad"]')) !== null)
  await page.evaluate(() => {
    window.__crash = false
    ;[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Subukan ulit'))?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('Offline Mode'), { timeout: 5000 }).catch(() => {})
  check('Error boundary: retry brings the screen back', (await visibleText()).includes('Offline Mode') && !(await visibleText()).includes('Naku, may nasira'))
  consoleErrors.length = 0 // the simulated failure logs to the console on purpose

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
  // Leave a trace of where the flow stopped.
  const pages = await browser.pages()
  const where = await pages
    .at(-1)
    ?.evaluate(
      () =>
        `${location.hash} | focus: ${document.activeElement?.tagName}#${document.activeElement?.id} | ${document.body.innerText.slice(-200).replace(/\s+/g, ' ')}`,
    )
    .catch(() => '')
  check('E2E ran to completion', false, `${error.message} @ ${where}`)
} finally {
  await browser.close()
  await new Promise((resolve) => {
    server.httpServer.closeAllConnections?.()
    server.httpServer.close(resolve)
  })
}

finish()
