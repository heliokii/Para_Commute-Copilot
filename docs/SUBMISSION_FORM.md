# Submission form: final answers

Project: **Para! Offline Commute Copilot**
Team: **git inet**
Members: Daniel Aldreen Manjares, Justine Catapang, Elijah Emmanuel
Repository: https://github.com/heliokii/AppBuilder2026

Every statement below was checked in the repository or by running the build on 2026-10-09. Anything the repository cannot show is marked **[TEAM TO CONFIRM]**.

## Short Desc

Para! is an offline-first Taglish commute helper. Ask in Taglish where you are going and Tsupher, the jeepney mascot, shows route options, where to board and alight, and a fare breakdown with an "as of" date. Routes and fares come from a deterministic planner, never from AI. A small language model runs on the device and only helps read unclear questions. After one visit it works in airplane mode, and nothing the rider types is sent anywhere. The current build uses a labeled synthetic sample network, not a real corridor.

## What runs locally

- The whole app: React interface, service worker, self-hosted fonts and art, installable PWA.
- The route pack and fare table, stored in the browser (IndexedDB through Dexie).
- The route planner (Dijkstra in a Web Worker): routes, transfers, travel time, fares, avoid-lists.
- The Taglish parser rules lane (fuzzy landmark matching and cue words).
- The language model (Qwen2.5 1.5B Instruct, 4-bit), run by WebLLM on WebGPU in the browser. It reads unclear questions into a structured request and maps follow-ups. Its output is checked against the route pack before use.
- Chat explanations (sentence templates filled from the planner result) and the validator that rejects any number or place not in the result.
- The "Offline Mode" proof panel (service worker state, pack version, measured latency and tokens per second, count of requests to other servers).

## What requires internet

- Loading the app the first time (a visit to wherever the team hosts it). **[TEAM TO CONFIRM: hosting URL; the repository does not name one.]**
- The one-time model download, which the rider starts by hand from the "Gisingin si Tsupher" screen. About 840 MB for the default model. It goes to these hosts only (observed in a real download on 2026-10-09):
  - `huggingface.co` (model files, redirects)
  - `us.aws.cdn.hf.co` (Hugging Face's download network; the redirect target seen in the test, which Hugging Face may change)
  - `raw.githubusercontent.com` (the compiled model library, one `.wasm` file)
- Nothing else. After setup there are zero requests to any host other than the app's own origin. Verified with the network off and with every host except localhost unreachable (`npm run check:offline`, `npm run test:e2e`, `npm run check:llm`).
- Not verified on a phone or in real airplane mode on any device.

## Models used

| Model | Build id | Size | Licence | Weights from |
|---|---|---|---|---|
| **Qwen2.5 1.5B Instruct, 4-bit (default)** | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | about 840 MB measured download; the repository holds 869 MB | Apache-2.0 (the base model Qwen/Qwen2.5-1.5B-Instruct is tagged `license:apache-2.0` on Hugging Face) | `huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC` |

- The default is the **1.5B** model, not 0.5B. `src/ai/runtime.ts` lists four candidates and the app uses the first one WebLLM supports, unless the rider picked another on the Setup screen.
- Qwen2.5 0.5B (277 MB, Apache-2.0) is in the candidate list but is not the default. In our benchmark it got 0% of origin/destination pairs right as a standalone parser. Write "Qwen2.5-1.5B-Instruct" on the form.
- Other candidates the rider can choose: SmolLM2 1.7B Instruct (Apache-2.0, 926 MB), Llama 3.2 1B Instruct (Llama 3.2 Community License, 677 MB).
- The Hugging Face repository `mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC` carries no licence tag of its own. The Apache-2.0 licence is the base model's. **[TEAM TO CONFIRM: read the model card yourself.]**
- No model ships inside the app bundle. No speech model is used (voice is not built).
- Measured on one laptop (RTX 4050, headless Chrome 155): 25 to 38 tokens per second, about 1.5 to 2.2 s per parse once loaded, 10 to 18 s for the first load after a browser restart. Not measured on a phone.

## Technologies and Frameworks

Versions from `package.json` (range) and the installed version.

Runtime:
- React and React DOM `^19.2.8` (installed 19.3.0)
- Dexie `^4.4.6` (4.4.6), IndexedDB wrapper
- @mlc-ai/web-llm `^0.2.85` (0.2.85), on-device model runtime (WebGPU)
- @fontsource-variable/inter `^5.3.0` (5.3.0) and @fontsource-variable/fredoka `^5.3.0` (5.3.0), self-hosted fonts
- Workbox, through vite-plugin-pwa `^2.0.0` (2.0.0) and workbox-window `^7.4.1` (7.4.1): service worker

Build and test:
- Vite `^8.3.0` (8.3.4), @vitejs/plugin-react `^6.1.1`, Tailwind CSS `^4.3.3` (4.3.3) with @tailwindcss/vite
- TypeScript `^6.0.3` (6.0.3)
- Vitest `^5.0.3` (5.0.3)
- ESLint `^10.10.0` with typescript-eslint `^8.71.1`, eslint-plugin-react-hooks `^7.1.1`, eslint-plugin-react-refresh `^0.5.6`, @eslint/js `^10.0.1`, globals `^17.12.0`
- puppeteer-core `^25.13.0` (drives the locally installed Chrome for the offline and end-to-end checks), lighthouse `^13.5.0`, sharp `^0.35.5` (asset preparation)
- Node 24.13, npm 11 (the only versions used)

Web platform: Web Workers, Service Workers, IndexedDB, Cache Storage, WebGPU, Web App Manifest.

## APIs and Cloud Services

- **No cloud AI API. No analytics. No accounts. No backend of our own. No map tiles. No remote fonts.**
- The only outside services are file hosts for the one-time model download: Hugging Face (`huggingface.co`, `us.aws.cdn.hf.co`) and GitHub raw (`raw.githubusercontent.com`). Anonymous file downloads, no key, no login.
- **[TEAM TO CONFIRM: where the app itself is hosted, if anywhere.]**
- Browser APIs used: WebGPU (through WebLLM), Service Worker, Cache Storage, IndexedDB, `localStorage` (chosen model id and size only), `navigator.storage.estimate()`, Resource Timing (to count requests to other servers). Location, microphone and camera are not used.

## Existing code and assets

Code:
- Project scaffold: the Vite React template. Daniel's commit `395421f` ("Install react + vite and other initial files") added it. The template's demo files (counter, logos, stylesheet) are no longer in the repository.
- Third-party libraries: listed above and in `DISCLOSURE.md`, all installed from npm.
- Application code (router, parser, chat, validator, screens, scripts, tests) was written with an AI coding agent during the event. See next section.
- Not copied from any other project that we know of. **[TEAM TO CONFIRM: that no teammate pasted code from elsewhere.]**

Fonts (self-hosted, no remote loading):
- Inter, SIL Open Font License 1.1 (through `@fontsource-variable/inter`)
- Fredoka, SIL Open Font License 1.1 (through `@fontsource-variable/fredoka`)

Data:
- Route pack `synthetic-pack` 0.2.0-synthetic: 8 made-up landmarks, 4 made-up routes, 2 made-up fare tables, written by the coding agent for testing. Labeled "SAMPLE DATA, not verified" on screen. **No real route, terminal or fare is in the app.**
- `tests/taglish-50.json`: 50 test queries written by the coding agent. Not real rider phrasings.

Art:
- Mascot "Tsupher", logo, pose sheet and two interface mockups in `design/reference/` (reference only, never shipped). Supplied by the team. **[TEAM TO CONFIRM: who made them, with what tool, any AI image generation and its prompts, and the rights to use them.]**
- Shipped files derived from that art by `scripts/prepare-assets.mjs`: 13 mascot sprites in `public/mascot/` and 5 app icons in `public/icons/`. The cut-outs were made by automatic background removal and are drafts.
- The colour palette was sampled from the mockups. Interface icons are hand-written inline SVG. The "Para!" wordmark is live text in Fredoka.
- **[TEAM TO CONFIRM: whether the name "Para!" and the name "Tsupher" are free to use.]**

## AI development tools

- **Claude Code** (Anthropic's coding agent) wrote the application code, tests, scripts and documentation, in sessions on 2026-10-09, directed by the team through the phase prompts in `BUILD_PHASES.md`. The commit trailers for Phases 1 to 11 name **Claude Opus 5.5**. This submission-prep commit was made with **Claude Sonnet 5.5**.
- The team wrote or supplied `CLAUDE.md` and `BUILD_PHASES.md`. **[TEAM TO CONFIRM: whether any AI tool helped write them.]**
- The on-device models above were also run during development, to benchmark them (`docs/model-benchmark.md`). They generate nothing that ships.
- **[TEAM TO CONFIRM: any other AI tool used for the art, the pitch, the slides or the video.]**
- **[TEAM TO CONFIRM: the event's rules on AI-assisted work and on work started before the event.]**
