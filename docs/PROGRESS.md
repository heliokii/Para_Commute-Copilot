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
