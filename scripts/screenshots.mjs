// Usage: npm run screenshots
// Saves 390x844 screenshots of each screen to docs/screenshots/ for side-by-side
// review against design/reference/. Uses the dev server so dev-only screens are included.
import { existsSync, mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { createServer } from 'vite'

const PORT = 5198
const BASE = `http://localhost:${PORT}/`
const OUT = 'docs/screenshots'

// name, hash, optional setup run in the page before the shot
const SCREENS = [
  ['home', '#/'],
  ['ruta', '#/ruta'],
  ['mapa', '#/mapa'],
  ['paborito', '#/paborito'],
  ['higit-pa', '#/higit'],
  ['offline-mode', '#/offline'],
  ['about', '#/about'],
  ['dev-components', '#/dev/components'],
  ['dev-router', '#/dev/router'],
]

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
  await page.waitForSelector('button[aria-label]', { timeout: 15000 })
  await settle()
  await page.screenshot({ path: `${OUT}/splash.png` })
  console.log(`${OUT}/splash.png`)
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
} finally {
  await browser.close()
  await server.close()
}
