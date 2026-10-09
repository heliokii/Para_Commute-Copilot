// Usage: npm run check:llm            (needs a model already cached by "npm run bench")
// Proves the LLM lane works with no network once the model is cached: every
// request that is not to this machine is blocked and counted, then the Setup
// screen and a real on-device parse are exercised. Nothing is mocked.
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
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
  protocolTimeout: 600000,
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844 })
  const blocked = []
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith(`http://localhost:${PORT}/`) || url.startsWith('data:') || url.startsWith('blob:')) {
      request.continue()
    } else {
      blocked.push(url)
      request.abort()
    }
  })

  await page.goto(`http://localhost:${PORT}/#/setup`, { waitUntil: 'domcontentloaded' })
  await page.keyboard.press('Escape')
  await page.waitForFunction(
    () => /Gising na si Tsupher|Tulog pa si Tsupher|Walang WebGPU/.test(document.body.innerText),
    { timeout: 60000 },
  )
  const setupText = await page.evaluate(() => document.body.innerText)
  const modelLabel = await page.$eval('[data-testid=setup-model]', (element) => element.textContent).catch(() => '')
  check('Setup screen finds the cached model with the network blocked', setupText.includes('Gising na si Tsupher'), modelLabel)

  const result = await page.evaluate(async () => {
    const manager = await import('/src/ai/modelManager.ts')
    const { parse } = await import('/src/ai/parse.ts')
    const { summarizeWithLlm, explainSummary } = await import('/src/ai/explain.ts')
    const runtime = await import('/src/ai/runtime.ts')
    const { planRoute } = await import('/src/router/plan.ts')
    const { SYNTHETIC_PACK: pack } = await import('/src/router/__fixtures__/synthetic-pack.ts')
    const llm = manager.getLlm()
    if (!llm) return { error: `no model available (status ${manager.getModelState().status})` }

    // A request the rules cannot finish, so the model is really consulted.
    const started = performance.now()
    const parsed = await parse('Paano pumunta sa Delta?', pack, { llm })
    const parseMs = performance.now() - started
    const parseStats = runtime.getLastStats()

    const route = planRoute(pack, {
      originId: 'A',
      destinationId: 'F',
      preference: 'cheapest',
      avoid: { landmarkIds: [], routeIds: [], modes: [], tags: [] },
    })
    const summary = await summarizeWithLlm(route, pack, llm)
    return {
      status: manager.getModelState().status,
      model: runtime.getLoadedModelId(),
      parsed: { status: parsed.status, lane: parsed.lane, missing: parsed.missing, intent: parsed.intent },
      parseMs,
      tokensPerSecond: parseStats?.tokensPerSecond,
      template: explainSummary(route, pack),
      summary,
    }
  })

  if (result.error) {
    check('Model loads from the local cache', false, result.error)
  } else {
    check('Model loads from the local cache with the network blocked', result.status === 'ready', result.model)
    check('Parser used the LLM lane and returned a validated result', result.parsed.lane === 'llm', JSON.stringify(result.parsed))
    check(
      'Unclear request: the model asked instead of guessing',
      result.parsed.status === 'needs_clarification',
      `status ${result.parsed.status}, ${Math.round(result.parseMs)} ms, ${result.tokensPerSecond?.toFixed(0) ?? '?'} tokens/s`,
    )
    // Either outcome is correct behaviour; this line records which one happened.
    check(
      'Summary pass ran through the validator',
      result.summary.text !== undefined,
      result.summary.text ? `shown: ${result.summary.text}` : `discarded (template used instead): ${result.summary.rejected?.join('; ')}`,
    )
  }
  check('Zero requests left this machine', blocked.length === 0, blocked.slice(0, 5).join(', '))
} catch (error) {
  check('LLM check ran to completion', false, error.message)
} finally {
  await browser.close()
  await server.close()
}

finish()
