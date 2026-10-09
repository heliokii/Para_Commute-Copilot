// Usage: npm run build && npm run check:voice
//   VOICE_MODEL=base   use Whisper base instead of tiny
//   VOICE_FRESH=1      delete the cached voice model first, so the download is observed again
// Proves the voice plumbing end to end with GENERATED audio (Windows speech
// synthesizer played into Chrome's fake microphone). It says nothing about how
// well Whisper understands a person: that stays untested until a human speaks.
//
// Two runs:
//   1. Production build, voice only: download once, then with the network fully
//      off the mic flow must still produce a transcript (ONNX Runtime files and
//      the model come from this origin's cache, never a CDN).
//   2. Dev server on the benchmark origin, where the LLM is cached: the LLM and
//      Whisper are loaded together, every other host unreachable, and GPU memory
//      is sampled with nvidia-smi.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'
import { createServer, preview } from 'vite'
import { createReport, findChrome, goOffline } from './lib/browser.mjs'

// English, because the only installed synthesizer voices are English: they cannot
// pronounce Tagalog. Phrase 11 of docs/voice-test/PHRASES.md; Alpha to Delta, cheapest, is 18.25.
const SPOKEN = 'From Alpha to Delta, cheapest please.'
const EXPECTED_FARE = '₱18.25'
const WAV = resolve('.cache/voice/spoken.wav')
const MODEL = process.env.VOICE_MODEL === 'base' ? 'Whisper base' : 'Whisper tiny'
const FRESH = process.env.VOICE_FRESH === '1'
const BLOCK = '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost'
const GPU = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
const FAKE_MIC = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${WAV}%noloop`,
]

const { check, finish } = createReport()
const info = []

if (!existsSync('dist/sw.js')) {
  console.error('dist/sw.js not found. Run "npm run build" first.')
  process.exit(1)
}

// --- Generated audio ---------------------------------------------------------
mkdirSync('.cache/voice', { recursive: true })
try {
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.Speech
     $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
     $f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
     $s.SetOutputToWaveFile('${WAV}', $f)
     $b = New-Object System.Speech.Synthesis.PromptBuilder
     $b.AppendBreak([TimeSpan]::FromMilliseconds(700))
     $b.AppendText('${SPOKEN}')
     $s.Speak($b)
     $s.Dispose()`,
  ])
} catch (error) {
  console.error('Could not generate test audio (needs Windows System.Speech).', error.message)
  process.exit(1)
}

function gpuMb() {
  try {
    return Number(execFileSync('nvidia-smi', ['--query-gpu=memory.used', '--format=csv,noheader,nounits']).toString().trim().split('\n')[0])
  } catch {
    return null
  }
}

async function skipSplash(page) {
  await page.waitForSelector('#root > *', { timeout: 30000 })
  await page.keyboard.press('Escape')
  // The splash also closes by itself after 1.2 s; wait it out so clicks never land on it.
  await new Promise((done) => setTimeout(done, 1500))
}

const isLocal = (url, base) => url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')
const hostsOf = (urls) => [...new Set(urls.map((url) => new URL(url).host))]

async function open(browser, url, base, outside) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844 })
  page.on('pageerror', (error) => console.log('page error:', error.message))
  page.on('console', (message) => message.type() === 'error' && console.log('console error:', message.text().slice(0, 400)))
  page.on('request', (request) => {
    if (!isLocal(request.url(), base)) outside.push(request.url())
  })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await skipSplash(page)
  return page
}

// Home stays mounted under the chat, so there are two mic buttons; a real click is
// needed because the AudioContext only starts after a user gesture.
async function clickMic(page) {
  for (const handle of await page.$$('[data-testid=mic-button]')) {
    if (await handle.isVisible()) return handle.click()
  }
  throw new Error('No visible mic button')
}

const goTo = (page, hash) =>
  page.evaluate((target) => {
    location.hash = target
  }, hash)

/** Download through the Setup screen, online. Returns the hosts that were contacted. */
async function download(name, base, profile) {
  const outside = []
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, userDataDir: profile, args: GPU, protocolTimeout: 900000 })
  try {
    const page = await open(browser, `${base}#/setup`, base, outside)
    // A profile from an earlier build holds the old service worker: take the update, as a rider would.
    const update = await page.waitForSelector('[data-testid=update-banner] button', { timeout: 5000 }).catch(() => null)
    if (update) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}), update.click()])
      await skipSplash(page)
      info.push(`${name}: applied a waiting app update through the "I-update" banner`)
    }
    const card = '[data-testid=setup-voice]'
    await page.waitForSelector(card, { timeout: 60000 })
    const status = () => page.$eval(card, (element) => element.dataset.status)
    const clickByText = (text) =>
      page.evaluate((label) => [...document.querySelectorAll('button, label')].find((element) => element.textContent.includes(label))?.click(), text)

    if (FRESH && (await status()) !== 'absent') {
      await clickByText('Burahin ang voice model')
      await page.waitForFunction((selector) => document.querySelector(selector)?.dataset.status === 'absent', { timeout: 30000 }, card)
    }
    if ((await status()) !== 'absent') {
      info.push(`${name}: voice model already cached, download not observed in this run (use VOICE_FRESH=1)`)
      return
    }
    await clickByText(MODEL)
    const before = outside.length
    const started = Date.now()
    await page.click('[data-testid=setup-voice-start]')
    const sawProgress = await page.waitForSelector('[data-testid=setup-voice-progress]', { timeout: 60000 }).then(() => true, () => false)
    await page.waitForFunction((selector) => ['ready', 'error'].includes(document.querySelector(selector)?.dataset.status), { timeout: 900000, polling: 500 }, card)
    const text = await page.$eval(card, (element) => element.innerText.replace(/\s+/g, ' '))
    check(`${name}: voice model downloads from the Setup screen with a progress bar`, (await status()) === 'ready' && sawProgress, text)
    const size = await page.$eval('[data-testid=setup-voice-size]', (element) => element.textContent).catch(() => '')
    check(`${name}: Setup shows the measured size`, /\d+ MB/.test(size), size)
    const hosts = hostsOf(outside.slice(before))
    check(
      `${name}: download used the model host only, no CDN for the runtime`,
      hosts.length > 0 && hosts.every((host) => host === 'huggingface.co' || host.endsWith('.hf.co')),
      hosts.join(', '),
    )
    info.push(`${name}: ${MODEL} downloaded in ${Math.round((Date.now() - started) / 1000)} s, measured ${size}, hosts: ${hosts.join(', ')}`)
  } finally {
    await browser.close()
  }
}

/** Mic flow with outside hosts unreachable. */
async function speak(name, base, profile, { offline, withLlm }) {
  const outside = []
  const gpu = { start: gpuMb() }
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    userDataDir: profile,
    args: [...GPU, ...FAKE_MIC, BLOCK],
    protocolTimeout: 600000,
  })
  try {
    // Setup first: it checks the real caches, as a rider who downloaded the models would have.
    const page = await open(browser, `${base}#/setup`, base, outside)
    await page.waitForSelector('[data-testid=setup-voice]', { timeout: 60000 })
    await goTo(page, '#/chat')
    if (offline) {
      await page.evaluate(() => navigator.serviceWorker.ready)
      await goOffline(browser, page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await skipSplash(page)
      check(`${name}: network is fully off`, await page.evaluate(() => !navigator.onLine))
    }
    await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 15000 })
    const replies = () => page.evaluate(() => document.querySelectorAll('[data-testid=tsupher-message]').length)
    const waitReply = (count) =>
      page.waitForFunction(
        (seen) => document.querySelectorAll('[data-testid=tsupher-message]').length > seen && !document.querySelector('[data-testid=typing]'),
        { timeout: 180000, polling: 250 },
        count,
      )
    gpu.page = gpuMb()

    if (withLlm) {
      // Rules cannot finish this one, so the LLM is really loaded and used.
      const count = await replies()
      await page.type('[data-testid=chat-input]', 'Paano pumunta sa Delta?')
      await page.keyboard.press('Enter')
      await waitReply(count)
      await goTo(page, '#/offline')
      await page.waitForSelector('[data-testid=proof-inference]', { timeout: 10000 })
      const inference = await page.$eval('[data-testid=proof-inference]', (row) => ({ ok: row.dataset.ok, text: row.innerText.replace(/\s+/g, ' ') }))
      check(`${name}: LLM is loaded and answered before the mic is used`, inference.ok === 'true', inference.text)
      await goTo(page, '#/chat')
      await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 15000 })
      gpu.llm = gpuMb()
      // Start a new trip so the spoken sentence is read on its own.
      const again = await replies()
      await page.type('[data-testid=chat-input]', 'bagong ruta')
      await page.keyboard.press('Enter')
      await waitReply(again)
    }

    const count = await replies()
    const bubbles = await page.$$eval('[data-from=user]', (nodes) => nodes.length)
    await clickMic(page)
    await page.waitForSelector('[data-testid=listening][data-phase=listening]', { timeout: 15000 }).catch(async () => {
      throw new Error(`listening screen did not open: ${await page.evaluate(() => document.querySelector('[data-testid=listening]')?.innerText ?? 'no dialog')}`)
    })
    const listenStarted = Date.now()
    const screen = await page.$eval('[data-testid=listening]', (element) => ({
      text: element.innerText.replace(/\s+/g, ' '),
      rings: element.querySelectorAll('.animate-ping').length,
    }))
    check(
      `${name}: listening screen shows the title, hint, rings and Tapusin`,
      screen.text.includes('Makinig si Tsupher') && screen.text.includes('Magsalita nang malinaw sa Taglish') && screen.text.includes('Tapusin') && screen.rings === 3,
      screen.text,
    )
    await page.waitForFunction(() => document.querySelector('[data-testid=listening]')?.dataset.phase !== 'listening', { timeout: 20000, polling: 100 })
    const listenedMs = Date.now() - listenStarted
    check(`${name}: recording stopped by itself on silence, before the 8 s limit`, listenedMs < 7500, `${(listenedMs / 1000).toFixed(1)} s on screen`)

    await page.waitForFunction(
      () => ['confirm', 'note', undefined].includes(document.querySelector('[data-testid=listening]')?.dataset.phase),
      { timeout: 180000, polling: 200 },
    )
    const phase = await page.evaluate(() => document.querySelector('[data-testid=listening]')?.dataset.phase ?? 'sent')
    let chips = []
    if (phase === 'confirm') {
      chips = await page.$$eval('[data-testid=voice-chip]', (nodes) => nodes.map((node) => node.textContent))
      await page.click('[data-testid=voice-chip]')
    }
    const note = phase === 'note' ? await page.$eval('[data-testid=voice-note]', (element) => element.textContent) : ''
    check(`${name}: Whisper returned text for the generated audio`, phase !== 'note', note || phase)

    if (phase !== 'note') {
      await page.waitForFunction((seen) => document.querySelectorAll('[data-from=user]').length > seen, { timeout: 10000 }, bubbles)
      await waitReply(count)
      const heard = await page.$$eval('[data-from=user]', (nodes) => nodes[nodes.length - 1].textContent)
      const reply = await page.$$eval('[data-testid=tsupher-message]', (nodes) => {
        const node = nodes[nodes.length - 1]
        return { kind: node.dataset.kind, fares: [...node.querySelectorAll('[data-testid=chat-option-fare]')].map((fare) => fare.textContent) }
      })
      check(
        `${name}: the spoken sentence went through the chat parser and the router answered`,
        reply.kind === 'options' && reply.fares[0] === EXPECTED_FARE,
        `"${heard}" -> ${reply.kind} ${reply.fares.join(' ')}`,
      )
      info.push(
        `${name}: spoken "${SPOKEN}" -> sent "${heard}"${chips.length ? ` (confirm chips: ${chips.join(' | ')})` : ' (no confirmation needed)'} -> reply ${reply.kind} ${reply.fares.join(' ')}`,
      )
    }
    gpu.whisper = gpuMb()

    await goTo(page, '#/offline')
    await page.waitForSelector('[data-testid=proof-voice]', { timeout: 10000 })
    const proof = await page.$eval('[data-testid=proof-voice]', (row) => ({ ok: row.dataset.ok, text: row.innerText.replace(/\s+/g, ' ') }))
    check(`${name}: proof panel names the voice model, backend and measured latency`, proof.ok === 'true' && /Whisper (tiny|base)/.test(proof.text) && /Backend: (WebGPU|WASM)/.test(proof.text) && /\d+ ms/.test(proof.text), proof.text)
    if (withLlm) {
      // The voice row shows a backend only while Whisper is loaded; nothing unloads the LLM.
      const model = await page.$eval('[data-testid=proof-model]', (row) => ({ ok: row.dataset.ok, text: row.innerText.replace(/\s+/g, ' ') }))
      check(`${name}: LLM and Whisper are loaded at the same time`, model.ok === 'true' && /Backend: (WebGPU|WASM)/.test(proof.text), `${model.text} + ${proof.text}`)
    }
    info.push(`${name}: GPU memory used (nvidia-smi, whole machine, MiB): before launch ${gpu.start}, page open ${gpu.page}${withLlm ? `, LLM loaded ${gpu.llm}` : ''}, after Whisper ${gpu.whisper}`)

    check(`${name}: no request to any other host was attempted`, outside.length === 0, hostsOf(outside).join(', '))
  } finally {
    await browser.close()
  }
}

/** Microphone refused (no fake device, permission denied): typing must still work. */
async function refuse(name, base, profile) {
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, userDataDir: profile, args: [...GPU, BLOCK] })
  try {
    const session = await browser.target().createCDPSession()
    await session.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin: new URL(base).origin })
    const page = await open(browser, `${base}#/setup`, base, [])
    await page.waitForSelector('[data-testid=setup-voice]', { timeout: 60000 })
    await goTo(page, '#/chat')
    await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 15000 })
    await clickMic(page)
    const refused = await page
      .waitForSelector('[data-testid=voice-note]', { timeout: 10000 })
      .then((element) => element.evaluate((node) => node.textContent))
      .catch(() => '')
    check(`${name}: refused microphone shows a typing fallback message`, refused.includes('Hindi pinayagan ang mikropono'), refused)
    await page.click('[data-testid=voice-close]').catch(() => {})
    check(`${name}: after refusal the listening screen closes and the text box is usable`, await page.evaluate(() => !document.querySelector('[data-testid=listening]') && Boolean(document.querySelector('[data-testid=chat-input]'))))
  } finally {
    await browser.close()
  }
}

async function run(name, server, base, profile, options) {
  try {
    await download(name, base, profile)
    await speak(name, base, profile, options)
    if (options.offline) await refuse(name, base, profile)
  } catch (error) {
    check(`${name}: ran to completion`, false, error.message)
  } finally {
    await (server.httpServer?.listening ? new Promise((done) => server.httpServer.close(done)) : server.close?.())
  }
}

await run(
  'Production build',
  await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'silent' }),
  'http://localhost:4175/',
  '.cache/voice-profile',
  { offline: true, withLlm: false },
)

if (existsSync('.cache/bench-profile')) {
  const dev = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'silent' })
  await dev.listen()
  await run('With the LLM', dev, 'http://localhost:5197/', '.cache/bench-profile', { offline: false, withLlm: true })
} else {
  info.push('With the LLM: skipped, no cached LLM (run "npm run bench -- <model-id>" once)')
}

console.log(info.map((line) => `INFO  ${line}`).join('\n'))
finish()
