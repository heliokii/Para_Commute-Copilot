// Usage: npm run build && npm run test:e2e
// End-to-end plan flow with the network off: plan -> results -> detail -> map,
// then an avoid what-if and a no-route case. Runs against the production build.
// Expected values are the hand-computed ones in src/router/__fixtures__/synthetic-pack.ts.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
// WebGPU on where the machine has it, so the model lane is reachable in the download checks.
const browser = await launch(['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'])

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
  // Every request the page even tries to make to another host, from here on.
  const outside = []
  page.on('request', (request) => {
    const url = request.url()
    if (!url.startsWith(BASE) && !url.startsWith('data:') && !url.startsWith('blob:')) outside.push(url)
  })
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
  // Mic with no voice model: points to Setup and never asks for the microphone.
  await page.evaluate(() => {
    window.__micAsked = false
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = (...args) => ((window.__micAsked = true), original(...args))
    ;[...document.querySelectorAll('[data-testid=mic-button]')].find((button) => button.offsetParent !== null).click()
  })
  await page.waitForSelector('[data-testid=listening][data-phase=needModel]', { timeout: 5000 }).catch(() => {})
  const noVoice = await page.evaluate(() => ({
    text: document.querySelector('[data-testid=listening]')?.innerText ?? '',
    asked: window.__micAsked,
  }))
  check('Chat: mic without a voice model points to Setup and does not ask for the microphone', noVoice.text.includes('Kailangan muna ng voice model') && !noVoice.asked, noVoice.text.replace(/\s+/g, ' '))
  await page.click('[data-testid=voice-close]')
  check('Chat: closing the voice screen returns to typing', await page.evaluate(() => !document.querySelector('[data-testid=listening]')))

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

  // --- Phase 9: Paborito, settings, contributions ---
  // Start clean: "I-reset ang session" must forget the conversation, the form and the recents.
  await goTo('#/settings')
  await page.waitForSelector('[data-testid=reset-session]', { timeout: 5000 })
  const settingsText = await visibleText()
  check('Settings: Wika is shown as not available, with no toggle that does nothing', (await text('[data-testid=settings-language]')).includes('Hindi pa available') && (await page.$('[data-testid=settings-language] button, [data-testid=settings-language] input, [data-testid=settings-language] [role=switch]')) === null && settingsText.includes('Taglish lang ang available'))
  await page.click('[data-testid=reset-session]')
  await page.waitForSelector('[data-testid=session-done]', { timeout: 5000 })
  await goTo('#/chat')
  await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 5000 })
  check('Reset session: the chat is back to the greeting', (await page.$$eval('[data-testid=tsupher-message]', (nodes) => nodes.length)) === 1)
  await goTo('#/paborito')
  await page.waitForSelector('[data-testid=recents-empty]', { timeout: 5000 })
  check('Reset session: Kamakailang Hinanap is empty', true)
  check('Paborito: empty state before anything is saved', (await page.$('[data-testid=fav-routes-empty]')) !== null)

  // Hearts on Results and Detail.
  await goTo('#/ruta')
  await page.waitForSelector('[data-testid=origin]', { timeout: 5000 })
  check('Reset session: the plan form is empty again', (await page.$eval('[data-testid=origin]', (element) => element.value)) === '')
  await pick('origin', 'alpha')
  await pick('destination', 'foxtrot')
  await search()
  // Tabs stay mounted while hidden, so only hearts that can be seen count.
  const hearts = () => page.$$eval('[data-testid=fav-route-toggle]', (nodes) => nodes.filter((node) => node.closest('[hidden]') === null).map((node) => node.getAttribute('aria-pressed')))
  const clickFirstHeart = () => page.evaluate(() => [...document.querySelectorAll('[data-testid=fav-route-toggle]')].find((node) => node.closest('[hidden]') === null).click())
  check('Results: a heart on each of the three options, none saved yet', (await hearts()).join(',') === 'false,false,false', (await hearts()).join(','))
  await clickFirstHeart()
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=fav-route-toggle]')].find((node) => node.closest('[hidden]') === null)?.getAttribute('aria-pressed') === 'true', { timeout: 5000 })
  const toast = await page.$eval('[data-testid=toast]', (node) => ({ text: node.textContent, sprite: node.dataset.sprite }))
  check('Results: saving shows the Love sprite and "Na-save sa Paborito!"', toast.sprite === 'love' && toast.text.includes('Na-save sa Paborito!'), JSON.stringify(toast))
  check('Results: only the saved option has a filled heart', (await hearts()).join(',') === 'true,false,false', (await hearts()).join(','))
  await page.click('[data-testid=route-option]')
  await page.waitForSelector('[data-testid=leg]', { timeout: 5000 })
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=fav-route-toggle]')].find((node) => node.closest('[hidden]') === null)?.getAttribute('aria-pressed') === 'true', { timeout: 5000 })
  check('Detail: the heart already shows the saved state', true)

  // "May mali ba?" on Detail.
  await page.click('[data-testid=report-open]')
  await page.waitForSelector('[data-testid=report-submit]', { timeout: 5000 })
  await new Promise((resolve) => setTimeout(resolve, 500)) // the sheet slides up; clicks during the slide miss
  check('Report: Submit stays off until something is chosen', await page.$eval('[data-testid=report-submit]', (button) => button.disabled))
  await page.click('[data-testid=report-issue-fare]')
  await page.type('[data-testid=report-note]', 'Test: ₱15 raw, hindi ₱13')
  await page.click('[data-testid=report-submit]')
  await page.waitForSelector('[data-testid=report-saved]', { timeout: 5000 })
  check('Report: saved on the phone, with the export hint', (await text('[data-testid=report-saved]')).includes('Hindi ito ipinapadala kahit saan'))
  await page.keyboard.press('Escape')

  // Paborito lists it, and it survives a reload (IndexedDB), while the recents (memory) do not.
  await goTo('#/paborito')
  await page.waitForSelector('[data-testid=fav-route]', { timeout: 5000 })
  const favRow = await text('[data-testid=fav-route]')
  check('Paborito: Mga Ruta lists the saved trip with its preference', favRow.includes('SYN Alpha Terminal') && favRow.includes('SYN Foxtrot Station') && favRow.includes('Mas mura'), favRow.replace(/\s+/g, ' '))
  check('Paborito: Kamakailang Hinanap lists the search just made', (await page.$$('[data-testid=recent]')).length >= 1)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.keyboard.press('Escape')
  await goTo('#/paborito')
  await page.waitForSelector('[data-testid=fav-route]', { timeout: 10000 })
  check('Paborito: the saved trip is still there after a reload', (await page.$$('[data-testid=fav-route]')).length === 1)
  check('Paborito: recents were forgotten with the session, as promised', (await page.$('[data-testid=recents-empty]')) !== null)

  // Opening a favorite runs the router again.
  await page.click('[data-testid=fav-route] button')
  await page.waitForFunction(() => location.hash === '#/ruta/results', { timeout: 5000 })
  await page.waitForSelector('[data-testid=route-option]', { timeout: 5000 })
  check('Paborito: opening a saved trip shows fresh router results (₱26.00 first)', (await texts('[data-testid=option-fare]'))[0] === '₱26.00')

  // Address tab: saved landmarks.
  await goTo('#/paborito')
  await page.click('[data-testid=fav-tab-address]')
  await pick('fav-place-picker', 'echo')
  await page.waitForSelector('[data-testid=fav-place]', { timeout: 5000 })
  check('Address: a landmark from the route pack can be saved', (await text('[data-testid=fav-place]')).includes('SYN Echo Mall'))
  await page.evaluate(() => {
    ;[...document.querySelectorAll('[data-testid=fav-place] button')].find((button) => button.textContent.includes('Papunta dito'))?.click()
  })
  await page.waitForFunction(() => location.hash === '#/ruta', { timeout: 5000 })
  check('Address: "Papunta dito" fills the destination on the plan form', (await page.$eval('[data-testid=destination]', (element) => element.value)) === 'SYN Echo Mall')
  await goTo('#/paborito')
  await page.click('[data-testid=fav-tab-address]')
  await page.click('[data-testid=fav-place-remove]')
  await page.waitForFunction(() => !document.querySelector('[data-testid=fav-place]'), { timeout: 5000 })
  check('Address: the heart removes a saved landmark', true)

  // Unit settings change the route screens.
  await goTo('#/ruta')
  await pick('origin', 'alpha')
  await pick('destination', 'foxtrot')
  await search()
  check('Units (default): 1 oras 20 min on the slow option', (await visibleText()).includes('1 oras 20 min'))
  await goTo('#/settings')
  await page.click('[data-testid=setting-time-min]')
  await goTo('#/ruta/results')
  await page.waitForSelector('[data-testid=route-option]', { timeout: 5000 })
  const minOnly = await visibleText()
  check('Oras = Min lang: 80 min, no hours', minOnly.includes('80 min') && !minOnly.includes('oras'))
  await goTo('#/settings')
  await page.click('[data-testid=setting-distance-mi]')
  await goTo('#/ruta/detail')
  await page.waitForSelector('[data-testid=leg]', { timeout: 5000 })
  const miles = (await texts('[data-testid=leg]')).join(' ')
  check('Distansya = Milya: leg distances in mi, none in km', /\d mi\b/.test(miles) && !/\d km\b/.test(miles), miles.replace(/\s+/g, ' ').slice(0, 160))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.keyboard.press('Escape')
  await goTo('#/settings')
  await page.waitForFunction(() => document.querySelector('[data-testid=setting-distance-mi]')?.getAttribute('aria-pressed') === 'true', { timeout: 5000 }).catch(() => {})
  check('Settings are saved on the device: still Milya and Min lang after a reload', await page.evaluate(() => document.querySelector('[data-testid=setting-distance-mi]')?.getAttribute('aria-pressed') === 'true' && document.querySelector('[data-testid=setting-time-min]')?.getAttribute('aria-pressed') === 'true'))
  await page.click('[data-testid=setting-time-hm]')
  await page.click('[data-testid=setting-distance-km]')

  // Contribution queue: export, import.
  await page.evaluate(() => {
    window.__files = []
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => (window.__files.push(blob), original(blob))
    // No real download in the test run.
    HTMLAnchorElement.prototype.click = function () {}
  })
  check('Contributions: one report waiting', (await text('[data-testid=contrib-count]')).includes('1 report · 1 hindi pa na-export'), await text('[data-testid=contrib-count]'))
  await page.click('[data-testid=export-json]')
  await page.waitForFunction(() => window.__files.length === 1, { timeout: 5000 })
  const jsonText = await page.evaluate(() => window.__files[0].text())
  const exported = JSON.parse(jsonText)
  check('Export JSON: our format, one report with the route, pack version and note', exported.format === 'para-contributions' && exported.items.length === 1 && exported.items[0].payload.issue === 'fare' && exported.items[0].payload.note === 'Test: ₱15 raw, hindi ₱13' && exported.items[0].payload.originId === 'A' && exported.items[0].payload.destinationId === 'F' && exported.items[0].payload.routeIds.join() === 'R1,R3' && exported.items[0].payload.packVersion === '0.2.0-synthetic', JSON.stringify(exported.items[0].payload))
  check('Export JSON: says a file was made, not that anyone received it', (await text('[data-testid=contrib-message]')).includes('hindi pa ito natatanggap ng kahit sino'))
  check('Export marks the report as exported', (await text('[data-testid=contrib-count]')).includes('1 report · 0 hindi pa na-export'))
  await page.click('[data-testid=export-csv]')
  await page.waitForFunction(() => window.__files.length === 2, { timeout: 5000 })
  const csvText = await page.evaluate(() => window.__files[1].text())
  check('Export CSV: header row and the same report', csvText.startsWith('uid,createdAt,status,issue,note') && csvText.includes('Test: ₱15 raw') && csvText.includes('R1;R3'), csvText.split(String.fromCharCode(13)).slice(0, 2).join(' / '))

  mkdirSync('.cache', { recursive: true })
  const upload = async (name, content) => {
    const path = '.cache/' + name
    writeFileSync(path, content)
    // The message element is replaced on every new message, even one with the same words.
    await page.evaluate(() => document.querySelector('[data-testid=contrib-message]')?.setAttribute('data-old', '1'))
    await (await page.$('[data-testid=import-file]')).uploadFile(path)
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid=contrib-message]')
      return element && !element.hasAttribute('data-old')
    }, { timeout: 5000 })
    return text('[data-testid=contrib-message]')
  }
  check('Import: the same file again adds nothing (duplicate uid)', (await upload('e2e-same.json', jsonText)).includes('Nadagdag: 0. Nandito na dati: 1'))
  const team = JSON.parse(jsonText)
  team.items[0].payload.uid = 'team-1'
  team.items[0].payload.note = 'Mula sa team'
  team.items[0].status = 'exported'
  check('Import: a team file adds its report', (await upload('e2e-team.json', JSON.stringify(team))).includes('Nadagdag: 1. Nandito na dati: 0. Hindi tinanggap: 0'))
  const csvTeam = csvText.replace(/^([^\r\n]*\r\n)[^,]+/, (_, header) => header + 'team-2')
  check('Import: a CSV file works too', (await upload('e2e-team.csv', csvTeam)).includes('Nadagdag: 1'))
  check('Import: a file that is not ours is refused', (await upload('e2e-bad.json', 'hello')).includes('Hindi ito file ng Para!'))
  check('Contributions: three reports now', (await text('[data-testid=contrib-count]')).includes('3 report'))

  // "Burahin lahat ng data": confirmation first.
  await page.click('[data-testid=erase-open]')
  await page.waitForSelector('[data-testid=erase-confirm]', { timeout: 5000 })
  await new Promise((resolve) => setTimeout(resolve, 500)) // the sheet slides up
  const confirmText = await text('[data-testid=erase-confirm]')
  check('Erase: the confirmation lists what goes and what stays', confirmText.includes('Lahat ng Paborito') && confirmText.includes('route pack'))
  await page.click('[data-testid=erase-cancel]')
  check('Erase: "Huwag muna" deletes nothing', (await text('[data-testid=contrib-count]')).includes('3 report'))
  await page.click('[data-testid=erase-open]')
  await page.waitForSelector('[data-testid=erase-confirm-yes]', { timeout: 5000 })
  await new Promise((resolve) => setTimeout(resolve, 500))
  await page.click('[data-testid=erase-confirm-yes]')
  await page.waitForSelector('[data-testid=erase-result]', { timeout: 10000 })
  const afterErase = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('ParaDB')
        request.onsuccess = () => {
          const idb = request.result
          const counts = {}
          const names = ['favorites', 'settings', 'contributions', 'routePacks', 'landmarks']
          let left = names.length
          for (const name of names) {
            const query = idb.transaction(name).objectStore(name).count()
            query.onsuccess = () => {
              counts[name] = query.result
              if (--left === 0) {
                idb.close()
                resolve(counts)
              }
            }
          }
        }
      }),
  )
  check('Erase: favorites, settings and reports are gone; the route pack stays', afterErase.favorites === 0 && afterErase.settings === 0 && afterErase.contributions === 0 && afterErase.routePacks === 1 && afterErase.landmarks > 0, JSON.stringify(afterErase))
  check('Erase: the screen says so', (await text('[data-testid=erase-result]')).includes('Nabura na'))
  await goTo('#/paborito')
  check('Erase: Paborito is empty again', (await page.$('[data-testid=fav-routes-empty]')) !== null)
  await goTo('#/ruta')
  check('Erase: the app still works (pack loaded, form usable)', (await page.$('[data-testid=origin]')) !== null)

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

  // --- Opening a screen never starts a model download ---
  await goTo('#/offline')
  await page.waitForSelector('[data-testid=proof-model]', { timeout: 5000 })
  await goTo('#/about')
  await page.waitForFunction(() => document.body.innerText.includes('On this device'), { timeout: 5000 })
  await goTo('#/setup')
  const downloading = await page.evaluate(() => Boolean(document.querySelector('[data-testid=setup-progress], [data-testid=setup-voice-progress]')))
  check('Opening Setup, Offline Mode and About offline starts no model download and asks no other host', outside.length === 0 && !downloading, outside.join(', '))

  // --- A stale "model is downloaded" note must not turn a chat message into a download ---
  // The start-up check trusts this note; the cache itself is empty in this profile.
  // Leave Setup first: that screen checks the real cache and would correct the note.
  await goTo('#/')
  await page.evaluate(() => {
    localStorage.setItem('para.model', 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC')
    localStorage.setItem('para.model.ready', 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.keyboard.press('Escape')
  await goTo('#/chat')
  await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 5000 })
  const repliesBefore = await page.$$eval('[data-testid=tsupher-message]', (nodes) => nodes.length)
  await page.focus('[data-testid=chat-input]')
  // No origin, so the rules cannot finish and the model lane is tried.
  await page.keyboard.type('Paano pumunta sa Delta?')
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid=tsupher-message]').length > count && !document.querySelector('[data-testid=typing]'),
    { timeout: 60000, polling: 250 },
    repliesBefore,
  )
  const webGpu = await page.evaluate(async () => Boolean(navigator.gpu && (await navigator.gpu.requestAdapter())))
  check(
    'Chat with a model that is noted as downloaded but missing from the cache: no download is attempted',
    outside.length === 0,
    outside.length > 0 ? outside.slice(0, 3).join(', ') : webGpu ? 'WebGPU on: model lane was reachable' : 'no WebGPU here: model lane not reachable, check is vacuous',
  )
  await page.evaluate(() => {
    localStorage.removeItem('para.model')
    localStorage.removeItem('para.model.ready')
  })

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
