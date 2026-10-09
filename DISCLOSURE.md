# Disclosure

Project: **Para! Offline Commute Copilot**. Team: **git inet** (Daniel Aldreen Manjares, Justine Catapang, Elijah Emmanuel). Repository: https://github.com/heliokii/AppBuilder2026. The form answers are in `docs/SUBMISSION_FORM.md`.

What is in the Para! build as of 2026-10-09, where it came from, and what has not been verified. Items marked **TEAM TO CONFIRM** are things the coding agent could not know or check.

## AI models

No model is shipped inside the app. One model is downloaded on demand from the "Gisingin si Tsupher" screen and then runs only on the device, through WebLLM on WebGPU. No cloud AI service is called anywhere.

| Model | Build id used | Publisher of the base model | Licence | Download size measured | Source |
|---|---|---|---|---|---|
| Qwen2.5 1.5B Instruct (**default**, not 0.5B) | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | Alibaba Cloud (Qwen) | Apache-2.0 | 840 MB | `huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC` |
| SmolLM2 1.7B Instruct | `SmolLM2-1.7B-Instruct-q4f16_1-MLC` | Hugging Face (SmolLM) | Apache-2.0 | 926 MB | `huggingface.co/mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC` |
| Llama 3.2 1B Instruct | `Llama-3.2-1B-Instruct-q4f16_1-MLC` | Meta | Llama 3.2 Community License | 677 MB | `huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC` |
| Qwen2.5 0.5B Instruct | `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | Alibaba Cloud (Qwen) | Apache-2.0 | 277 MB | `huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` |

- The default is the first entry of `CANDIDATES` in `src/ai/runtime.ts`; the app uses it unless the rider chose another on the Setup screen. Qwen2.5 0.5B is a listed alternative, not the default.
- The base Qwen2.5-1.5B-Instruct model is tagged `license:apache-2.0` on Hugging Face (checked 2026-10-09). The `mlc-ai` conversion repositories carry no licence tag of their own.
- All four are 4-bit quantised MLC builds listed in WebLLM 0.2.85's own model list. Sources are the repositories that list points to.
- Sizes are the growth of browser storage measured during the benchmark download, so they include the compiled model library.
- Measured on one laptop (RTX 4050, headless Chrome 155), default model: 25 to 38 tokens per second, about 1.5 to 2.2 s per parse when loaded.
- **Unverified:** licences are as commonly published for these models. Nobody opened each model card to confirm the exact licence text and any use restrictions. The Llama licence in particular has conditions. **TEAM TO CONFIRM** before submission.
- Gemma 3 1B and "Gemma-SEA-LION" were not used: Gemma 3 1B is not in this WebLLM version's list, and no SEA-LION build was tried.
- What the model does: reads a Taglish message into a structured request when the built-in rules cannot, and maps follow-up messages. Its output is checked against the route pack before use. It does not compute routes, fares, times or distances. A model-written summary feature exists but is switched off.
- Benchmark: `docs/model-benchmark.md`.

### Speech model (branch `phases-7-9`, Phase 7)

Voice input uses Whisper on the device, through transformers.js on ONNX Runtime Web (WebGPU when the browser has it, otherwise WASM). The Web Speech API is not used. Like the language model, it is not shipped in the app: the rider downloads it from the "Gisingin si Tsupher" screen.

| Model | Repository | Base model | Licence | Download size measured (WebGPU build, runtime files included) |
|---|---|---|---|---|
| Whisper tiny, multilingual (**default**) | `huggingface.co/onnx-community/whisper-tiny` | `openai/whisper-tiny` (OpenAI) | Apache-2.0 | 142 MB |
| Whisper base, multilingual | `huggingface.co/onnx-community/whisper-base` | `openai/whisper-base` (OpenAI) | Apache-2.0 | 224 MB |

- Licence: read from the Hugging Face API on 2026-10-09. `openai/whisper-tiny` and `openai/whisper-base` are tagged `license:apache-2.0`. The `onnx-community` conversion repositories name those as their base model and carry **no licence tag of their own**. **TEAM TO CONFIRM.**
- Build used: encoder fp32 with a 4-bit decoder on WebGPU; 8-bit on WASM (about 67 MB for tiny, computed from the repository file sizes, not measured).
- What it does: turns up to 8 seconds of speech into text. The text is then corrected against the route pack landmark names and goes to the same parser as typed text. It does not compute routes or fares.
- **Accuracy on human speech is untested.** Only generated audio was used (`docs/voice-benchmark.md`).

## Libraries

Runtime (shipped in the app)

| Library | Version | Licence | Use |
|---|---|---|---|
| react, react-dom | 19.3.0 | MIT | UI |
| dexie | 4.4.6 | Apache-2.0 | IndexedDB storage |
| @mlc-ai/web-llm | 0.2.85 | Apache-2.0 | On-device model runtime (WebGPU) |
| @huggingface/transformers | 4.3.1 | Apache-2.0 | On-device Whisper speech recognition |
| onnxruntime-web (dependency of the above) | 1.31.0-dev.20260914-8d85527a0 | MIT | Runs the Whisper model. Its WASM files are served by the app itself, not by a CDN. |
| workbox (through vite-plugin-pwa 2.0.0, workbox-window 7.4.1) | | MIT | Service worker, offline cache |
| tailwindcss | 4.3.3 | MIT | Styles (compiled to CSS at build time) |
| @fontsource-variable/inter | 5.3.0 | OFL-1.1 | Inter font files |
| @fontsource-variable/fredoka | 5.3.0 | OFL-1.1 | Fredoka font files |

Build and test tools (not shipped)

| Tool | Version | Licence |
|---|---|---|
| vite | 8.3.4 | MIT |
| @vitejs/plugin-react | 6.1.2 | MIT |
| @tailwindcss/vite | 4.3.3 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| eslint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals | 10.12.0 and others | MIT |
| vitest | 5.0.3 | MIT |
| puppeteer-core (drives the locally installed Chrome) | 25.13.0 | Apache-2.0 |
| lighthouse | 13.5.0 | Apache-2.0 |
| sharp | 0.35.5 | Apache-2.0 |

Versions and licences were read from the installed packages' `package.json` files on 2026-10-09. Transitive dependencies are not listed.

## Data

| Data | What it is | Verified? |
|---|---|---|
| Route pack `synthetic-pack` 0.2.0-synthetic | 8 made-up landmarks ("SYN ..."), 4 made-up routes, 2 made-up fare tables, at coordinates near latitude 0, longitude 0. Written by the coding agent to test the router. | It is not real and is labeled "SAMPLE DATA, not verified" on screen. No real route, terminal or fare is in the app. |
| Fare tables | Synthetic values chosen to be unlike any real fare matrix. | Not real. No LTFRB figure is used anywhere in the app. |
| `tests/taglish-50.json` | 50 test queries written by the coding agent against the synthetic pack. | Seed set only. Not real rider phrasings. |
| Ride-verified corridor data | None yet. Templates and a collection guide exist (`data/templates/`, `docs/DATA_COLLECTION.md`). | Not collected. |

The fare-hike details and other facts in `CLAUDE.md` section 3 were research notes for planning. None of them is encoded in the app. Their sources are listed in `CLAUDE.md` section 11 and were not re-checked during the build.

## Fonts

- Inter (variable), SIL Open Font License 1.1, self-hosted from `@fontsource-variable/inter`.
- Fredoka (variable), SIL Open Font License 1.1, self-hosted from `@fontsource-variable/fredoka`.
- No font is loaded from a remote server.

## Mascot, logo and illustrations

- Files: `design/reference/Para_.png` (hero mascot), `Appearances.png` (pose sheet), `Logo.png` (icon art), and two interface mockups ("UI Showcase", "Dashboard"). These were supplied by the team and added to the repository on 2026-10-09.
- **TEAM TO CONFIRM: how this art was made (tool or artist, prompts if AI-generated, dates, and the rights to use it).** The coding agent does not know and has not guessed.
- Derived files made by scripts in this repository: the 12 mascot sprites and the hero in `public/mascot/` (cut out of the pose sheet by `scripts/prepare-assets.mjs`, with automatic background removal), and the app icons in `public/icons/` (resized from `Logo.png`).
- The "Para!" wordmark in the app is live text in Fredoka, not artwork.
- The colour palette was sampled from the mockups by `scripts/sample-tokens.mjs`.
- Interface icons are hand-written inline SVG paths in `src/components/Icon.tsx`.

## AI-assisted development

- The application code, tests, scripts and the documents in this repository (README, DEMO, this file, GAP, the files under `docs/`) were written with **Claude Code**, Anthropic's coding agent, using the model **Claude Opus 5.5** for Phases 1 to 11 and **Claude Sonnet 5.5** for the submission-prep commit. On branch `phases-7-9`, the commit trailers name Claude Sonnet 5.5 for Phase 8 and Phase 9, and Claude Opus 5.5 for Phase 7. The commit after Phase 7 (the one that stops chat from downloading a model on its own) also names Sonnet 5.5, but its code was written in the Opus 5.5 session and committed after the model was switched, in sessions on 2026-10-09, directed by the team through the phase prompts in `BUILD_PHASES.md`. Commits from that session carry a `Co-Authored-By: Claude Opus 5.5` line.
- `CLAUDE.md` and `BUILD_PHASES.md` (the plan and the phase prompts) were supplied by the team. **TEAM TO CONFIRM** whether and which AI tools helped write them.
- The on-device models above were also used during development, to run the benchmark.

## Network use

- At runtime the app makes no network request, with one exception the rider starts by hand: downloading a model from the Setup screen. That download goes to exactly three hosts, observed in a real download on 2026-10-09: `huggingface.co` (model files, which redirect), `us.aws.cdn.hf.co` (Hugging Face's download network, the redirect target seen; it may change) and `raw.githubusercontent.com` (the compiled model library). No key or login is used. After setup there are zero requests to any host except the app's own origin.
- While online, the browser itself re-checks the service worker file for updates. That request carries no user data.
- No analytics, no accounts, no remote fonts, no map tiles.
- The rider's typed text, route requests and results are not sent anywhere and are not stored on disk. The chosen model's id and measured size are kept in `localStorage`.
- Voice (branch `phases-7-9`): downloading the speech model uses the same two Hugging Face hosts, `huggingface.co` and `us.aws.cdn.hf.co` (observed 2026-10-09; the second is a redirect target and may change). The ONNX Runtime WASM files come from the app origin. By default transformers.js would fetch them from `cdn.jsdelivr.net`; that is overridden, and `npm run check:voice` confirms no request leaves for any other host.
- The microphone is asked for only when the rider taps the mic button. Audio is kept in memory for at most 8 seconds, transcribed on the device, then wiped. It is never stored or sent.
- Location: on branch `phases-7-9` trip mode reads GPS on the device only (Phase 8). It is not stored or sent.

## Local data the rider creates (branch `phases-7-9`, Phase 9)

Stored in IndexedDB on the device only. No account, no upload, no sync.

| Data | What it holds | Where it goes |
|---|---|---|
| Favorites | A saved trip (landmark ids, preference, avoid-list, route pack id and version) or a saved landmark. No fare or time is stored. | Nowhere. Deleted by "Burahin lahat ng data". |
| Settings | Two display choices: Oras and Distansya. | Nowhere. |
| Contribution queue ("May mali ba?") | What was wrong (one of five), an optional note of up to 500 characters the rider types, the trip's landmark and route ids, the route pack version, the fare date, a random id. | Nowhere by itself. The rider can export it as a JSON or CSV file and hand it over; the app does not send it. |
| Recent searches | Landmark ids and a preference, in memory only. | Forgotten when the app closes or the session is reset. |

- Exporting marks a report "exported". That means a file was made, not that anyone received it.
- Import accepts only our JSON format or a CSV with the same columns, checks every row, ignores any status or extra field in the file, and skips a report whose id it already has.
- "Burahin lahat ng data" deletes favorites, settings, reports and the session. It keeps the route pack and the offline copy of the app. Ticking a separate box also deletes the selected AI model and the voice model.
- No library or model was added in Phase 9.

## Not verified, in one list

1. Model licences and their conditions (read from memory of the model cards, not re-checked).
2. Origin of, and rights to, the mascot, logo and mockup art.
3. Whether AI tools helped write the planning documents.
4. Anything on a phone: nothing was run on iOS or Android.
5. Real routes, fares and terminals: none collected.
6. The "Para!" name: `CLAUDE.md` notes it should be checked for prior use. Not checked.
7. Transitive dependency licences.
8. Voice accuracy on human speech, voice on any phone, and the licence of the `onnx-community` Whisper conversions.
9. Real GPS (trip mode was verified with Simulated GPS only), the wake lock, vibration and the chime, on any device.
10. Phase 9 on any phone, including how a phone saves the exported file and opens the import file picker.
11. Whether a spreadsheet opens an exported CSV safely: the formula guard was tested only by a round trip in code.
