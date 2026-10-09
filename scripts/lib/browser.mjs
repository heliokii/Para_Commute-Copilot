import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

export const OFFLINE = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }

export function findChrome() {
  const path = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((candidate) => candidate && existsSync(candidate))
  if (!path) {
    console.error('No Chrome or Edge found. Set CHROME_PATH.')
    process.exit(1)
  }
  return path
}

export function launch(extraArgs = []) {
  return puppeteer.launch({ executablePath: findChrome(), headless: true, args: extraArgs })
}

/** Cuts the network for the page and for every service worker. */
export async function goOffline(browser, page) {
  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', OFFLINE)
  for (const target of browser.targets()) {
    if (target.type() !== 'service_worker') continue
    const session = await target.createCDPSession()
    await session.send('Network.enable')
    await session.send('Network.emulateNetworkConditions', OFFLINE)
  }
  return client
}

/** Collects PASS/FAIL lines and sets the exit code. */
export function createReport() {
  const results = []
  return {
    check(name, pass, detail = '') {
      results.push({ name, pass: Boolean(pass), detail: String(detail ?? '') })
    },
    finish() {
      for (const result of results) {
        console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? `  [${result.detail}]` : ''}`)
      }
      const failures = results.filter((result) => !result.pass).length
      console.log(`\n${results.length - failures} passed, ${failures} failed`)
      process.exit(failures > 0 ? 1 : 0)
    },
  }
}
