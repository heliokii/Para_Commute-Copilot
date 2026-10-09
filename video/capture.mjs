// Usage (from anywhere): node video/capture.mjs [--no-build] [--only=real|sample]
// Records real footage of the app for the promo video. Nothing here is staged:
// every clip is the production build, driven through its own UI, network cut.
//   REAL   = npm run build          (rail fares + OpenStreetMap map, no routes)
//   SAMPLE = npm run build:sample   (made-up "SYN ..." network, labeled SAMPLE DATA)
// Output: video/footage/<clip>/00000.jpg ... plus video/footage/<clip>.json
// (frame timestamps, marks for taps and typing, and the on-screen text the video quotes),
// and video/footage/MANIFEST.json (branch, commit, build per clip).
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { goOffline, launch } from '../scripts/lib/browser.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(ROOT)
const FOOTAGE = 'video/footage'
const BUILDS = {
  real: { script: 'build', outDir: 'video/.build/real', port: 4181 },
  sample: { script: 'build:sample', outDir: 'video/.build/sample', port: 4182 },
}
const MIN_COMMIT = '33a093a'
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3 }
const LAPTOP = { width: 1440, height: 900, deviceScaleFactor: 2 }
// Same-line pairs to try on the map, in order; the first whose two markers fit on screen is used everywhere.
const PAIRS = [
  ['rail-mrt3-north_avenue', 'rail-mrt3-taft_avenue'],
  ['rail-mrt3-araneta_cubao', 'rail-mrt3-ayala'],
  ['rail-mrt3-ortigas', 'rail-mrt3-ayala'],
  ['rail-mrt3-shaw_boulevard', 'rail-mrt3-guadalupe'],
]
// A station on another line, for the question that must get no fare.
const OTHER_LINE = 'rail-lrt1-dr_santos'

const args = process.argv.slice(2)
const only = args.find((arg) => arg.startsWith('--only='))?.slice(7)
const git = (command) => execSync(`git ${command}`, { encoding: 'utf8' }).trim()
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// --- Provenance gate: footage must come from a clean tree at or after the agreed commit. ---
const dirty = git('status --porcelain -- . ":(exclude)video"')
if (dirty) {
  console.error(`Working tree is dirty outside video/. Commit or stash first:\n${dirty}`)
  process.exit(1)
}
try {
  git(`merge-base --is-ancestor ${MIN_COMMIT} HEAD`)
} catch {
  console.error(`HEAD does not contain ${MIN_COMMIT}. Update the branch first.`)
  process.exit(1)
}
const manifest = {
  branch: git('rev-parse --abbrev-ref HEAD'),
  commit: git('rev-parse HEAD'),
  capturedAt: new Date().toISOString(),
  builds: Object.fromEntries(Object.entries(BUILDS).map(([name, build]) => [name, `npm run ${build.script} -- --outDir ${build.outDir}`])),
  clips: [],
}

const wanted = Object.keys(BUILDS).filter((name) => !only || only === name)
if (!args.includes('--no-build')) {
  for (const name of wanted) execSync(manifest.builds[name], { stdio: 'inherit' })
}
for (const name of wanted) {
  if (!existsSync(`${BUILDS[name].outDir}/sw.js`)) {
    console.error(`${BUILDS[name].outDir}/sw.js not found. Run without --no-build.`)
    process.exit(1)
  }
}
mkdirSync(FOOTAGE, { recursive: true })

const browsers = []
const servers = {}

/** Opens a build, lets the service worker install, and returns helpers bound to that page. */
async function open(buildName, viewport = PHONE) {
  const build = BUILDS[buildName]
  servers[buildName] ??= await preview({ build: { outDir: build.outDir }, preview: { port: build.port, strictPort: true }, logLevel: 'silent' })
  const base = `http://localhost:${build.port}/`
  // The screencast records device pixels only when the browser itself runs at that scale.
  // WebGPU on where the machine has it, so the proof panel reports the real model state.
  const browser = await launch(['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', `--force-device-scale-factor=${viewport.deviceScaleFactor}`])
  browsers.push(browser)
  manifest.browser ??= await browser.version()
  const page = await browser.newPage()
  await page.setViewport(viewport)
  // "load" plus a look at the page itself: waiting for a silent network proved flaky here.
  const reload = async () => {
    await page.reload({ waitUntil: 'load', timeout: 30000 })
    await page.waitForSelector('[data-testid=splash-start]', { timeout: 8000 }).catch(() => {})
    await page.keyboard.press('Escape') // skip the splash
    await sleep(400)
  }
  await page.goto(base, { waitUntil: 'load' })
  // Resolves once the service worker is active, which is after it has cached the whole app.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await reload()

  const frame = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
  const goTo = async (hash) => {
    await page.evaluate((target) => {
      location.hash = target
    }, hash)
    await frame()
  }
  const texts = (selector) => page.$$eval(selector, (nodes) => nodes.filter((node) => node.getClientRects().length > 0).map((node) => node.innerText.replace(/\s+/g, ' ').trim()))
  const center = (selector) =>
    page.evaluate((target) => {
      const box = [...document.querySelectorAll(target)].find((node) => node.getClientRects().length > 0)?.getBoundingClientRect()
      return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null
    }, selector)

  /**
   * Records the page while `run` drives it. Frames arrive only when the screen changes,
   * each with the browser's own timestamp; the video picks the latest frame for its time.
   */
  // One recording session per page, never detached: detaching any session from the page
  // was seen to switch the emulated network cut off again.
  const cdp = await page.createCDPSession()
  async function record(name, run) {
    if (offline) await ensureOffline()
    const dir = join(FOOTAGE, name)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const frames = []
    const marks = []
    const writes = []
    let start = null
    let last = -1
    const onFrame = ({ data, metadata, sessionId }) => {
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
      start ??= metadata.timestamp
      // The bobbing mascot repaints faster than any video needs; 60 frames a second is kept.
      if (metadata.timestamp - last < 0.016) return
      last = metadata.timestamp
      const file = join(dir, `${String(frames.length).padStart(5, '0')}.jpg`)
      frames.push(Number((metadata.timestamp - start).toFixed(4)))
      // OneDrive sometimes locks a fresh file for a moment; one retry is enough.
      const bytes = Buffer.from(data, 'base64')
      writes.push(writeFile(file, bytes).catch(() => sleep(300).then(() => writeFile(file, bytes))))
    }
    cdp.on('Page.screencastFrame', onFrame)
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
    for (let i = 0; start === null && i < 40; i++) await sleep(50)
    if (start === null) throw new Error(`${name}: the browser sent no screencast frame`)
    const mark = (label, data = {}) => marks.push({ t: Number((Date.now() / 1000 - start).toFixed(3)), label, ...data })
    const tools = {
      mark,
      /** Tap at a CSS-pixel point; the point is saved so the video can ring it. */
      async tap(point, label) {
        mark(`tap:${label}`, point)
        await page.mouse.click(point.x, point.y)
        await frame()
      },
      async type(text, label) {
        mark(`type:${label}`)
        await page.keyboard.type(text, { delay: 55 })
        mark(`typed:${label}`)
      },
    }
    await sleep(500)
    const facts = (await run(tools)) ?? {}
    await sleep(900)
    mark('end')
    await cdp.send('Page.stopScreencast')
    await Promise.all(writes)
    cdp.off('Page.screencastFrame', onFrame)
    const viewport = page.viewport()
    const offlineAtEnd = await page.evaluate(() => !navigator.onLine)
    writeFileSync(join(FOOTAGE, `${name}.json`), JSON.stringify({ name, build: buildName, viewport, offlineAtEnd, frames, marks, facts }, null, 1))
    manifest.clips.push({ name, build: buildName, commit: manifest.commit, viewport, offlineAtEnd, frames: frames.length, seconds: frames.at(-1) })
    console.log(`${name}: ${frames.length} frames, ${frames.at(-1)} s`)
  }

  const say = async (tools, text, label) => {
    const before = await page.$$eval('[data-testid=tsupher-message]', (nodes) => nodes.length)
    await page.focus('[data-testid=chat-input]')
    await tools.type(text, label)
    await sleep(350)
    tools.mark(`send:${label}`)
    await page.keyboard.press('Enter')
    // The thinking indicator is recorded only if the app shows it; nothing is added here.
    await page.waitForFunction((count) => document.querySelectorAll('[data-testid=tsupher-message]').length > count && !document.querySelector('[data-testid=typing]'), { timeout: 15000, polling: 50 }, before)
    tools.mark(`reply:${label}`)
    await sleep(1400)
    return (await texts('[data-testid=tsupher-message]')).at(-1)
  }

  // --- Map helpers ---
  const mapBox = async () => (await page.$('[data-testid=route-map]')).boundingBox()
  const stationAt = (id) => center(`[data-station="${id}"] circle`)
  const zoomIn = async (pause) => {
    const box = await mapBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel({ deltaY: -100 })
      await sleep(pause)
    }
    await frame()
  }
  /** Drags the map so the middle of the pair sits in the middle of the map. */
  const centerPair = async (pair, steps) => {
    const box = await mapBox()
    const [a, b] = [await stationAt(pair[0]), await stationAt(pair[1])]
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const to = { x: from.x - ((a.x + b.x) / 2 - from.x), y: from.y - ((a.y + b.y) / 2 - from.y) }
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps })
    await page.mouse.up()
    await frame()
  }
  const fits = async (pair) => {
    const box = await mapBox()
    const inside = (point) => point && point.x > box.x + 24 && point.x < box.x + box.width - 60 && point.y > box.y + 24 && point.y < box.y + box.height - 24
    return inside(await stationAt(pair[0])) && inside(await stationAt(pair[1]))
  }
  /** Network off for the page and its service worker, then a reload served from the offline copy. */
  // Safety net: the cut is checked, and re-applied if needed, before every reload and every clip.
  const ensureOffline = async () => {
    if (!(await page.evaluate(() => navigator.onLine))) return
    await goOffline(browser, page)
    await page.waitForFunction(() => !navigator.onLine, { timeout: 5000 })
  }
  let offline = false
  const cutNetwork = async () => {
    offline = true
    for (let attempt = 0; attempt < 4; attempt++) {
      await ensureOffline()
      try {
        await reload()
      } catch {
        continue
      }
      if (!(await page.evaluate(() => navigator.onLine))) return
    }
    throw new Error('Could not reload the app with the network cut.')
  }

  return { browser, page, base, goTo, frame, texts, center, record, say, stationAt, zoomIn, centerPair, fits, cutNetwork }
}

const stationName = (page, id) => page.evaluate(async (stationId) => {
  // The alias is what a rider would type; read it from the pack the app loaded into IndexedDB.
  const request = indexedDB.open('ParaDB')
  const idb = await new Promise((done) => (request.onsuccess = () => done(request.result)))
  const rows = await new Promise((done) => {
    const query = idb.transaction('landmarks').objectStore('landmarks').getAll()
    query.onsuccess = () => done(query.result)
  })
  idb.close()
  const row = rows.find((landmark) => landmark.id === stationId || landmark.landmarkId === stationId)
  return row ? { name: row.name, alias: row.aliases?.[0] ?? row.name } : null
}, id)

try {
  if (wanted.includes('real')) {
    const app = await open('real')
    const { browser, page, goTo, frame, texts, center, record, say, stationAt, zoomIn, centerPair, fits } = app

    // --- Home: online, then the network is cut for real and the status pill flips. ---
    await record('real-home', async ({ mark }) => {
      await sleep(1300)
      const before = (await texts('[role=status]'))[0]
      mark('network-cut')
      await goOffline(browser, page)
      await page.waitForFunction(() => !navigator.onLine, { timeout: 5000 })
      await frame()
      mark('pill-offline')
      await sleep(1800)
      const banner = await center('a[href="#/offline"]')
      return { pillBefore: before, pillAfter: (await texts('[role=status]'))[0], offlineBanner: (await texts('a[href="#/offline"]'))[0], bannerAt: banner }
    })
    // From here on the app runs from the service worker's copy only.
    await app.cutNetwork()
    const outside = []
    page.on('request', (request) => {
      const url = request.url()
      if (!url.startsWith(app.base) && !url.startsWith('data:') && !url.startsWith('blob:')) outside.push(url)
    })

    // --- Pick the station pair: both markers must fit on the phone's map at station zoom. ---
    await goTo('#/mapa')
    await page.waitForSelector('[data-testid=route-map]', { timeout: 10000 })
    await zoomIn(0)
    let pair = null
    for (const candidate of PAIRS) {
      await centerPair(candidate, 4)
      if (await fits(candidate)) {
        pair = candidate
        break
      }
    }
    if (!pair) throw new Error('No candidate station pair fits on the phone map at station zoom.')
    const [from, to, other] = [await stationName(page, pair[0]), await stationName(page, pair[1]), await stationName(page, OTHER_LINE)]
    console.log(`pair: ${from.name} -> ${to.name}; other line: ${other.name}`)

    // --- Chat phrasing: the first Taglish wording the app's own rules answer with a fare. ---
    const phrasings = [
      (a, b) => `Magkano pamasahe from ${a} to ${b}?`,
      (a, b) => `Magkano galing ${a} papunta sa ${b}?`,
      (a, b) => `Paano pumunta sa ${b} galing ${a}?`,
    ]
    await goTo('#/chat')
    await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 5000 })
    let phrase = null
    for (const candidate of phrasings) {
      const before = await page.$$eval('[data-testid=tsupher-message]', (nodes) => nodes.length)
      await page.focus('[data-testid=chat-input]')
      await page.keyboard.type(candidate(from.alias, to.alias))
      await page.keyboard.press('Enter')
      await page.waitForFunction((count) => document.querySelectorAll('[data-testid=tsupher-message]').length > count && !document.querySelector('[data-testid=typing]'), { timeout: 15000 }, before)
      const reply = (await texts('[data-testid=tsupher-message]')).at(-1)
      console.log(`probe "${candidate(from.alias, to.alias)}" -> ${reply.slice(0, 90)}`)
      if (reply.includes('Pamasahe,') && reply.includes('₱')) {
        phrase = candidate
        break
      }
    }
    if (!phrase) throw new Error('No phrasing got a fare answer from the chat.')
    // The chat is in memory only: a reload gives a clean conversation for the recording.
    await app.cutNetwork()

    await goTo('#/chat')
    await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 5000 })
    await record('real-chat', async (tools) => {
      const question = phrase(from.alias, to.alias)
      const answer = await say(tools, question, 'q1')
      const crossQuestion = phrase(other.alias, to.alias)
      const crossAnswer = await say(tools, crossQuestion, 'q2')
      return { question, answer, crossQuestion, crossAnswer }
    })

    // --- Ruta: the fare lookup, typed into the pickers. ---
    const pick = async (tools, testId, query) => {
      const input = `[data-testid=${testId}]`
      await page.click(input, { clickCount: 3 })
      await page.keyboard.press('Backspace')
      await tools.type(query, testId)
      await page.waitForSelector('[role=option]', { timeout: 5000 })
      await sleep(450)
      await page.keyboard.press('Enter')
      await sleep(500)
      return page.$eval(input, (element) => element.value)
    }
    await goTo('#/ruta')
    await page.waitForSelector('[data-testid=fare-lookup]', { timeout: 10000 })
    await record('real-ruta', async (tools) => {
      const origin = await pick(tools, 'origin', from.alias.toLowerCase())
      const destination = await pick(tools, 'destination', to.alias.toLowerCase())
      await page.waitForSelector('main:not([hidden]) [data-testid=fare-row]', { timeout: 5000 })
      await page.evaluate(() => document.activeElement?.blur())
      tools.mark('fare')
      await sleep(600)
      await page.evaluate(() => document.querySelector('main:not([hidden]) [data-testid=fare-result]').scrollIntoView({ behavior: 'smooth', block: 'center' }))
      await sleep(1500)
      return { origin, destination, rows: await texts('main:not([hidden]) [data-testid=fare-row]') }
    })

    // --- Mapa: zoom, tap boarding, tap alighting, the fare card appears. No route is drawn. ---
    await app.cutNetwork()
    await goTo('#/mapa')
    await page.waitForSelector('[data-testid=route-map]', { timeout: 10000 })
    await sleep(400)
    await record('real-mapa', async (tools) => {
      await sleep(700)
      tools.mark('zoom')
      await zoomIn(110)
      await sleep(300)
      tools.mark('pan')
      await centerPair(pair, 24)
      await sleep(500)
      const first = await stationAt(pair[0])
      await tools.tap(first, 'origin')
      await sleep(900)
      const second = await stationAt(pair[1])
      await tools.tap(second, 'destination')
      await page.waitForSelector('[data-testid=map-fare-result] [data-testid=fare-row]', { timeout: 5000 })
      tools.mark('fare')
      await sleep(700)
      // Positions again after the taps: the video rings a marker only if it did not move.
      const after = [await stationAt(pair[0]), await stationAt(pair[1])]
      const still = [first, second].every((point, index) => Math.hypot(point.x - after[index].x, point.y - after[index].y) < 0.5)
      tools.mark('scroll')
      // Scroll just far enough to show the fare, keeping the map's credit on screen.
      await page.evaluate(() => {
        const row = document.querySelector('[data-testid=map-fare-result] [data-testid=fare-row]').getBoundingClientRect()
        window.scrollBy({ top: Math.max(0, row.bottom - (innerHeight - 110)), behavior: 'smooth' })
      })
      await sleep(1600)
      const credit = await page.evaluate(() => {
        const node = [...document.querySelectorAll('p')].find((p) => p.innerText.includes('OpenStreetMap contributors') && p.className.includes('absolute'))
        const box = node?.getBoundingClientRect()
        return { text: node?.innerText ?? '', onScreen: Boolean(box && box.top >= 0 && box.bottom <= innerHeight) }
      })
      return {
        pair,
        origin: await page.$eval('[data-testid=map-origin]', (element) => element.value),
        destination: await page.$eval('[data-testid=map-destination]', (element) => element.value),
        rows: await texts('[data-testid=map-fare-result] [data-testid=fare-row]'),
        markersStill: still,
        credit,
        polylines: await page.$$eval('[data-testid=route-map] polyline[data-leg]', (nodes) => nodes.length),
      }
    })

    // --- Offline Mode: the proof panel, exactly as the app reports it. ---
    await goTo('#/offline')
    await page.waitForFunction(() => document.querySelector('[data-testid=proof-sw]')?.dataset.ok === 'true' && document.querySelector('[data-testid=proof-pack]')?.dataset.ok === 'true', { timeout: 15000, polling: 200 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await record('real-offline', async (tools) => {
      await sleep(1500)
      tools.mark('scroll')
      await page.evaluate(() => document.querySelector('[data-testid=bytes-sent]').scrollIntoView({ behavior: 'smooth', block: 'center' }))
      await sleep(2200)
      const rows = await page.$$eval('[data-testid^=proof-]', (nodes) =>
        nodes.map((node) => {
          const [label, value, note] = [...node.querySelectorAll(':scope > span:last-child > span')].map((span) => span.innerText.trim())
          return { id: node.dataset.testid.slice(6), ok: node.dataset.ok, label, value, note: note ?? null }
        }),
      )
      return { rows, bytesSent: (await texts('[data-testid=bytes-sent]'))[0], connection: (await texts('[role=status]')).filter((text) => text === 'Online' || text === 'Offline').at(-1) ?? null, requestsToOtherHosts: outside.length }
    })

    // --- About: the data credit. ---
    await goTo('#/about')
    await page.waitForFunction(() => document.body.innerText.includes('OpenStreetMap contributors'), { timeout: 5000 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await record('real-about', async (tools) => {
      await sleep(800)
      tools.mark('scroll')
      await page.evaluate(() => [...document.querySelectorAll('p')].find((p) => p.getClientRects().length > 0 && p.innerText.includes('© OpenStreetMap contributors'))?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      await sleep(2000)
      return { credit: await page.evaluate(() => [...document.querySelectorAll('p')].find((p) => p.getClientRects().length > 0 && p.innerText.includes('© OpenStreetMap contributors'))?.innerText ?? ''), pack: (await texts('[data-testid=about-pack]'))[0] ?? '' }
    })

    // --- Laptop dashboard: Home, Ruta and Mapa side by side; the same pair is tapped on its map. ---
    manifest.real = { pair, requestsToOtherHostsWhileOffline: outside.length }
    await browser.close()
    const laptop = await open('real', LAPTOP)
    await laptop.cutNetwork()
    await laptop.goTo('#/ruta')
    await laptop.page.waitForSelector('[data-testid=fare-lookup]', { visible: true, timeout: 5000 })
    await laptop.page.waitForSelector('[data-testid=route-map]', { visible: true, timeout: 5000 })
    await sleep(500)
    await laptop.record('real-dashboard', async (tools) => {
      await sleep(600)
      tools.mark('zoom')
      await laptop.zoomIn(90)
      await laptop.centerPair(pair, 16)
      await sleep(300)
      await tools.tap(await laptop.stationAt(pair[0]), 'origin')
      await sleep(600)
      await tools.tap(await laptop.stationAt(pair[1]), 'destination')
      await laptop.page.waitForSelector('[data-testid=fare-result] [data-testid=fare-row]', { visible: true, timeout: 5000 })
      tools.mark('fare')
      await sleep(1500)
      return {
        origin: await laptop.page.$eval('[data-testid=origin]', (element) => element.value),
        destination: await laptop.page.$eval('[data-testid=destination]', (element) => element.value),
        rows: await laptop.texts('[data-testid=fare-result] [data-testid=fare-row]'),
        sideNav: await laptop.page.evaluate(() => [...document.querySelectorAll('nav')].some((nav) => nav.getClientRects().length > 0 && nav.innerText.includes('Commute Copilot'))),
      }
    })
    await laptop.browser.close()
  }

  if (wanted.includes('sample')) {
    const app = await open('sample')
    const { page, goTo, texts, center, record, say } = app
    await app.cutNetwork()
    const label = () => page.evaluate(() => document.body.innerText.includes('SAMPLE DATA'))

    // --- Chat on the made-up network: options, "may mas mura?", then the Iwas EDSA what-if. ---
    await goTo('#/chat')
    await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 5000 })
    await record('sample-chat', async (tools) => {
      const question = 'Paano pumunta sa Foxtrot galing Alpha?'
      const options = await say(tools, question, 'q1')
      const labelOnOptions = await label()
      const cheaper = await say(tools, 'may mas mura?', 'q2')
      const before = await page.$$eval('[data-testid=tsupher-message]', (nodes) => nodes.length)
      const chip = await page.evaluate(() => {
        const box = [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Iwas EDSA' && button.getClientRects().length > 0).getBoundingClientRect()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      })
      await tools.tap(chip, 'iwas-edsa')
      await page.waitForFunction((count) => document.querySelectorAll('[data-testid=tsupher-message]').length > count && !document.querySelector('[data-testid=typing]'), { timeout: 10000, polling: 50 }, before)
      tools.mark('reply:whatif')
      await sleep(1600)
      const whatIf = (await texts('[data-testid=tsupher-message]')).at(-1)
      return { question, options, cheaper, whatIf, sampleLabelVisible: labelOnOptions, simulatedBadge: whatIf.includes('Simulated') }
    })

    // --- Trip alert on SIMULATED GPS (the app's own banner stays on screen). ---
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-testid=chat-option]')]
      cards.at(-1).click()
    })
    await page.waitForSelector('[data-testid=leg]', { timeout: 5000 })
    await goTo('#/ruta/trip')
    await page.waitForSelector('[data-testid=trip-use-sim]', { timeout: 5000 })
    await sleep(500)
    await record('sample-trip', async (tools) => {
      await sleep(500)
      await tools.tap(await center('[data-testid=trip-use-sim]'), 'use-sim')
      await page.waitForSelector('[data-testid=sim-banner]', { timeout: 5000 })
      tools.mark('sim-on')
      await sleep(900)
      await page.evaluate(() => document.querySelector('[data-testid=trip-speed-3600]').scrollIntoView({ block: 'center' }))
      await tools.tap(await center('[data-testid=trip-speed-3600]'), 'speed')
      await page.waitForSelector('[data-testid=trip-alert]', { timeout: 30000 })
      tools.mark('alert')
      await sleep(2500)
      return {
        alert: (await texts('[data-testid=trip-alert]'))[0],
        simBanner: (await texts('[data-testid=trip-alert] [data-testid=sim-banner]'))[0] ?? null,
        sampleLabelVisible: await label(),
      }
    })
    await app.browser.close()
  }

  writeFileSync(join(FOOTAGE, 'MANIFEST.json'), JSON.stringify(manifest, null, 1))
  console.log(`\n${FOOTAGE}/MANIFEST.json: ${manifest.branch} @ ${manifest.commit.slice(0, 7)}, ${manifest.clips.length} clips`)
} finally {
  for (const browser of browsers) await browser.close().catch(() => {})
  for (const server of Object.values(servers)) {
    server.httpServer.closeAllConnections?.()
    await new Promise((done) => server.httpServer.close(done))
  }
}
// Headless Chrome's GPU helpers can keep the process alive after everything is closed.
process.exit(0)
