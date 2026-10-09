// Usage: npm run screenshots
// Saves 390x844 screenshots of each screen to docs/screenshots/ for side-by-side
// review against design/reference/. Uses the dev server so dev-only screens are included.
import { existsSync, mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { createServer, preview } from 'vite'
import { findChrome } from './lib/browser.mjs'

const PORT = 5198
const BASE = `http://localhost:${PORT}/`
const OUT = 'docs/screenshots'

// name, hash, optional setup run in the page before the shot
const SCREENS = [
  ['home', '#/'],
  ['ruta', '#/ruta'],
  ['mapa-network', '#/mapa'],
  ['modes', '#/modes'],
  ['paborito', '#/paborito'],
  ['higit-pa', '#/higit'],
  ['settings', '#/settings'],
  ['offline-mode', '#/offline'],
  ['about', '#/about'],
  ['dev-components', '#/dev/components'],
  ['dev-router', '#/dev/router'],
]

const chromePath = findChrome()

mkdirSync(OUT, { recursive: true })
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'silent' })
await server.listen()
const browser = await puppeteer.launch({ executablePath: chromePath, headless: true })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const settle = () =>
    page.evaluate(async () => {
      await document.fonts.ready
      // Lazy images in hidden tabs never load, so wait briefly instead of forever.
      const pending = [...document.images].filter((image) => !image.complete && image.offsetParent)
      await Promise.race([
        Promise.all(pending.map((image) => image.decode().catch(() => {}))),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ])
    })

  // Splash: the first paint of a cold start.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid=splash-start]', { timeout: 15000 })
  await settle()
  await page.screenshot({ path: `${OUT}/splash.png` })
  console.log(`${OUT}/splash.png`)
  // The same screen on a laptop and on a short phone.
  for (const [name, width, height] of [['splash-wide', 1440, 900], ['splash-short', 360, 640]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    await settle()
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`${OUT}/${name}.png`)
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  await page.keyboard.press('Escape')

  for (const [name, hash] of SCREENS) {
    await page.evaluate((target) => {
      location.hash = target
    }, hash)
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 15000 }).catch(() => {})
    await settle()
    // Lazy images below the fold load once scrolled into view.
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: name.startsWith('dev-') || name === 'about' })
    console.log(`${OUT}/${name}.png`)
  }

  // Plan flow with a route selected (SAMPLE data from the synthetic pack).
  const shot = async (name, fullPage = false) => {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await settle()
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
    console.log(`${OUT}/${name}.png`)
  }
  const goTo = (hash) =>
    page.evaluate((target) => {
      location.hash = target
    }, hash)
  await goTo('#/ruta')
  for (const [field, query] of [['origin', 'alpha'], ['destination', 'foxtrot']]) {
    await page.waitForSelector(`[data-testid=${field}]`, { visible: true })
    await page.focus(`[data-testid=${field}]`)
    await page.keyboard.type(query)
    await page.keyboard.press('Enter')
  }
  await page.evaluate(() => document.activeElement?.blur())
  await shot('ruta-filled')
  await page.click('main:not([hidden]) button[type=submit]')
  await page.waitForSelector('[data-testid=route-option]')
  await shot('results', true)
  await page.click('[data-testid=route-option]')
  await page.waitForSelector('[data-testid=leg]')
  await shot('detail', true)
  await goTo('#/mapa')
  await page.waitForSelector('[data-testid=route-map] polyline[data-leg]')
  await shot('mapa-route')
  await goTo('#/ruta/trip')
  await shot('trip')

  // Chat (rules lane unless a model is cached in this browser profile).
  await goTo('#/chat')
  await page.waitForSelector('[data-testid=chat-input]', { visible: true })
  for (const line of ['Paano pumunta sa Foxtrot galing Alpha?', 'iwas EDSA']) {
    const count = await page.evaluate(() => document.querySelectorAll('[data-testid=tsupher-message]').length)
    await page.focus('[data-testid=chat-input]')
    await page.keyboard.type(line)
    await page.keyboard.press('Enter')
    await page.waitForFunction(
      (before) => document.querySelectorAll('[data-testid=tsupher-message]').length > before && !document.querySelector('[data-testid=typing]'),
      { timeout: 15000, polling: 100 },
      count,
    )
  }
  await page.evaluate(() => document.activeElement?.blur())
  await shot('chat')
  await goTo('#/setup')
  await page.waitForFunction(() => /Tulog pa si Tsupher|Walang WebGPU|Gising na/.test(document.body.innerText), { timeout: 30000 })
  await shot('setup')

  // Wide-screen dashboard, with the route planned above (SAMPLE data).
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await goTo('#/ruta/detail')
  await page.waitForSelector('[data-testid=leg]', { visible: true })
  await shot('dashboard')
  await goTo('#/')
  await shot('dashboard-plan')
  await goTo('#/offline')
  await shot('dashboard-offline')
  await goTo('#/chat')
  await shot('dashboard-chat')
  await goTo('#/ruta/trip')
  await shot('dashboard-trip')

  // The proof panel only tells the truth about the service worker in a production
  // build, so that one screenshot is retaken from "vite preview" when dist/ exists.
  if (existsSync('dist/sw.js')) {
    const built = await preview({ preview: { port: PORT + 1, strictPort: true }, logLevel: 'silent' })
    try {
      const prod = await browser.newPage()
      await prod.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
      await prod.goto(`http://localhost:${PORT + 1}/`, { waitUntil: 'networkidle0' })
      await prod.evaluate(() => navigator.serviceWorker.ready)
      await prod.goto(`http://localhost:${PORT + 1}/#/offline`, { waitUntil: 'networkidle0' })
      await prod.reload({ waitUntil: 'networkidle0' })
      await prod.keyboard.press('Escape')
      await prod.waitForFunction(
        () => document.querySelector('[data-testid=proof-sw]')?.dataset.ok === 'true' && document.querySelector('[data-testid=proof-pack]')?.dataset.ok === 'true',
        { timeout: 15000, polling: 200 },
      )
      await prod.screenshot({ path: `${OUT}/offline-mode.png`, fullPage: true })
      console.log(`${OUT}/offline-mode.png (production build)`)
      await prod.close()
    } finally {
      await new Promise((resolve) => {
        built.httpServer.closeAllConnections?.()
        built.httpServer.close(resolve)
      })
    }
  } else {
    console.log('dist/ not found: offline-mode.png shows the dev server, where no service worker runs.')
  }
} finally {
  await browser.close()
  await server.close()
}
