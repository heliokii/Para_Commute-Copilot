# Submission form: final answers

Project: **Para! Offline Commute Copilot**
Team: **git inet**
Members: Daniel Aldreen Manjares, Justine Catapang, Elijah Emmanuel
Repository: https://github.com/heliokii/AppBuilder2026

Every statement below was checked in the repository or by running the build on 2026-10-09. Anything the repository cannot show is marked **[TEAM TO CONFIRM]**.

Lines tagged **[branch phases-7-9]** describe work that exists only on the git branch `phases-7-9` (Phases 7, 8 and 9: voice, trip mode, favorites, settings, contribution queue). They are **not in the `submission-v1` tag**. Use them only if the team submits that branch; if it submits `submission-v1`, skip them. Nothing tagged here has been run on a phone, and voice has never been tested with a human voice.

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
- **[branch phases-7-9]** Speech recognition: Whisper (tiny by default, base optional), run by transformers.js on ONNX Runtime Web, on WebGPU when available and WASM otherwise. The microphone is read only after a tap, for at most 8 seconds, at 16 kHz; the audio is wiped right after transcription and never stored or sent. The transcript is corrected against the route pack's landmark names and then goes to the same parser as typed text. The Web Speech API is not used.
- **[branch phases-7-9]** Trip mode: distance from the device's GPS to the alight point, alerts, screen wake lock. The location is used in memory only, never stored or sent. Verified with Simulated GPS only.
- **[branch phases-7-9]** Paborito (saved routes and landmarks), Settings (two unit display choices), and the "May mali ba?" contribution queue, kept in IndexedDB on the device. Reports can be exported as JSON or CSV files and imported again. Nothing is sent anywhere; "sync now" is a file the rider hands over.

## What requires internet

- Loading the app the first time (a visit to wherever the team hosts it). **[TEAM TO CONFIRM: hosting URL; the repository does not name one.]**
- The one-time model download, which the rider starts by hand from the "Gisingin si Tsupher" screen. About 840 MB for the default model. It goes to these hosts only (observed in a real download on 2026-10-09):
  - `huggingface.co` (model files, redirects)
  - `us.aws.cdn.hf.co` (Hugging Face's download network; the redirect target seen in the test, which Hugging Face may change)
  - `raw.githubusercontent.com` (the compiled model library, one `.wasm` file)
- **[branch phases-7-9]** The one-time **voice model download**, which the rider starts by hand from the same "Gisingin si Tsupher" screen: **about 142 MB for Whisper tiny (default) or 224 MB for Whisper base** (measured with the WebGPU build; about 67 and 101 MB for the WASM build, computed from file sizes, not measured). Download host: **`huggingface.co` redirecting to `us.aws.cdn.hf.co` (the same two Hugging Face hosts as the language model; no new host)**. The ONNX Runtime files (26 MB) are not fetched from a CDN: they are served by the app's own origin and cached on the device during that download.
- Nothing else. After setup there are zero requests to any host other than the app's own origin. Verified with the network off and with every host except localhost unreachable (`npm run check:offline`, `npm run test:e2e`, `npm run check:llm`).
- Not verified on a phone or in real airplane mode on any device.
- **[branch phases-7-9]** Verified by `npm run check:voice`: a Whisper download from those two hosts only, then the microphone flow with the network off, and with every host except localhost unreachable. Opening Setup, Offline Mode or About never starts a download, and a chat message cannot start one (`npm run test:e2e`, `npm run check:llm`).

## Models used

| Model | Build id | Size | Licence | Weights from |
|---|---|---|---|---|
| **Qwen2.5 1.5B Instruct, 4-bit (default)** | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | about 840 MB measured download; the repository holds 869 MB | Apache-2.0 (the base model Qwen/Qwen2.5-1.5B-Instruct is tagged `license:apache-2.0` on Hugging Face) | `huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC` |

- The default is the **1.5B** model, not 0.5B. `src/ai/runtime.ts` lists four candidates and the app uses the first one WebLLM supports, unless the rider picked another on the Setup screen.
- Qwen2.5 0.5B (277 MB, Apache-2.0) is in the candidate list but is not the default. In our benchmark it got 0% of origin/destination pairs right as a standalone parser. Write "Qwen2.5-1.5B-Instruct" on the form.
- Other candidates the rider can choose: SmolLM2 1.7B Instruct (Apache-2.0, 926 MB), Llama 3.2 1B Instruct (Llama 3.2 Community License, 677 MB).
- The Hugging Face repository `mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC` carries no licence tag of its own. The Apache-2.0 licence is the base model's. **[TEAM TO CONFIRM: read the model card yourself.]**
- No model ships inside the app bundle. On `submission-v1` no speech model is used (voice is not built).
- **[branch phases-7-9]** Speech models (downloaded on demand, never inside the bundle):

| Model | Repository | Size on device (WebGPU build, runtime files included) | Licence | Weights from |
|---|---|---|---|---|
| **Whisper tiny, multilingual (default)** | `onnx-community/whisper-tiny` | about 142 MB measured | Apache-2.0: the base model `openai/whisper-tiny` is tagged `license:apache-2.0` on Hugging Face (read 2026-10-09) | `huggingface.co/onnx-community/whisper-tiny` |
| Whisper base, multilingual (rider can choose) | `onnx-community/whisper-base` | about 224 MB measured | Apache-2.0 (`openai/whisper-base` is tagged `license:apache-2.0`) | `huggingface.co/onnx-community/whisper-base` |

  The `onnx-community` conversion repositories name those as their base model and carry no licence tag of their own. **[TEAM TO CONFIRM: read both model cards.]** Accuracy on Tagalog or Taglish speech from a person is **untested**; only one English sentence spoken by a Windows synthesizer was run (`docs/voice-benchmark.md`). Tiny is the default because it is smaller, not because it was shown to be better.
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

**[branch phases-7-9]** Added: @huggingface/transformers `^4.3.1` (4.3.1, Apache-2.0) and its dependency onnxruntime-web (1.31.0-dev, MIT), for on-device Whisper. Phase 9 added no dependency (`liveQuery` comes from Dexie). Web platform on the branch: getUserMedia, Web Audio (AudioContext and AudioWorklet), Geolocation, Screen Wake Lock, Vibration, Blob downloads and file input.

## APIs and Cloud Services

- **No cloud AI API. No analytics. No accounts. No backend of our own. No map tiles. No remote fonts.**
- The only outside services are file hosts for the one-time model download: Hugging Face (`huggingface.co`, `us.aws.cdn.hf.co`) and GitHub raw (`raw.githubusercontent.com`). Anonymous file downloads, no key, no login.
- **[TEAM TO CONFIRM: where the app itself is hosted, if anywhere.]**
- Browser APIs used: WebGPU (through WebLLM), Service Worker, Cache Storage, IndexedDB, `localStorage` (chosen model id and size only), `navigator.storage.estimate()`, Resource Timing (to count requests to other servers). On `submission-v1` location, microphone and camera are not used.
- **[branch phases-7-9]** Also used: the microphone (only after the rider taps the mic button; denied permission falls back to typing), geolocation (only in trip mode, after the rider taps "Gamitin ang GPS ko"; the Simulated GPS option uses none), Screen Wake Lock, Vibration where supported, Web Audio. The camera is never used. No new outside service or host.

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
- **[branch phases-7-9]** On the branch, the trailers name Claude Sonnet 5.5 for Phase 8 and Phase 9, Claude Opus 5.5 for Phase 7, and Claude Sonnet 5.5 for the commit that stops chat from downloading a model on its own (its code was written in the Opus 5.5 session and committed after the model was switched).
- The team wrote or supplied `CLAUDE.md` and `BUILD_PHASES.md`. **[TEAM TO CONFIRM: whether any AI tool helped write them.]**
- The on-device models above were also run during development, to benchmark them (`docs/model-benchmark.md`). They generate nothing that ships.
- **[TEAM TO CONFIRM: any other AI tool used for the art, the pitch, the slides or the video.]**
- **[TEAM TO CONFIRM: the event's rules on AI-assisted work and on work started before the event.]**
