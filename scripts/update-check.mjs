// Usage: npm run build && npm run check:update
// Checks that a new service worker never reloads the app on its own: it waits,
// stays out of the way during a chat, and applies only when the rider taps
// "I-update". A new version is simulated by changing dist/sw.js by one comment.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { preview } from 'vite'
import { createReport, launch } from './lib/browser.mjs'

const PORT = 4180
const BASE = `http://localhost:${PORT}/`
const SW = 'dist/sw.js'

if (!existsSync(SW)) {
  console.error('dist/sw.js not found. Run "npm run build" first.')
  process.exit(1)
}

const { check, finish } = createReport()
const original = readFileSync(SW, 'utf8')
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' })
const browser = await launch()

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.keyboard.press('Escape')
  check('First version controls the page', await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))

  // Start a conversation, then let a new version arrive.
  await page.evaluate(() => {
    location.hash = '#/chat'
  })
  await page.waitForSelector('[data-testid=chat-input]', { visible: true })
  await page.focus('[data-testid=chat-input]')
  await page.keyboard.type('Alpha to Delta')
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-testid=chat-option]')
  await page.evaluate(() => {
    window.__sameDocument = true
  })

  appendFileSync(SW, `\n// update-check ${Date.now()}\n`)
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration.update()
  })
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
    { timeout: 20000, polling: 250 },
  )
  check('New version is downloaded and waiting', true)

  await new Promise((resolve) => setTimeout(resolve, 1500))
  const duringChat = await page.evaluate(() => ({
    same: window.__sameDocument === true,
    banner: Boolean(document.querySelector('[data-testid=update-banner]')),
    messages: document.querySelectorAll('[data-testid=tsupher-message]').length,
  }))
  check('The app did not reload by itself', duringChat.same)
  check('No update prompt on top of the chat', !duringChat.banner)
  check('The conversation is still there', duringChat.messages >= 2, `${duringChat.messages} Tsupher messages`)

  await page.evaluate(() => {
    location.hash = '#/'
  })
  await page.waitForSelector('[data-testid=update-banner]', { timeout: 5000 })
  check('Update prompt appears after leaving the chat', true)
  check('Still the same document until the rider decides', await page.evaluate(() => window.__sameDocument === true))

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }),
    page.click('[data-testid=update-banner] button'),
  ])
  const after = await page.evaluate(async () => ({
    reloaded: window.__sameDocument !== true,
    waiting: Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
    controlled: Boolean(navigator.serviceWorker.controller),
    banner: Boolean(document.querySelector('[data-testid=update-banner]')),
  }))
  check('Tapping "I-update" reloads into the new version', after.reloaded && after.controlled && !after.waiting && !after.banner, JSON.stringify(after))
} catch (error) {
  check('Update check ran to completion', false, error.message)
} finally {
  writeFileSync(SW, original)
  await browser.close()
  await new Promise((resolve) => {
    server.httpServer.closeAllConnections?.()
    server.httpServer.close(resolve)
  })
}

finish()
