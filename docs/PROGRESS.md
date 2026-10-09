# Progress log

One entry per phase: what passed, what failed, assumptions. Phase prompts are in `BUILD_PHASES.md`.

## Phase 1: offline PWA shell (2026-10-09)

**Passed**
- Build and lint clean.
- Service worker registers and controls the page; app loads with the network off and with the server stopped.
- Dexie schema from `CLAUDE.md` 7.3; Home and About screens; light and dark themes; reduced motion respected.

**Not done**
- Install prompt not tested (headless Chrome cannot click it).
- Not tested on a real phone or in real airplane mode.
- `agent-skills/` files did not exist, so none were loaded.

## Phase 2: router + tests (2026-10-09)

**Passed**
- `npm run lint`: clean.
- `npm run build`: clean. Precache 12 entries, 514 KiB.
- `npm test`: 45 of 45 (router 31, fare 5, CSV and validator 9).
- `npm run check:offline`: 17 of 17, including "production build has no dev harness".
- Dev harness at `#/dev/router`, driven in headless Chrome through the real worker and Dexie: results match the hand-computed fixture values (A to F: 26.00 / 35.25 / 30.25; avoid tag EDSA: 30.25 and simulated; A to H: `no_path`).
- `npm run validate:pack -- data/templates`: 0 errors, 5 "no data rows" warnings.

**Failed or not verified**
- Nothing failed.
- The router worker is not in the production bundle yet. Only the dev harness imports it, so the bundler drops it. It ships when Phase 4 wires the plan screens. The worker was verified under `npm run dev` only.
- Upgrading a browser that still holds the Phase 1 sample rows was not tested in a real profile (the re-seed logic is covered by reading the code, not by a test).
- `validate:pack` needs Node 24 or newer (it imports TypeScript directly).

**Assumptions**
- Walking speed 4.5 km/h, walk radius 300 m straight-line, walk minutes rounded up to whole minutes. Config constants, not data.
- Transfer penalty 5 minutes, used only to rank `fastest`. It is not added to `totalMinutes`.
- Waiting time is not modeled.
- `transfers` = ride legs minus one. Walking legs do not count.
- Two legs in a row on the same route are not allowed (prevents fare splitting). Two walks in a row are not allowed.
- Riding through an avoided landmark counts as using it. A landmark carrying an avoided tag is avoided too.
- Routes are one-directional. The return trip must be its own route.
- Origin equal to destination returns `no_route` with reason `same_origin_destination`.
- `reason` is a code, not a sentence. Phase 4 maps codes to Taglish copy.
- `fareAsOf` is the oldest effective date among the fare tables used, or `null` for a walk-only result.
- A route whose fare table is missing is skipped and named in `assumptions[]`.
- Default rounding is nearest 0.25 peso when a fare table has no rule. Fares are computed in whole centavos.
- Discounts (student, senior, PWD) are not modeled.

**Changes beyond the Phase 2 prompt**
- `routes.csv` added as a fifth template (route-level fields need a home).
- `puppeteer-core` added as a devDependency for `check:offline` (approved).
- Phase 1 placeholder rows in Dexie replaced by the synthetic pack. The Dexie schema string is unchanged; rows now carry string ids.
- Extra types: `RoutePack`, `RouterConfig`, `RoundingRule`, `NoRouteReason`, `Leg`.

**Open items for the team**
- The showcase arrived during this phase as `design/reference/Para! Commute Copilot UI Showcase.png`, with `Para! Commute Copilot Dashboard.png`. Both were committed with Phase 2. File names differ from `BUILD_PHASES.md` 2.1.
- Phase 3 asset prep (`BUILD_PHASES.md` 2.9) is not done: no `public/mascot/` sprites, no transparent hero, no wordmark.

## Phase 3: Tsupher theme + shell (2026-10-09)

**Passed**
- `npm run lint`: clean. `npm run build`: clean. `npm test`: 45 of 45.
- `npm run check:offline`: 21 of 21. New checks: mascot images load from cache, both fonts load offline, mascot assets 304 KiB (budget 1 MB), precache 1016 KiB (budget 2 MB), no dev screens in the production build, the name "Kuya Para" appears nowhere.
- Tokens sampled from `design/reference/` by `npm run tokens` into `src/styles/tokens.css`, with source pixel and contrast ratios recorded in the file.
- Components: Tsupher, Button, Card, Chip, StatusPill, TopBar, BottomNav, BottomSheet, Banner, ProgressBar, Bubble (plus Icon).
- Screens: Splash, Home, Offline Mode (static), Higit Pa, About. Ruta, Mapa and Paborito are labeled stubs.
- `npm run screenshots` saves 390x844 shots of every screen to `docs/screenshots/`.
- All strings in `src/copy.ts`. No mockup values (fares, times, sizes, place names) anywhere.

**Failed or not verified**
- Nothing failed.
- Tab state survival is by construction (all tabs stay mounted); there is no automated test for it.
- Contrast was computed for the token pairs only, not audited per screen. Full accessibility pass is Phase 10.
- Not compared pixel by pixel with the showcase; only by eye from the screenshots.

**Missing assets (placeholders in use)**
- Wordmark art: missing. "Para!" is live text in the display font on Splash and Home.
- Mascot sprites: no clean exports were supplied. `npm run assets` cuts the 12 sprites out of `Appearances.png` automatically (flood-fill of the beige background). They are drafts: about 170 px source size, upscaled 2x, with rough edges on the map and motion-line sprites.
- Maskable icon: `Logo.png` is a full-bleed tile with the mascot cropped at the corner, so the mascot is not inside the 80% safe zone. The same art is used for all icon sizes.
- Hero: `Para_.png` already had a transparent background, so it was used directly.

**Assumptions**
- No dark variant (the showcase theme is the only required one). `prefers-color-scheme` handling from Phase 1 was removed.
- `ink-muted` is derived, not sampled: anti-aliased small text cannot be sampled reliably. It is ink-dark blended toward cream until contrast on cream reaches 5:1.
- Display font: Fredoka (SIL OFL 1.1), latin subset only, self-hosted through `@fontsource-variable/fredoka`.
- Offline Mode rows are static. The AI Assistant row is shown as not installed because no model ships yet; the mockup's size figure is not used.
- Status pill: offline shows the green dot (it is the good state), online shows terracotta.
- The Home prompt box accepts text but only shows a notice; the chat arrives in Phase 6. The Voice Chat tile opens a "coming soon" sheet.
- New devDependencies: `sharp` (asset and token scripts), `@fontsource-variable/fredoka`.

## Phase 4: plan flow (2026-10-09)

**Passed**
- `npm run lint`: clean. `npm run build`: clean. Precache 27 entries, 1061 KiB.
- `npm test`: 62 of 62 (adds custom preference 8, fare breakdown 1, fuzzy matcher 8).
- `npm run check:offline`: 21 of 21.
- `npm run test:e2e` (new, production build, network off): 29 of 29. Covers plan, results, detail, fare sheet, Trip placeholder, map, avoid-EDSA what-if, custom preference, no-route state, and zero network use.
- The router worker now ships in the production bundle and is in the precache.
- Screens: Ruta (pickers with fuzzy autocomplete over names and aliases, preference chips, Hanap), Results, Route detail with fare breakdown sheet and Tandaan box, Mga Mode, schematic SVG map with pan, zoom and legend, Trip placeholder.

**Failed or not verified**
- Nothing failed.
- Map pan by drag, wheel zoom and pinch zoom were not exercised by a test; only the zoom buttons were.
- Map labels can still collide when two stops are close (seen with two stops in the sample pack). Zooming separates them.
- No link to the official LTFRB fare matrix yet (`CLAUDE.md` rule 6). `FareEntry` has no URL field and no real URL has been supplied; the fare sheet shows the source note and effective date only.

**Assumptions**
- "Persist the last result" means the in-memory plan session (`src/state/plan.ts`), shared by the Ruta and Mapa tabs. It is not written to disk, per `CLAUDE.md` rule 5.
- Custom Preference needed router support: new preference `custom` with `Intent.weights` (fare, minutes, transfers). At equal weights 1 peso = 1 minute and one transfer = 10 minutes (`customTransferMinutes`, a config constant).
- Results show the option that answers the rider's chosen preference first, tagged "Pinili mo". The other options keep the label of the first preference that produced them.
- "N sakay" counts ride legs; "N lipat" is the router's `transfers`.
- Iwas Traffic / Iwas EDSA adds the tag `EDSA` to the avoid-list. Results are labeled Simulated with a note that the app cannot know real traffic.
- Tandaan shows only `route.note`. For the sample pack that note is the synthetic-data label.
- Wika and Unit rows are visual stubs. No aircon option exists.
- The heart button is a disabled stub.
- Mode colours for the map are chosen for contrast on cream, not sampled from the showcase.

## Phase 5: understand layer (2026-10-09)

**Passed**
- `npm run lint`: clean. `npm run build`: clean.
- `npm test`: 118 of 118. New: parser 20, explanation validator 20, plus Phase 6 groundwork already in the tree.
- `npm run check:offline`: 23 of 23. App shell precache 1072 KiB. The lazy WebLLM runtime chunk (5897 KiB, 2.2 MB gzipped) is precached separately so the LLM lane works offline. No cloud AI endpoint in the bundle.
- `npm run test:e2e`: 31 of 31 with the network off, rules lane, including the Setup screen.
- `npm run check:llm` (new): 6 of 6. With every request off this machine blocked, the cached model loaded, the parser used the LLM lane, and zero requests were attempted.
- Setup screen "Gisingin si Tsupher" exercised by hand-script with a real download (Qwen2.5 0.5B): progress shown, ready state, 277 MB measured from `navigator.storage.estimate()`, state survives reload, delete returns storage to 0.
- `npm run bench`: four models run on-device over 50 queries. Results in `docs/model-benchmark.md`, raw data in `docs/benchmark/`.

**Benchmark (real runs, laptop RTX 4050, headless Chrome 155, WebLLM 0.2.85)**

| Model | O/D exact | Preference | Avoid | Asks when unclear | All fields | p50 | Load (cached) | Download |
|---|---|---|---|---|---|---|---|---|
| Qwen2.5 1.5B Instruct | 41% | 41% | 93% | 100% | 48% | 1729 ms | 14.8 s | 840 MB |
| SmolLM2 1.7B Instruct | 80% | 86% | 91% | 33% | 62% | 1931 ms | 10.6 s | 926 MB |
| Llama 3.2 1B Instruct | 43% | 32% | 7% | 33% | 6% | 1409 ms | 10.1 s | 677 MB |
| Qwen2.5 0.5B Instruct | 0% | 0% | 48% | 50% | 6% | 808 ms | 4.1 s | 277 MB |

These are the "LLM lane alone" rows. Rules alone scored 100% on the same set, and the app sends only 6 of the 50 queries to the model.

**Recommended model:** Qwen2.5 1.5B Instruct, now the default. It was the only model that always asked instead of guessing on unclear queries. Full reasoning and caveats are in `docs/model-benchmark.md`.

**Failed or not verified**
- Gemma 3 1B IT is not in WebLLM 0.2.85's model list, so it was not benchmarked.
- The 50 queries are a seed set I wrote against the synthetic pack, and I tuned the rules on that same set (two rule fixes after the first run took it from 48 to 50). The 100% rules score is a regression guard, not an accuracy claim. The team still owes real rider phrasings.
- On this set the model adds no accuracy over rules. Its value is unproven.
- Only one prompt design was benchmarked for all models (after one revision: the first prompt let the 0.5B model write run-on lists, 32 invalid replies out of 100; the schema now restricts places to an enum of pack names).
- The summary pass in `check:llm` was discarded by the validator (the model's JSON was cut off at the token limit), so the template was used. That is the designed fallback, but it means no model-written summary has been shown yet.
- `navigator.storage.persist()` was not granted in headless Chrome. Behaviour on real browsers is untested.
- No phone was tested. Model licences are as listed on the model cards and should be checked before submission.
- WASM fallback does not exist in WebLLM; without WebGPU the app uses the rules lane only.

**Assumptions**
- Network use: the model download is the one runtime network use, started by the rider from the Setup screen. It goes to the model host WebLLM is configured for (Hugging Face and GitHub raw). The in-app "bytes sent" tally will count those request URLs during a download.
- The model runs on the main thread through WebLLM's async API, not in a worker, to avoid shipping the 6 MB runtime twice.
- Chosen model id and its measured size are kept in `localStorage` (three small keys). No user text is stored anywhere.
- Parser never guesses: two bare places with no cue word, a missing place, or two places for one slot all return `needs_clarification`.
- A typo-level landmark match counts only when the text also has a cue or travel word, so "kanta" does not become "Kanto".
- LLM output is re-resolved through the fuzzy matcher. A place the pack does not know is dropped, never passed on.
- `ParseResult` gained `missing` and `partial` beyond the phase spec, for follow-up questions in Phase 6.
- New dependency: `@mlc-ai/web-llm` (Apache-2.0).
- Benchmark downloads live in `.cache/bench-profile` (about 2.8 GB, git-ignored). Delete the folder to reclaim the space.

## Phase 6: Tsupher chat (2026-10-09)

**Passed**
- `npm run lint`: clean. `npm run build`: clean.
- `npm test`: 119 of 119.
- `npm run check:offline`: 23 of 23.
- `npm run test:e2e`: 43 of 43 with the network off (rules lane). New chat steps: Home prompt opens the chat, "may mas mura?", the "Iwas EDSA" chip (simulated), "bakit ito?", out-of-scope refusal, lifting the avoid, option card to Route detail and back, mic disabled.
- `npm run check:llm`: 8 of 8 with the real model (Qwen2.5 1.5B) and every other host unreachable. The chat showed router fares, the thinking indicator, and no outside request was attempted.

**The 10 scripted conversations (rules lane, `src/ai/chat.test.ts`): all pass**

| # | Conversation | Asserted result |
|---|---|---|
| 1 | ask A to F, "May mas mura?" | 26.00 stays first, not simulated |
| 2 | ask, "mas mabilis naman" | R2 A>C + R3 C>F, 35.25, 27 min |
| 3 | ask, "yung walang lipat" | R1 A>F, 0 transfers |
| 4 | ask, "iwas EDSA" | simulated, 30.25, every option simulated |
| 5 | ask, "Paano kung sarado ang Echo?" | simulated, landmark E avoided, R1 A>F |
| 6 | ask, "iwas EDSA", "mas mabilis", "okay na ang EDSA" | 50.00 simulated, then 35.25 and no longer simulated |
| 7 | "Paano pumunta sa Delta?", "galing Alpha" | asks for origin, then 18.25 |
| 8 | bare place answers the question asked | origin or destination filled correctly |
| 9 | "magkano?", "bakit ito?", "ulitin mo" | answers built from the RouteResult only |
| 10 | out of scope, no route, "sa Delta na lang", "bagong ruta", "mas mura" | refusal, `no_path`, new destination, reset, then asks instead of inventing |

The explain validator rejects an invented fare (`rejects an invented fare`, `discards text with an invented fare`), plus invented times, distances, places and routes.

**Failed or not verified**
- Nothing failed.
- No model-written summary has reached the screen in a kept run. In one real run the model's summary passed the fact check but was poorly worded and stated no fare; I added a rule that a summary must state the total fare, and the same model's text is now discarded and the template shown. Treat the summary pass as unproven for the demo.
- The LLM follow-up lane (`mapFollowup` with a model) was not exercised with a real model; only its validator was tested with hand-written JSON.
- The first chat message after a reload waits for the model to load from disk (about 12 to 15 s on the test laptop). A "Ginigising ang model…" note is shown.
- Not tested on a phone.

**Deviation from the phase prompt**
- "Streamed tokens": model text is never shown as it is generated, because it must pass the validator first. Validated text is revealed a few words at a time, which is cosmetic. Showing raw tokens would let an unchecked fare appear on screen.

**Assumptions**
- Order of understanding: answer to a pending question, then a complete new trip (rules), then a follow-up on the current trip (rules, then model), then a model read of a new trip, then ask or refuse.
- The validator is unit-aware: pesos, times, distances and counts are checked against separate sets, so a real minute count cannot pass as a fare. A test caught the first version accepting `₱15.00` because 15 was a valid minute count.
- Tsupher's lead sentences come from `src/copy.ts`; route facts come from templates over the RouteResult.
- Quick-reply chips are built from the pack's own tags ("Iwas EDSA" appears because the sample pack has that tag).
- Chat results also update the Ruta and Mapa tabs. The detail screen's back button returns to wherever it was opened from.
- The session keeps the last 12 turns in memory only.
- A dev-only line under each Tsupher message shows lane, latency and tokens per second.

## Phase 10: proof + hardening (2026-10-09)

Phases 7 (voice), 8 (trip mode) and 9 (favorites, settings) were skipped on instruction, so nothing in this phase covers them.

**Passed**
- `npm run lint`: clean. `npm run build`: clean. `npm test`: 122 of 122.
- `npm run check:offline`: 29 of 29. New: every proof-panel row is checked against real state (service worker controlling the page, pack version and fare date, AI row unticked with no model, no inference claimed before one happens, zero cross-origin requests).
- `npm run test:e2e`: 47 of 47, network off, rules lane. New: stale-fare warning, pack version on results, error boundary crash screen and retry.
- `npm run check:update` (new): 8 of 8. A new service worker waits, shows no prompt during a chat, and applies only on "I-update".
- `npm run check:llm`: 12 of 12 with the real model and every other host unreachable. The proof panel showed the model name, WebGPU backend, 1590 ms and 29 tokens/s for the last reply, and 0 requests to other servers.
- `npm run audit` (new): Lighthouse 13.5 on a simulated slow phone: Performance 90, Accessibility 100, Best Practices 100, SEO 100. Full report in `docs/audit.md`.

**Numbers**
- App shell precache: 1112 KiB (790 KiB gzipped), 27 files.
- AI runtime chunk: 5897 KiB (2089 KiB gzipped), lazy, precached for offline.
- First-load page transfer (Lighthouse): 306 KiB in 14 requests. The service worker then precaches 2879 KiB gzipped in the background.
- Throttled (slow 4G, 4x CPU): First Contentful Paint 2.2 s, Largest Contentful Paint 2.9 s, Time to Interactive 3.0 s, Total Blocking Time 100 ms.
- Model download: 277 MB to 926 MB depending on the model; shown on the Setup screen after download.

**Fixed in this phase (found by the audit)**
- Invalid `robots.txt`; a terracotta-on-cream label at 3.6:1; a 1 px submit button; bottom nav, Home header, Setup card and Detail fare overflowing at 200% text; mascot images scaling with text.
- The model-written summary pass is now off by default (`LLM_SUMMARY_ENABLED`). With the real model it took about 20 s per answer, blocked the input meanwhile, and its text was rejected every time.

**Failed or not verified**
- Nothing failed.
- Not tested on any phone. `docs/IOS_NOTES.md` is written from documentation only, and says so on every point.
- "Low memory" and "storage full" handling: the messages exist and errors are sorted by name and wording, but neither condition was produced for real.
- The model-load failure path in the chat (Tsupher says the model did not open, then uses rules) was not triggered by a real failure.
- No screen reader was used. The accessibility sweep is a custom script, not a full WCAG audit.
- Lighthouse audits the Home screen only.
- The E2E script uses headless Chrome through puppeteer-core, not Playwright as the phase prompt names. Same coverage, different tool (already in the repo).
- "WASM" backend: WebLLM has no WASM path, so the backend row reads WebGPU or says rules are in use.

**What remains risky**
- Real data: the app still runs on the synthetic pack. Nothing about real routes or fares has been exercised.
- Phones: model memory use, download size and speed are unknown on the devices riders have.
- The model adds no measured accuracy over rules on the current test set.
- Performance sits at about 90; the 393 KiB main bundle is not code-split.
- OneDrive: the repo lives in a OneDrive folder, and one file write failed mid-edit with a sync lock during this phase. Consider moving the repo out of OneDrive.

**Assumptions**
- Fare tables older than 180 days get a stale warning (`FARE_STALE_DAYS`). The sample pack's date (2026-01-01) is past that, so the warning shows today.
- Cross-origin requests are counted with the browser's resource timing, which also sees requests made by libraries.
- GPS and Search rows from the mockup were dropped from the proof panel: the app does not use location at all in this build, and "search" is covered by the route pack row. Showing them ticked would not be derived from state.
- New devDependency: `lighthouse`.

## Phase 11: demo + submission (2026-10-09)

**Passed**
- `npm run lint`, `npm run build`, `npm test` (122 of 122), `npm run check:offline` (29 of 29), `npm run test:e2e` (47 of 47), `npm run check:update` (8 of 8): all pass after the documentation and hygiene changes.
- Written: `DEMO.md` (three-minute script, pre-flight checklist, fallback line), `DISCLOSURE.md`, `GAP.md`, `docs/SUBMISSION.md`, a rewritten `README.md` with an architecture diagram and screenshots.
- Repo hygiene: no secrets, keys or personal data found in tracked files; `.gitignore` covers `node_modules`, `dist` and the benchmark profile; dev-only screens are absent from the production bundle (checked by `check:offline`); one reply key that no code produced was removed; the Chrome lookup is shared by all scripts; one stale screenshot was deleted.
- App code changed only for that unused key. No demo-blocking bug was found.

**Could not be verified (also flagged inside the documents)**
- `DISCLOSURE.md`: how the mascot, logo and mockups were made and the rights to them; the exact licence text of each model; whether AI tools helped write `CLAUDE.md` and `BUILD_PHASES.md`. Marked TEAM TO CONFIRM.
- `GAP.md`: every result cell is empty. No competitor app was tested by anyone.
- `DEMO.md`: the script was not rehearsed or timed by a person. Timings are estimates. The fares quoted are the fixture values the automated tests assert.
- `DEMO.md`: voice and the arrival alert are named in the Phase 11 prompt but are not built; the script marks both as slots to skip.
- `docs/SUBMISSION.md`: the event's rules on AI-assisted work and on work done before the event were not checked. When the planning documents and the art were created is not in git.
- `README.md`: "may work on Node 22" is a guess; only Node 24.13 was used.
- `docs/IOS_NOTES.md`: nothing in it was tested on a device.

**Assumptions**
- The demo script uses the synthetic place names, because that is what the build contains. It must be rewritten when real corridor data arrives.
- The optional "show the model" step is kept out of the main three minutes, since a complete question never reaches the model.

**Open items for the team (same list as `docs/SUBMISSION.md`)**
1. Ride-verify one corridor and replace the synthetic pack.
2. Run the airplane-mode tests in `GAP.md`.
3. Fill the TEAM TO CONFIRM items in `DISCLOSURE.md`.
4. Test on a real phone.
5. Record the backup demo video.
6. Check the name "Para!".
7. Add real Taglish queries and rerun the benchmark.
8. Phases 7, 8 and 9 are not started.

## Phase 8: trip mode (2026-10-09, branch `phases-7-9`, from tag `submission-v1`)

**Built**
- Trip screen from "Simulan ang Ruta": Taglish location explainer first, then current leg, next landmark, distance to the alight point, progress bar, wake-lock note.
- Pure logic in `src/trip/trip.ts` (haversine distance, accuracy filter, alert levels, leg advance, simulated track). Thresholds 1000 / 300 / 100 m, accuracy limit 50 m and pass radius 40 m are constants in `TRIP_CONFIG`.
- `src/trip/useTrip.ts`: `watchPosition`, simulated replay, Wake Lock (re-acquired when the page is visible again), WebAudio chime, `navigator.vibrate`. Only the distance to the alight point is kept in state; no position is stored or sent.
- Alert screen: "Malapit na ang babaan!", distance, "Para po!" bubble, Jumping sprite, "Sige, Tsupher!". Ride legs only; walking legs advance silently.
- Simulated GPS: speeds 30 / 120 / 600 / 3600 km/h, "Simulated GPS" banner on the trip screen and on the alert screen.
- Multi-leg: advances when within 40 m of the alight point, or on "Nakababa na ako". Last leg shows a finish card.

**Passed**
- `npm run lint`, `npm run build`, `npm test` (138 of 138, 16 new in `src/trip/trip.test.ts`), `npm run check:offline` (29 of 29), `npm run test:e2e` (56 of 56, network off, includes a simulated trip to both alerts and the finish), `npm run check:update` (8 of 8), `npm run check:llm` (12 of 12), `npm run audit` (Performance 89, Accessibility 100, Best Practices 100, SEO 100).
- Precache: 28 entries, 7019.65 KiB (previous build: shell 1112 KiB + AI chunk 5897 KiB).

**Not tested**
- Real GPS on any device: `watchPosition` error and permission-denied paths, accuracy values, fix rate, and the 40 m pass radius with real jitter.
- Wake Lock, vibration and chime on a phone. The e2e run does not assert Wake Lock. Vibration does not exist on iOS.
- Screen readers on the alert dialog.
- The audit still loads `#/ruta/trip` with no plan, so it sees the "no route selected" card, not the consent or trip screens.
- Performance moved from 90 to 89 in the audit; not investigated (may be run-to-run noise).

**Known limits**
- "Passed the alight point" is a 40 m radius check. A sparse GPS stream can skip it; "Nakababa na ako" covers that.
- The simulated track runs through the pack's stops in straight lines; it is not a road path.
- No background operation: the screen must stay on. `DEMO.md` still marks the arrival alert as a slot to skip (unchanged on this branch).

## Phase 7: voice (2026-10-09, branch `phases-7-9`, after Phase 8)

**Built**
- On-device Whisper through transformers.js 4.3.1 on ONNX Runtime Web: WebGPU when available, else WASM. No Web Speech API (`check:offline` asserts it is absent from the bundle).
- ONNX Runtime WASM self-hosted: the two runtime files are emitted into `dist/assets` and `wasmPaths` points at them, so nothing is fetched from jsdelivr. They are not in the first-run precache (26 MB); transformers.js stores them in Cache Storage when the rider downloads the voice model.
- Model manager and "Gisingin si Tsupher": a "Boses ni Tsupher" card with Whisper tiny (default) or base, approximate size before download, progress in MB, measured size after, and delete.
- Capture (`src/voice/capture.ts`): 16 kHz mono through an AudioWorklet, energy-based end of speech (0.9 s of silence after speech), 8 s limit. The microphone is requested only on tap. Refusal shows a message and returns to typing. Samples are zero-filled right after transcription and never stored.
- Post-correction (`src/voice/correct.ts`): words that nearly spell a pack landmark are replaced with the pack's spelling. A weak match (similarity under 0.8) shows "Ito ba ang ibig mong sabihin…?" chips, including the text as heard. The chosen text goes through `sendMessage`, the same path as typed input.
- Listening screen: "Makinig si Tsupher…", three CSS rings (off under reduced motion), hint, "Tapusin", "Kanselahin". Mic buttons enabled on Home and Chat.
- `docs/voice-test/PHRASES.md` (15 phrases, mirrored in `tests/voice-phrases.json`) and the dev page `#/voice-bench`.
- Proof panel: new "Boses (Whisper)" row with model, size, backend and the last transcription time. About and `DISCLOSURE.md` list the model and libraries.
- `npm run check:voice` (new, not in the phase gate list): generated speech played into Chrome's fake microphone.

**Passed**
- `npm run lint`: clean. `npm run build`: clean. `npm test`: 163 of 163 (25 new in `src/voice/voice.test.ts`).
- `npm run check:offline`: 31 of 31 (2 new). `npm run test:e2e`: 57 of 57 (mic without a voice model points to Setup and does not ask for the microphone). `npm run check:update`: 8 of 8. `npm run check:llm`: 12 of 12.
- `npm run audit`: Performance 90, Accessibility 100, Best Practices 100, SEO 100.
- `npm run check:voice`: 23 of 23 with a fresh download, for Whisper tiny and again for Whisper base.
  - Production build, network fully off after the download: mic tap, listening screen, recording stopped on silence after 4.4 s, transcript, chat reply with the router fare ₱18.25, zero requests to other hosts, refused microphone falls back to typing.
  - Dev server with the LLM (Qwen2.5 1.5B) loaded first and every other host unreachable: same flow, both models loaded at once.

**Numbers (laptop, RTX 4050 6 GB, headless Chrome)**
- Whisper download host: `huggingface.co`, redirecting to `us.aws.cdn.hf.co`. These are the same two hosts the LLM download already uses; no new host.
- Size on device, runtime files included: Whisper tiny 142 MB, Whisper base 224 MB (WebGPU builds, read from the cache). WASM builds would be about 67 and 101 MB (computed, not measured).
- Transcription: 1.3 to 2.3 s for 4.2 s of audio on first use; 0.75 to 1.1 s warm in a direct test; about 3.5 s on WASM.
- GPU memory (nvidia-smi, whole machine): page open 3036 MiB, LLM loaded 4622 MiB, LLM plus Whisper tiny 5166 MiB, of 6141 MiB. About 3.0 GB was already in use by other programs. The LLM adds about 1.6 GB and Whisper tiny about 0.55 GB (base about 0.75 GB). They coexist, so Whisper is loaded on first mic use and kept loaded; it is not unloaded afterwards.
- First-run download: precache 29 entries, 7600 KiB (3047 KiB gzipped), up from 7020 KiB (2879 KiB gzipped). The increase is the 564 KiB transformers.js chunk. App shell 1704 KiB (budget 2 MB). First-load page transfer 314 KiB.

**Bugs found by the generated-audio test and fixed**
- A main-thread audio tap (ScriptProcessorNode) lost most of the speech whenever the page was busy; "From Alpha to Delta, cheapest please" came back as "From". Capture now runs in an AudioWorklet.
- Loading the model while recording froze the listening screen for up to 14 s. The model now loads after recording stops.
- transformers.js rejects "no local and no remote models", so a cached load is kept off the network by answering model-host requests with a local 404.
- Storage estimates lag after a delete, so a second download showed a wrong size. The voice size is now summed from the cache entries.

**Untested or not done**
- **Accuracy on human speech: untested.** No voice clips were supplied. The one sentence tested was English, spoken by the Windows synthesizer. Tagalog and Taglish recognition, accents, street noise and real microphones are all unknown.
- The tiny against base comparison was one generated sentence each (both correct). The phase prompt's landmark-word accuracy table over team clips does not exist. Tiny is the default because it is smaller, not because it was shown to be better.
- Language: fixed to `tagalog` without evidence. transformers.js has no auto-detect, so the "auto" setting in the phase prompt could not be run.
- The "Ito ba ang ibig mong sabihin…?" chips are covered by unit tests of the corrector only. No automated run produced a weak match, so the chips were never seen on screen.
- End-of-speech thresholds were tuned on generated audio, never on a phone microphone or in a noisy place.
- WASM backend: run once in a scratch test with a decoded file, not through the app's mic flow. No device without WebGPU was used.
- Phones and iOS Safari: nothing was run. `docs/IOS_NOTES.md` has a section written from the code only.
- Whisper base memory was sampled once; the figure is rough.
- After an app update that changes the ONNX Runtime version, the runtime file names change and voice needs one online use to cache them again. Not tested.
- `DEMO.md` still has no voice step in the script; it now says voice exists on this branch only and is untested on human speech.

**Assumptions**
- The voice model is optional and separate from the LLM: it works without WebGPU and without the LLM.
- The size shown before download is a constant measured on this laptop; the size shown after is read from the cache.
- `check:voice` needs Windows (System.Speech) for its test audio, and nvidia-smi for the memory figures.
- New dependency: `@huggingface/transformers` 4.3.1 (Apache-2.0), which brings `onnxruntime-web` 1.31.0-dev (MIT).
- `README.md`, `DEMO.md`, `docs/SUBMISSION.md` and `docs/DEMO_PREFLIGHT.md` got one line each about voice. `main` and tag `submission-v1` are untouched.

### Phase 7 addendum: no download without the Setup button (2026-10-09)

**Found**
- Opening Setup, Offline Mode or About never starts a download, offline or online: none of them calls a load or download function. Now asserted in `test:e2e`.
- A cached model is never fetched again: `check:llm` (LLM) and `check:voice` (Whisper) load real cached models with every other host unreachable and count zero requests. `check:llm` now also opens About.
- One hole, reproduced before the fix: the app start-up trusts a note in `localStorage` that says the LLM is downloaded. If the cache was emptied (browser eviction, or site data partly cleared) and the rider had not opened Setup, the first unclear chat message called the model loader, which tried to download from `huggingface.co`. Offline it failed and the chat fell back to rules; online it would have started the full model download without the rider asking.

**Fixed**
- `loadModel` takes `allowDownload`. The chat path passes `false`: a model missing from the cache is an error and nothing is fetched. The note is corrected and the model shows as not installed, so the rider can choose to download again on Setup.
- Tests: `src/ai/runtime.test.ts` (4 new) and a `test:e2e` step that plants a stale note, sends a chat message offline with WebGPU on, and asserts no request to another host. That step failed before the fix and passes after.
- Whisper never had this hole: its cached load answers model-host requests with a local "not found".

**Passed after the change**
- `lint`, `build`, `npm test` (167 of 167), `check:offline` (31 of 31), `test:e2e` (59 of 59), `check:update` (8 of 8), `check:llm` (13 of 13), audit (Performance 89, Accessibility 100, Best Practices 100, SEO 100). `check:voice` was not rerun; no voice code changed.

**Known and not fixed: the LLM size readout**
- "Laki sa phone" for the LLM is the growth of the browser's storage estimate across the download, kept in one `localStorage` value. It is wrong when: a model was deleted just before (the estimate still counts the deleted bytes, so growth is too small or negative, shown as a smaller number or "Hindi nasukat"); a download was interrupted and resumed (only the last part is counted); the voice model downloads at the same time (it is counted too); or two LLMs are cached (the value belongs to whichever was downloaded last). Seen for real on the voice model, which used the same method until it was changed to add up the cache entries. Not reproduced on the LLM. Display only; it affects no behaviour.

**DEMO.md**
- Voice is an optional step marked "use only if the live voice test passes", with the test defined. The arrival alert is an optional step labeled Simulated GPS. Neither was rehearsed or timed.

## Phase 9: favorites + settings (2026-10-09, branch `phases-7-9`, after Phases 8 and 7)

**Built**
- **Dexie version 2** (`src/db/db.ts`): adds `favorites` (`id, kind, createdAt`) and `settings` (`key`). Version 1 stays declared; no upgrade function is needed because only tables are added.
- **Favorites.** Heart toggles on every option card in Results and on Route detail (filled when saved; the Love sprite and "Na-save sa Paborito!" in a toast on save). A saved route is the question (origin, destination, preference, avoid-list), not the answer: opening it runs the router again, so a fare is never a stale copy. One row per trip + preference + avoid-list. Saved places are landmarks from the route pack.
- **Paborito screen:** tabs Mga Ruta / Address (saved landmarks only, with "Galing dito" / "Papunta dito" and a picker to add), and "Kamakailang Hinanap". A saved trip whose landmarks are not in the current pack is shown disabled with a note.
- **Settings screen** (Higit Pa, and a link from Mga Mode): Oras (Oras at min / Min lang), Distansya (Kilometro / Milya), "I-reset ang session", the contribution queue, and "Burahin lahat ng data" with a confirmation sheet.
- **Contribution queue:** "May mali ba?" on Route detail (what is wrong, optional note up to 500 characters), saved in the existing `contributions` table. Export as JSON or CSV; import of JSON or CSV with validation. "Sync now" is the export; nothing is sent anywhere.
- Higit Pa Settings row is live. The Wika / Unit stub rows on Mga Mode are replaced by a link to Settings.

**Decisions to know about**
- **Wika (Taglish / English) is not implemented**, and Settings shows it as "Hindi pa available" with no toggle: `src/copy.ts` holds every screen string in several hundred lines and the chat replies are built from templates, so a real English mode is more than 30 minutes of work and would need a full translation reviewed by the team.
- **Unit settings apply to the route screens only** (Results, Detail, Map, chat option cards). Tsupher's chat sentences are built in `src/ai/explain.ts` and are checked by a validator that expects "min", "oras" and "km"; they stay in those units, and Settings says so. They are display settings only: no router input or output changes.
- **Kamakailang Hinanap is in memory only** (CLAUDE.md rule 5, section 12): it holds landmark ids and a preference, never typed text, and it is gone when the app closes or the session is reset. Saved favorites are what persists.
- **"Burahin lahat ng data"** deletes Paborito, settings, the contribution queue and the session. It does not delete the route pack or the offline copy of the app (not personal data; the app keeps working). The downloaded AI and voice models are deleted only if the rider ticks a separate box, off by default.
- Export marks a report "exported", which means a file was made, not that anyone received it; the screen says so.
- CSV cells that start with `=`, `+`, `-` or `@` get a leading quote so a note cannot run as a spreadsheet formula; import removes it again. Import takes no status or unknown field from a file.

**Passed**
- `npm run lint`: clean. `npm run build`: clean (precache 29 entries, 7628 KiB; app shell 1732 KiB of the 2 MB budget).
- `npm test`: 184 of 184 (17 new: contribution files 7, favorite ids and shapes 5, settings and unit display 5).
- `npm run check:offline`: 31 of 31 (the IndexedDB table list now expects the two new tables).
- `npm run test:e2e`: 98 of 98, twice in a row, network off. New steps cover: reset session; empty Paborito; hearts on Results and Detail with the Love toast; "May mali ba?" end to end; the saved trip surviving a reload while recents do not; opening a saved trip (fresh ₱26.00); the Address tab; Min lang and Milya on the screens and after a reload; JSON and CSV export content; import of the same file (duplicate skipped), a team JSON, a team CSV and a bad file; the erase confirmation, cancel, confirm, and Dexie counts afterwards.
- `npm run check:update`: 8 of 8. `npm run check:llm`: 13 of 13.
- `npm run check:migrate` (new): 9 of 9. A populated version 1 database (raw IndexedDB at version 10 with terminals, a queued report and an older pack) is opened by the production build. It becomes version 20, has all eight tables, both terminals and the report keep their data, the old pack is refreshed by the existing seeding, and a second open changes nothing.
- `npm run audit`: Performance 89, Accessibility 100, Best Practices 100, SEO 100 (one earlier run in the same gate scored Performance 83 while the machine was busy; the rerun gave 89). The accessibility sweep now includes Settings and Paborito: no control under 44 px, no unnamed control, no overflow at 200% text. Main bundle 458 KiB to 487 KiB.

**Bugs the new tests found, fixed**
- `BottomSheet` re-focused its panel every time its parent passed a new `onClose` function. In any sheet with a text box (the new note field) that moved focus off the box after each key, so typing lost characters ("Test: ₱15 raw" arrived as "T₱₱"). The sheet now keeps the latest `onClose` in a ref and focuses only when it opens.
- A settings or import message with the same words as the last one was not announced again; each message now has its own element key.

**Not tested**
- **A phone.** Nothing in Phase 9 was run on a device: hearts, the toast, the file download and the file picker for import on iOS and Android are all untested. In particular, whether iOS Safari saves a downloaded JSON or CSV file the way a desktop browser does is unknown; the e2e run replaces the download click.
- The real file download (the e2e run captures the blob and does not click a link). Opening the CSV in Excel or Sheets was not tried, so the formula guard is tested only by the round trip in code.
- Erasing the downloaded AI and voice models through "Burahin lahat ng data": the box was never ticked in a test with a model installed. It reuses the existing `removeModel` and `removeVoice` functions, which delete only the selected model, so a second cached LLM would stay.
- Two tabs or windows open at once on the same data (the lists use live queries, but this was not tried).
- A favorite saved under an older route pack version: the row shows a note and the router runs again, but only the unit and shape logic is tested, not a real pack upgrade.
- Reports and favorites with the real corridor pack: everything above used the synthetic pack, so a saved report says nothing real about any route.
- Screen readers on the new screens (the sweep is a script, not a person).

**Assumptions**
- Favorite ids are built from content, so two hearts for the same trip and preference always agree.
- The contribution payload has a random `uid` made on the device so an import can skip a report it already has.
- No new dependency. `liveQuery` comes from Dexie.

## Metro Manila data pipeline (2026-10-10, branch `test`)

Continues `docs/superpowers/plans/2026-10-09-metro-manila-real-transport-data.md`. The plan's open steps need route data that does not exist yet, so this adds the tooling and leaves the sample pack active. **No real route, coordinate, time or fare value was added.**

**What was built**
- `npm run import:ncr` (`scripts/import-metro-manila-pack.mjs`, logic in `src/pack/fromInventory.ts`): turns the sourced Q City Bus stop inventory plus three field worksheets into route pack CSVs, checks them like `validate:pack`, and writes the bundled pack.
- Worksheets in `data/metro-manila/field/` (51 stops, 104 segments, 12 route directions), prefilled with sourced stop names and order only. Coordinates, distances, times and ride checks are blank for the team.
- `src/db/activePack.ts`: the app uses the bundled pack once it has a route, otherwise the synthetic pack. `src/db/seed.ts` seeds the active one; its replace-only-this-pack transaction is unchanged.
- About and the router harness show the sample label only when the active pack carries a `note`.
- `scripts/lib/packCheck.mjs`: the checks from `validate-pack.mjs`, shared with the importer. The boundary error now says what kind of GeoJSON is expected.

**Result today**
- `npm run import:ncr`: 0 routes imported, exit code 1, `src/db/generated/metro-manila-pack.json` empty. Twelve directions skipped for missing measurements; Route 1 and Route 6 blocked at the source.
- `npm run validate:pack data/metro-manila/pack`: 1 error (no `ncr_boundary.geojson`), 0 routes. The plan's Task 3 and Task 4 boxes stay unchecked.

**Passed**
- `npm run lint`: clean. `npm run build`: clean (precache 29 entries, 7635 KiB).
- `npm test`: 219 of 219 in four of five runs (12 new tests). One run failed `src/router/plan.test.ts > determinism > gives identical output over 100 runs`, an existing test this change does not touch; it ran right after a build and the message was not captured. It passed alone three times and in the next three full runs. Cause not established.
- `npm run check:offline`: 31 of 31. `npm run test:e2e`: 98 of 98. `npm run check:migrate`: 11 of 11. `npm run check:update`: 8 of 8. `npm run check:llm`: 13 of 13. All with the synthetic pack active.
- Scratch check, outside the repo and deleted afterwards: one direction filled with made-up numbers and a box-shaped boundary. The importer imported that one route, reported 0 errors, wrote a pack with a free fare citing the Quezon City guide and `verified: false`, and exited 0. With a boundary file of the wrong shape it refused.

**Not tested**
- The app with a real pack active. The scratch check stopped at the bundled JSON; no build, router run or browser check was done with it. The route screens, map, chat and trip mode have only ever run on the synthetic pack.
- A fare of 0 in the router and on the fare-detail sheet.
- `npm run audit`, `npm run screenshots`, `npm run check:voice`.
- Whether the two "Aurora–Katipunan Interchange" rows are one place. They are kept as two stops because the sources name them differently.

**Assumptions**
- The free-fare row uses the route guide's last-updated date as its effective date, and says so in its source note.
- Pack id `metro-manila`; its version is the inventory capture date plus a hash of the CSVs, so any new measurement reseeds the app.
- The MMDA Love Bus is not in the importer: the PIA page returned HTTP 403, so no stop list could be transcribed.

## Dashboard layout + Home polish (2026-10-09, branch `ui-dashboard`, from `main`)

Not a numbered phase. Brings `design/reference/Para! Commute Copilot Dashboard.png` into the app as a wide-screen layout, and closes the remaining Home gaps against the UI Showcase.

**What was built**
- **Dashboard at 1280 px and wider** (Tailwind `xl`): a brown sidebar (`SideNav`: wordmark placeholder, the five nav items, the 100% Offline card, the hero mascot) and one cream panel with three columns. Home is always in the first column, the schematic map is always in the third, and the middle column holds Plan a Route, or Paborito / Higit Pa, or whichever overlay is open (results, detail, trip, chat, modes, settings, setup, offline, about). Below 1280 px the app is the same phone column as before.
- **One set of screens.** Nothing is duplicated: `App.tsx` shows more of the already-mounted tabs when `useWide()` is true. Hash routes are unchanged.
- **Cream panel by token remap.** Inside `.panel`, `src/index.css` remaps the on-brown tokens (`on-deep`, `line-on-deep`) to ink and makes cards white, so screens were not restyled one by one. Screens that are dark on purpose carry `.on-deep` (Offline Mode, the trip alert, the listening overlay).
- **Home:** a "Tsupher Tip!" banner that opens Mga Mode; "Kamakailang Hinanap" (the same in-memory session list as Paborito, shown only when it has rows); "Mga Na-save na Lugar" (saved landmarks that the loaded pack still has; tapping one sets the destination). A third tile, "My Saved Routes", shows on the dashboard only.
- **Map column (dashboard only):** "Opsyonal na Feature" with the Iwas EDSA switch (labeled Simulated; re-runs the router when a trip is already planned) and a Drop-off Alert row that opens Trip mode when a route is selected.
- `RecentTrips` / `TripLine` moved out of `Paborito.tsx` so Home and Paborito render the same rows; `openTrip`, `hasAvoid`, `knows` moved to `src/state/plan.ts`. `NAV_ITEMS` moved to `src/lib/nav.ts` for both navs.

**Left out on purpose, and why**
- Nearby Stops (no stop-proximity feature), Street View and map tiles (BUILD_PHASES 2.8), bell and avatar (2.8), mode filter chips (the plan form has no mode-include filter), a second Mas Mura toggle (the "Mas mura" preference chip is that control), Popular Destinations (no popularity data; saved places stand in), timestamps on recents (the session list holds no times and is never persisted).
- The mockup's English nav labels: CLAUDE.md section 12 names the tabs Home, Ruta, Mapa, Paborito, Higit Pa.
- A per-leg mode badge on Route detail (in the plan): the leg title already is the mode name and the icon already carries the mode colour, so a badge would repeat it.

**Changed from the plan**
- The breakpoint is 1280 px, not 1024 px. Three columns beside a 240 px sidebar are about 250 px each at 1024 px, narrower than the phone layout the screens were built for.
- "My Saved Routes" is dashboard only. As a full-width third tile on the phone it pushed the 100% Offline banner below the first screen.

**Passed**
- `npm run lint`: clean. `npm run build`: clean (precache 29 entries, 7635 KiB).
- `npm test`: 184 of 184. `npm run check:offline`: 31 of 31. `npm run test:e2e`: 98 of 98. `npm run check:update`: 8 of 8. `npm run check:llm`: 13 of 13.
- `npm run audit`: Performance 86 (89 in the Phase 9 run; earlier runs ranged 83 to 89 on this machine), accessibility sweep unchanged. All of these run at 390 x 844, so they cover the phone layout only.
- `npm run screenshots`: new 1440 x 900 shots `dashboard`, `dashboard-plan`, `dashboard-offline`, `dashboard-chat`, `dashboard-trip`, compared by eye with the reference.

**Not tested**
- No automated test runs at the wide size. The dashboard was checked through the five screenshots only.
- On the dashboard: Results, Modes, Settings, Setup and About in the middle column; the trip alert and listening overlays (they stay a centred phone-width panel); bottom sheets; the Iwas EDSA switch in the map column; resizing across 1280 px with a filled form; keyboard order through the sidebar; 200% text; screen readers.
- Widths between 1280 and 1440 px, and anything wider than 1440 px.
- A real phone, tablet or laptop. Everything above is headless Chrome.

**Assumptions**
- Tablets (768 to 1279 px) keep the phone column.
- The wordmark is still live text: the wordmark art from BUILD_PHASES 2.9 was never exported, so the sidebar uses the same placeholder as Home.
- No new dependency, no new network call, no new stored data.

## Landing screen (2026-10-09, branch `ui-dashboard`)

Not a numbered phase. Makes the cold-start screen look like the first tile of the UI Showcase.

**What was built**
- `src/screens/Splash.tsx`: an amber sun crown over the "Para!" wordmark, "Commute Copilot", the three-line tagline, a skyline with clouds behind, a large Tsupher cropped at the bottom-left, and a "Tsupher" label with an arrow.
- The skyline, clouds, crown and arrow are inline SVG in the component, coloured from the existing tokens. No image file was added. The skyline is a generic one, not a drawing of a real place. One 400-unit strip is repeated sideways so a laptop screen is filled without stretching it.
- **The screen now stays until the rider taps anywhere or presses any key** (the user asked for this; it used to close after 1.2 s). A "Simulan" button is the named, focused control for keyboard and screen-reader users. It still shows once per cold start only.
- Tsupher's width is capped by screen height, so the art does not climb over the text on a short phone.

**Changed from the plan**
- The mascot does not bob on this screen. With the animation on the enlarged sprite the audit's Performance score fell to 67 and 74 in two runs (Total Blocking Time 780 ms and 580 ms); without it the score is 90. The mockup is a still image anyway.

**Passed**
- `npm run lint`: clean. `npm run build`: clean (precache 29 entries, 7638 KiB). `npm test`: 184 of 184.
- `npm run check:offline`: 31 of 31. `npm run test:e2e`: 98 of 98. `npm run check:update`: 8 of 8. `npm run check:llm`: 13 of 13. `npm run check:migrate`: 9 of 9. Every script already pressed Escape to leave the splash, so none needed the old auto-close.
- `npm run audit`: Performance 90.
- `npm run screenshots`: `splash.png` (390 x 844), plus new `splash-wide.png` (1440 x 900) and `splash-short.png` (360 x 640), compared by eye with the showcase tile.

**Not tested**
- `npm run check:voice` was not run after this change; only a comment in it was edited.
- A real phone: safe-area insets, a tap on the art, and how the screen looks in landscape.
- Screen readers, 200% text, and reduced-motion on this screen (it now has only the fade-in).
- `check:update`, `check:llm` and `check:migrate` ran before the bob animation was removed and were not repeated; lint, `check:offline` and `test:e2e` were.

**Assumptions**
- One extra tap on every cold start is acceptable, as chosen.
- The wordmark stays live text until the art from BUILD_PHASES 2.9 is exported. The "Tsupher" label uses Fredoka, not the handwriting of the mockup.

## Mock jeepney routes (2026-10-10, branch `mock-jeepney`)

The team asked for jeepney routes next to the trains and accepted made-up data as long as it is labeled.

**Built**
- `scripts/mock-jeepney-pack.mjs` writes `data/metro-manila/mock-pack/`: 19 mock stops, 10 mock routes (5 lines, both directions), 2 mock fare tables. `npm run import:ncr` now appends that folder like `rail-pack`; the bundled pack has 69 landmarks, 10 routes, 7 fare tables.
- The app now handles a pack with train fares and routes together: Ruta shows the plan form plus the train fare for the chosen pair when there is one; Mapa keeps station taps and the fare lookup, draws mock lines dashed, and lists only the modes the pack has; the chat gives route options and, for two stations on one line, the published train fare above them.
- "MOCK DATA" badge on results, route detail, chat cards, the Ruta form and the map; mock route notes appear under "Tandaan".

**Passed**
- `npm run lint`, `npm test` (209), `npm run build`, `npm run test:e2e:real` (29, with new checks for the mock routes and their badges), `npm run check:offline` (30), `npm run build:sample` then `npm run test:e2e` (96).

**Not run**
- `check:update`, `check:llm`, `check:migrate`, `audit`, `screenshots` (the screenshots in `docs/screenshots/` do not show the mock routes).
- Anything on a phone.

**Assumptions**
- Mock stop coordinates were placed by hand from memory of the area, so the dashed lines only roughly follow roads.
- Mock rows carry no tags, so there is no "Iwas ..." what-if chip for them in the real build. "Iwas EDSA" still works only in the sample build.
- A train question between two stations that a mock route also joins (for example Quezon Ave to Ayala) shows the real train fare first, then the mock jeepney options.
- The promo video on branch `promo-video` was recorded before this change and does not show the mock routes.

## Mock jeepney routes for all 16 cities (2026-10-10)

- At the user's request the mock pack now has one made-up stop per Metro Manila city (`mock-city-*`, "<City> Sentro (mock)") and 12 more made-up jeepney lines (`mock-j5` to `mock-j16`) joining them, 34 routes in all. Fares use the same two mock fare tables. Everything keeps the MOCK DATA labels.
- Tsupher understands the city names (plus "QC", "Kyusi", "Maynila", "Kalookan"); the map draws the new lines from the pack with no code change.
- Passed: `npm run lint`, `npm test` (210, new test plans a trip to each city), `npm run build`, `npm run test:e2e:real` (29), `npm run check:offline` (30). Not run: `test:e2e` (sample build), `check:update`, `check:llm`, `check:migrate`, audit, screenshots.
- Assumption: "Marikina" alone resolves to the real LRT-2 station, not the mock stop, to avoid an ambiguous-name question.
