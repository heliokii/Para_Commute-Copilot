// Usage: npm run check:llm            (needs a model already cached by "npm run bench")
// Proves the LLM lane works with no network once the model is cached. Chrome is
// started with a resolver rule that makes every host except localhost
// unreachable, and any attempt to reach another host is counted. Then the Setup
// screen, a real on-device parse and the chat screen are exercised. Nothing is mocked.
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { createServer } from 'vite'
import { createReport, findChrome } from './lib/browser.mjs'

const PORT = 5197 // same origin as the benchmark, so its cached models are visible
const PROFILE = '.cache/bench-profile'

if (!existsSync(PROFILE)) {
  console.error('No cached model found. Run "npm run bench -- <model-id>" once (it downloads the model).')
  process.exit(1)
}

const { check, finish } = createReport()
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'silent' })
await server.listen()
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  userDataDir: PROFILE,
  args: [
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist',
    // Nothing but this machine can be resolved, so nothing can leave it.
    '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost',
  ],
  protocolTimeout: 600000,
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844 })
  page.on('pageerror', (error) => console.log('page error:', error.message))

  // Request interception stalls module workers, so attempts are only observed
  // here; the resolver rule above is what actually blocks them.
  const outside = []
  const isLocal = (url) =>
    url.startsWith(`http://localhost:${PORT}/`) || url.startsWith('data:') || url.startsWith('blob:')
  page.on('request', (request) => {
    if (!isLocal(request.url())) outside.push(request.url())
  })

  await page.goto(`http://localhost:${PORT}/#/setup`, { waitUntil: 'domcontentloaded' })
  await page.keyboard.press('Escape')
  await page.waitForFunction(
    () => /Gising na si Tsupher|Tulog pa si Tsupher|Walang WebGPU/.test(document.body.innerText),
    { timeout: 60000 },
  )
  const setupText = await page.evaluate(() => document.body.innerText)
  const modelLabel = await page.$eval('[data-testid=setup-model]', (element) => element.textContent).catch(() => '')
  check('Setup screen finds the cached model with outside hosts unreachable', setupText.includes('Gising na si Tsupher'), modelLabel)

  const result = await page.evaluate(async () => {
    const manager = await import('/src/ai/modelManager.ts')
    const { parse } = await import('/src/ai/parse.ts')
    const runtime = await import('/src/ai/runtime.ts')
    const { SYNTHETIC_PACK: pack } = await import('/src/router/__fixtures__/synthetic-pack.ts')
    const llm = manager.getLlm()
    if (!llm) return { error: `no model available (status ${manager.getModelState().status})` }

    // A request the rules cannot finish, so the model is really consulted.
    const started = performance.now()
    const parsed = await parse('Paano pumunta sa Delta?', pack, { llm })
    return {
      status: manager.getModelState().status,
      model: runtime.getLoadedModelId(),
      parsed: { status: parsed.status, lane: parsed.lane, missing: parsed.missing, intent: parsed.intent },
      parseMs: performance.now() - started,
      tokensPerSecond: runtime.getLastStats()?.tokensPerSecond,
    }
  })

  if (result.error) {
    check('Model loads from the local cache', false, result.error)
  } else {
    check('Model loads from the local cache', result.status === 'ready', result.model)
    check('Parser used the LLM lane and returned a validated result', result.parsed.lane === 'llm', JSON.stringify(result.parsed))
    check(
      'Unclear request: the model asked instead of guessing',
      result.parsed.status === 'needs_clarification',
      `status ${result.parsed.status}, ${Math.round(result.parseMs)} ms including model load, ${result.tokensPerSecond?.toFixed(0) ?? '?'} tokens/s`,
    )
  }

  // --- The chat screen with the real model ---
  await page.evaluate(() => {
    location.hash = '#/chat'
  })
  await page.waitForSelector('[data-testid=chat-input]', { visible: true, timeout: 15000 })
  const say = async (text) => {
    const before = await page.evaluate(() => document.querySelectorAll('[data-testid=tsupher-message]').length)
    await page.focus('[data-testid=chat-input]')
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    const sawTyping = await page
      .waitForSelector('[data-testid=typing]', { timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    await page.waitForFunction(
      (count) => document.querySelectorAll('[data-testid=tsupher-message]').length > count && !document.querySelector('[data-testid=typing]'),
      { timeout: 120000, polling: 250 },
      before,
    )
    return page.evaluate((typing) => {
      const nodes = [...document.querySelectorAll('[data-testid=tsupher-message]')]
      const node = nodes[nodes.length - 1]
      return {
        sawTyping: typing,
        kind: node.dataset.kind,
        text: node.innerText.replace(/\s+/g, ' '),
        fares: [...node.querySelectorAll('[data-testid=chat-option-fare]')].map((fare) => fare.textContent),
        summary: Boolean(node.querySelector('[data-testid=llm-summary]')),
      }
    }, sawTyping)
  }

  // Rules cannot finish this one (no origin), so the model is consulted and must not invent one.
  const unclear = await say('Paano pumunta sa Delta?')
  check('Chat showed the thinking indicator while the model worked', unclear.sawTyping)
  check('Chat with the model: an unclear request gets a question, not a guessed route', unclear.kind === 'clarify' && unclear.fares.length === 0, unclear.text)
  const answered = await say('galing Alpha')
  check('Chat with the model: fares still come from the router', answered.kind === 'options' && answered.fares[0] === '₱18.25', answered.fares.join(' '))
  check('Model-written summary is off by default; the template is what shows', !answered.summary && answered.text.includes('Sige! Ito ang nahanap ko:'))

  // --- Proof panel after real inference ---
  await page.evaluate(() => {
    location.hash = '#/offline'
  })
  await page.waitForSelector('[data-testid=proof-model]', { timeout: 10000 })
  const proof = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-testid^=proof-]')].map((row) => [
        row.dataset.testid.replace('proof-', ''),
        { ok: row.dataset.ok, text: row.innerText.replace(/\s+/g, ' ') },
      ]),
    ),
  )
  check('Proof panel: AI row names the installed model and the WebGPU backend', proof.model?.ok === 'true' && proof.model.text.includes('Qwen2.5') && proof.model.text.includes('WebGPU'), proof.model?.text)
  check('Proof panel: last inference shows measured latency and tokens per second', proof.inference?.ok === 'true' && /\d+ ms/.test(proof.inference.text) && proof.inference.text.includes('tokens/s'), proof.inference?.text)
  check('Proof panel: browser-counted requests to other servers is 0', proof['cross-origin']?.ok === 'true', proof['cross-origin']?.text)

  // Setup and Offline Mode were opened above; About is the third screen that reads model state.
  await page.evaluate(() => {
    location.hash = '#/about'
  })
  await page.waitForFunction(() => document.body.innerText.includes('Naka-install'), { timeout: 10000 }).catch(() => {})
  check('About marks the cached model as installed', await page.evaluate(() => document.body.innerText.includes('Naka-install')))

  check('Cached model was never fetched again: no request to any other host was attempted', outside.length === 0, outside.slice(0, 5).join(', '))
} catch (error) {
  check('LLM check ran to completion', false, error.message)
} finally {
  await browser.close()
  await server.close()
}

finish()
