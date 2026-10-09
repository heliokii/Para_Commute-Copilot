# Para! — Build Phases 2–11

Companion to `CLAUDE.md`. **App:** Para! · **Mascot / AI guide:** Tsupher · **Phase 1 (offline PWA shell) is done.**

## 0. How to use this file

- One phase per agent session. Commit at the end of each phase. Paste the phase prompt, let the agent run, then paste its report back for review before starting the next phase.
- **Phases 2 and 3 are independent.** Run them in parallel (two branches or two teammates) and merge before Phase 4.
- Every prompt tells the agent to read `CLAUDE.md` first, including section 12 (brand rules).
- Mockup numbers (₱95, "2 oras", "815 MB", Imus → Cubao) are placeholders. No screen may hardcode them.

## 1. Priority and cut line

| Phase | What | Tier |
|---|---|---|
| 2 | Deterministic router + tests + data templates | Must |
| 3 | Brand foundation + app shell (Tsupher theme) | Must |
| 4 | Plan flow screens wired to the router (no AI) | Must |
| 5 | Understand: local LLM runtime + Taglish parser + benchmark | Must |
| 6 | Tsupher chat: follow-ups, what-ifs, explanations | Must |
| 7 | Voice: Whisper + listening screen | Should |
| 8 | Trip mode: "Malapit na ang babaan!" | Stretch (cheap with simulated GPS) |
| 9 | Paborito, settings, contribution export | Stretch |
| 10 | Offline proof, hardening, iOS and accessibility pass | Must |
| 11 | Demo script, disclosure, submission pack | Must |

**If time runs short:** finish 2 → 3 → 4 → 5 → 6, then do 10 and 11. Add 7 only if chat works end to end on the demo laptop. Do 8 next (a simulated-GPS demo is a strong closer). Cut 9 first.

## 2. Tsupher design system (reference for Phases 3+)

### 2.1 Reference images
Put these in `design/reference/` (reference only, never shipped):
- `Para__Commute_Copilot_UI_Showcase.png`: target look and screen inventory
- `Para! Commute Copilot Dashboard.png`: wide-screen layout (sidebar plus Home, Ruta and Mapa columns), used at 1280 px and wider
- `Para_.png`: hero mascot
- `Appearances.png`: pose, emotion and interaction sheet
- `Logo.png`: app icon art

### 2.2 Look and feel (from the showcase)
Deep-brown gradient backdrops, cream cards, amber primary buttons, large rounded corners, soft shadows, a faint sunburst and city-silhouette motif, friendly rounded display type. The same structure as a Tarsi-style app: a prompt card up top, big tiles, a bottom nav, and a persistent mascot.

Approximate palette (eyeballed from the images; the agent must re-sample from the files and record exact values):

| Token | Approx. value | Use |
|---|---|---|
| `bg-deep` | `#5A2E14` | Splash, headers, dark screens |
| `bg-gradient-top` | `#8A4A22` | Gradient highlight |
| `surface-cream` | `#FBF4E8` | Cards, sheets |
| `accent-amber` | `#F4B33A` | Primary buttons, active tab, progress |
| `accent-terracotta` | `#C66A3A` | Secondary accent, badges |
| `ink-dark` | `#3B1D0C` | Text on cream |
| `ink-muted` | `#8A6A55` | Secondary text |
| `ok-green` | sample from "Offline" dot | Status |

Radii: cards 20–28 px, buttons pill. Tap targets ≥ 44 px. Light and dark variants are optional; the showcase theme is the default and the only required one.

### 2.3 Typography
Keep Inter (already cached) for body text. Add one self-hosted rounded display font for headings (e.g. Fredoka or Baloo 2, woff2, SIL OFL; confirm the license). The "Para!" wordmark is art, not live text. No remote fonts.

### 2.4 Components (built in Phase 3)
`Tsupher` (state → sprite), `Button` (primary amber / secondary outline), `Card`, `Chip`, `StatusPill`, `TopBar`, `BottomNav` (Home, Ruta, Mapa, Paborito, Higit Pa), `BottomSheet`, `Banner`, `ProgressBar`, `Bubble` (chat).

### 2.5 Screen inventory (from the showcase) and which phase builds each

| Screen | Phase | Notes |
|---|---|---|
| Splash | 3 | Landing screen: stays until a tap or any key (was max 1.2 s) |
| Home ("Kumusta!") | 3 | Prompt card, Plan a Route and Voice Chat tiles, 100% Offline banner |
| Offline Mode | 3 static, 10 real | Checks must reflect real state |
| Plan a Route | 4 | |
| Route options / Route detail | 4 | |
| Map | 4 | **Schematic SVG, no map tiles** |
| Mga Mode (modes) | 4 | |
| Chat | 6 | |
| Listening | 7 | |
| Trip alert | 8 | |
| Paborito | 9 | |
| Settings (Wika, Unit) | 9 | |

### 2.6 Mascot state map (sprites sliced from `Appearances.png`)

| App state | Sprite |
|---|---|
| Hero (splash, Home) | `Para_.png` |
| Idle / greeting / listening (small) | Front (Happy) |
| Thinking (model running) | Thinking |
| Searching / planning | Reading a Map |
| Route found | Thumbs Up |
| No route / unclear request | Confused |
| Error / model failed | Sad |
| Offline notice | Holding a Sign (overlay text) |
| First-run download | Driving |
| Trip start | With Luggage |
| Arrival alert / celebration | Jumping (or Waving/Moving Fast) |
| Favorite saved | Love |
| Success toast | Excited |

Needed set: those 12 plus the hero. File names: `public/mascot/tsupher-<state>.webp`.

### 2.7 Voice and copy
Taglish, warm, short. Use the mockup strings where provided ("Kumusta!", "Ako si Tsupher! Handang tumulong sa iyong biyahe. Saan ka papunta?", "Tamang ruta. Tamang sakay. Laging kasama ka.", "Sige, Tsupher!", "Para po!"). Keep every string in `src/copy.ts` so edits happen in one place.

### 2.8 Deliberate changes from the mockups
1. Chat header says "Kuya Para!"; use **Tsupher**.
2. **Map screen uses a schematic SVG** drawn from the route pack, not tiles. Offline tiles (MapLibre + a PMTiles extract) are a stretch item. The "Street View" tab is removed.
3. "Mas komportable / may aircon" preference needs data that doesn't exist; hide it until `route.hasAircon` exists.
4. Bell and avatar icons are dropped (no accounts, no notifications).
5. "Higit Pa" opens Modes, Offline Mode, Settings and About/Disclosure.
6. The mockups don't show first-run setup, but the model and route pack must be downloaded once. Phase 5 adds a "Gisingin si Tsupher" download screen.
7. "Walang tracking" copy: Trip mode uses GPS on-device. Word it as "Nasa phone mo lang ang lokasyon mo."
8. The "Bytes sent" figure is an in-app tally. Label it as app-measured; devtools Network is the real proof.
9. Dashboard mockup: Nearby Stops, Popular Destinations, mode filter chips and timestamped chat history have no data behind them. The dashboard shows saved places and the in-memory "Kamakailang Hinanap" instead, and "Iwas Traffic" is the Iwas EDSA switch, labeled Simulated. Nav labels stay Home, Ruta, Mapa, Paborito, Higit Pa.
10. Landing screen: the skyline, clouds and sun crown are inline SVG drawn for the app (a generic skyline, not a real place), and the wordmark is still live text. It has a "Simulan" button the mockup does not show, because the screen no longer closes by itself.

### 2.9 Asset prep checklist (you, before Phase 3)
- [ ] Slice the 12 sprites from `Appearances.png` into transparent-background WebP files (the sheet has a beige background and baked-in labels). Max edge 512 px, ≤ 50 KB each.
- [ ] `Para_.png` has a white background; export a transparent version (max edge 1024 px, ≤ 150 KB) for the splash.
- [ ] Icons: `Logo.png` is a full-bleed brown tile with the mascot cropped in the corner. If that crop is intentional, use it as the 1024 master. Check it reads at 60 px, then generate 192, 512, maskable 512 (keep the mascot inside the central 80% safe zone) and 180 apple-touch.
- [ ] Wordmark: export "Para!" from the splash art as a transparent SVG or PNG.
- [ ] Be ready to disclose how the art was made and when (the hackathon asks for tools to be disclosed).

---

## Phase 2 — Deterministic router (Must)

**Goal:** `planRoute` and `planOptions` as pure functions, fully tested on a synthetic network. Run in parallel with Phase 3.
**Done when:** tests pass, the dev harness shows correct results, and the data templates exist.

```
Read CLAUDE.md fully (esp. sections 2, 4, 5, 7.3) and the current repo state.

TASK: Phase 2 only. Build the deterministic router. No LLM, Whisper, voice, or visual redesign.

0. Commit the current state if uncommitted ("Phase 1: offline PWA shell"), including CLAUDE.md and BUILD_PHASES.md.

1. Types (src/router/types.ts):
   - Landmark {id, name, aliases[], tags[], lat, lon}   (tags are things like road names, e.g. "EDSA")
   - Route {id, mode ('jeepney'|'modern_jeepney'|'uv'|'bus'|'train'|'walk'), name, tags[], stops: {landmarkId, distKmFromPrev, minFromPrev}[], fareTableId, verified: boolean, note?: string}
   - FareEntry {id, mode, baseFare, baseKm, perKm, effectiveDate, roundingRule, sourceNote}
   - Intent {originId, destinationId, preference: 'cheapest'|'fastest'|'fewest_transfers', avoid: {landmarkIds[], routeIds[], modes[], tags[]}}
   - RouteResult {status: 'ok'|'no_route', reason?, preference, legs[{routeId, mode, boardId, alightId, distKm, minutes, fare}], totalFare, totalMinutes, transfers, fareAsOf, assumptions[], simulated: boolean, usedUnverifiedData: boolean}
   Keep these stable; Phases 4–6 consume them.

2. Core (src/router/), pure functions with NO React or Dexie imports:
   - planRoute(pack, intent): RouteResult
   - planOptions(pack, baseIntent): RouteResult[] returns the cheapest, fastest and fewest-transfers results, de-duplicated by leg sequence, each labeled by preference.
   - Build candidate legs: for each route, every (board, alight) pair in forward stop order. Leg distance and minutes are sums of hops. Leg fare = baseFare + max(0, distKm - baseKm) * perKm, then the FareEntry's roundingRule (default nearest 0.25 peso, documented).
   - Walking legs between landmarks within a configurable distance (default 300 m, haversine).
   - Dijkstra over state (landmarkId, lastRouteId). Cost by preference: cheapest = fare then minutes; fastest = minutes + transfer penalty; fewest_transfers = transfers then minutes. Transfer penalty is a config constant.
   - Avoid-list removes landmarks, routes, modes, and anything carrying an avoided tag before the search. If any avoid is non-empty, simulated: true.
   - Deterministic ties (stable id ordering). Never throw on user input; return no_route with a reason.
   - usedUnverifiedData if any used route has verified: false. fareAsOf from the FareEntry.

3. Web Worker wrapper (src/router/router.worker.ts) + typed client (src/router/client.ts) that loads the pack from Dexie. Core stays importable from Node.

4. Fixture + tests (Vitest): src/router/__fixtures__/synthetic-pack.ts, a made-up network (about 8 landmarks, 4 routes, 2 modes, one transfer point, one case where cheapest and fastest differ, one route tagged "EDSA"). Mark everything SYNTHETIC. Hand-compute expected results in comments. Test: cheapest vs fastest differ, fewest transfers, avoid landmark, avoid route, avoid mode, avoid tag, no route, origin == destination, fare rounding, planOptions de-duplication, identical output over 100 runs, and that fares come only from FareEntry data (no hardcoded fare constants in router code).

5. Dev-only harness (hidden in production builds): origin/destination dropdowns, preference select, avoid checkboxes, plain-text RouteResult. Label "SAMPLE DATA".

6. Data templates: docs/DATA_COLLECTION.md plus CSV templates for landmarks (with aliases and tags), route stops (distance, minutes), fares (source, effectiveDate), terminals. Include how to measure (GPS distance vs odometer, rush vs off-peak timing, photo of posted fare matrix). Add `npm run validate:pack` that loads the CSVs and reports missing or inconsistent data.

CONSTRAINTS: no invented real routes or fares anywhere. Zero network requests. No new dependencies beyond vitest (and a CSV parser if needed). Build, lint and offline check must still pass.

WHEN DONE: run lint, build, tests, offline check. Report passed/failed and every assumption. Commit "Phase 2: router + tests". Stop.
```

---

## Phase 3 — Brand foundation and app shell (Must)

**Goal:** Tsupher theme, mascot component, nav, Splash, Home, Offline Mode (static). The app should already look like the showcase.
**Depends on:** your asset prep (2.9). **Done when:** screenshots at 390×844 sit next to the reference images and the offline test still passes.

```
Read CLAUDE.md fully, including section 12 (Brand), and BUILD_PHASES.md section 2 (design system). Look at design/reference/*.png for visual reference only.

TASK: Phase 3 only. Rebrand the Phase 1 shell to the Tsupher theme and build the shell screens. No router, LLM or voice work.

1. Tokens: write a script that samples the palette from design/reference/ and writes exact values into src/styles/tokens.css as Tailwind v4 @theme tokens (names per section 2.2). Replace my Phase 1 beige theme entirely. Keep a dark variant only if it costs under 30 minutes; otherwise skip.
2. Assets: use public/mascot/tsupher-<state>.webp and the transparent hero/wordmark I placed in public/. If a file is missing, use a clearly marked placeholder and list what's missing in your report. Regenerate PWA icons (192, 512, maskable 512 with safe zone, apple-touch 180) from the logo master; update manifest theme_color and background_color to match the tokens.
3. Fonts: self-host Inter (existing) plus one rounded display font (woff2, OFL). No remote fonts.
4. Components (src/components/): Tsupher ({state, size}, maps state to sprite per section 2.6, meaningful alt text, subtle CSS bob animation disabled under prefers-reduced-motion), Button, Card, Chip, StatusPill, TopBar, BottomNav (Home, Ruta, Mapa, Paborito, Higit Pa), BottomSheet, Banner, ProgressBar, Bubble.
5. Navigation: a lightweight router (hash or react-router); tabs keep their state; no heavy new dependencies. Animations are CSS/Web Animations only; do not add GSAP.
6. Screens: Splash (max 1.2 s, tap to skip, only on cold start), Home (greeting "Kumusta!", prompt card with disabled mic, Plan a Route and Voice Chat tiles, "100% Offline" banner), Offline Mode (static for now: GPS/Lokasyon, Search/Query, AI Assistant rows with "bytes sent" from the existing netMeter), Higit Pa menu stub (Modes, Offline Mode, Settings, About/Disclosure).
7. Copy: all strings in src/copy.ts, using the mockup strings from section 2.7. Mascot name is Tsupher everywhere. Omit the bell and avatar icons.
8. Never hardcode mockup values (₱95, 2 oras, 815 MB, Imus, Cubao). Any sample content must be labeled SAMPLE DATA.
9. Performance: images WebP, lazy-loaded except above-the-fold, total mascot assets under 1 MB, precache stays under 2 MB.
10. Screenshots: add a Playwright (or existing headless Chrome) script that saves 390×844 screenshots of each screen to docs/screenshots/.

CONSTRAINTS: zero network requests, accessibility basics (contrast, 44 px targets, labels), build/lint/offline test must pass.

WHEN DONE: report passed/failed, list missing assets, and commit "Phase 3: Tsupher theme + shell". Stop.
```

---

## Phase 4 — Plan flow screens wired to the router (Must)

**Goal:** a working end-to-end plan flow with typed input and no AI: choose places, see options, open details, see a schematic map, change modes.
**Depends on:** Phases 2 and 3.

```
Read CLAUDE.md fully, BUILD_PHASES.md sections 2 and 4, and the current repo. Phases 2 (router) and 3 (theme) are merged.

TASK: Phase 4 only. Build the plan-flow screens and wire them to the router worker. No LLM or voice.

0. If the router types lack landmark/route tags or Intent.avoid.tags, add them first (and planOptions), with tests.
1. Ruta (plan) screen: origin and destination pickers with fuzzy autocomplete over landmark names and aliases; preference chips (Mas mura, Mas mabilis, Pinakakaunting sakay); "Hanap" button. Replace the Phase 2 dev harness for normal users (keep it behind the dev flag).
2. Results screen: cards from planOptions, labeled by preference, each showing total fare, minutes, transfers, and "as of <effectiveDate>". Show a "Hindi pa verified" badge when usedUnverifiedData and a "Simulated" badge when simulated. Empty state: Tsupher "Confused" with the router's reason.
3. Route detail screen: timeline of legs (mode icon, board → alight, per-leg minutes and fare), a fare breakdown sheet (base + per-km, effective date, source note), and a "Tandaan" box that shows only a route's `note` field if one exists. No invented tips.
4. Modes screen (Mga Mode): Mas Mura Mode (sets preference), Iwas Traffic / Iwas EDSA (adds the "EDSA" tag to avoid; labeled simulated), Custom Preference (sliders weighting fare, time, transfers; no aircon option). Settings rows (Wika, Unit) are visual stubs for now.
5. Map screen: a schematic SVG, not tiles. Project landmark lat/lon into the viewBox, draw each leg as a colored polyline by mode, mark origin/destination/transfers, include a legend (Jeepney, UV Express, Bus, MRT/LRT) and pan/zoom. Remove the "Street View" tab. Make it work offline with no external requests.
6. "Simulan ang Ruta" opens a placeholder Trip screen (built in Phase 8).
7. Persist the last result so Mapa and Ruta tabs stay in sync. Heart icon is a stub (Phase 9).

CONSTRAINTS: all data from Dexie via the router; SAMPLE DATA labels remain while data is unverified; zero network requests.

WHEN DONE: add an offline end-to-end test (plan → results → detail → map) that runs with the network off, report passed/failed, commit "Phase 4: plan flow". Stop.
```

---

## Phase 5 — Understand: local LLM + Taglish parser (Must)

**Goal:** typed Taglish becomes a validated `Intent`, using fuzzy matching first and an on-device LLM as fallback, with a benchmark that picks the model.
**Depends on:** Phase 4. **Needs from you:** 50-query Taglish test set drafts (the agent seeds it; you add real examples).

```
Read CLAUDE.md fully and BUILD_PHASES.md sections 2 and 5. Phases 2–4 are merged.

TASK: Phase 5 only. Build the Understand layer: local model runtime, model download manager, Taglish parser, benchmark. No chat UI yet (Phase 6), no voice.

1. Runtime: use WebLLM (WebGPU) as the primary on-device runtime. Detect WebGPU; if unavailable or the model fails to load, fall back to the rules-only lane (below) and show Tsupher "Sad" with a clear message. Do not mock the LLM.
2. Model manager (src/ai/modelManager.ts): download with progress, resume on failure, cache through the runtime's cache, show size from the real cache via navigator.storage.estimate(), call navigator.storage.persist(), warn "mag-WiFi muna", allow delete. Model identifiers come from the runtime's actual model list; verify each candidate exists before use.
3. First-run screen "Gisingin si Tsupher": downloads the model, shows progress with the Driving sprite, works only once, and shows a ready state. App must remain usable (rules lane) while the download is incomplete.
4. Parser (src/ai/parse.ts) returning ParseResult {status: 'ok'|'needs_clarification'|'unsupported', intent?, candidates?, rawText, lane: 'rules'|'llm'}:
   a. Normalize text (case, punctuation, common Taglish fillers).
   b. Rules lane: fuzzy landmark match against names + aliases (Damerau-Levenshtein or trigram), detect origin/destination via cue words ("galing", "mula", "papunta", "pa", "to", "from"), detect preference words ("mura", "pinakamura", "mabilis", "kaunting lipat") and avoid words ("iwas", "huwag dumaan", "wag sa").
   c. LLM lane when rules are ambiguous or incomplete: temperature 0, constrained JSON output (JSON schema or grammar if the runtime supports it; otherwise validate and retry once). The prompt lists allowed preference values and only the top-k fuzzy-relevant landmark names.
   d. Resolve LLM-produced names to landmark IDs through the fuzzy matcher; validate the Intent; if ambiguous, return needs_clarification with candidates (never guess).
5. Benchmark: tests/taglish-50.json with 50 queries (clean, typos, Tagalog-only, English-only, code-switched, preference words, avoid words, ambiguous, out-of-scope), each with expected Intent against the sample pack. Add a dev page /bench that runs a selected model and prints a table: origin/destination exact match, preference accuracy, avoid accuracy, clarification-when-ambiguous rate, p50/p95 latency, load time, download size, tokens/s. Save the results to docs/model-benchmark.md. Candidate small instruct models to try (verify availability): Qwen2.5 0.5B/1.5B Instruct, Llama 3.2 1B Instruct, Gemma 3 1B IT, SmolLM2 1.7B. Record each model's license.
6. Privacy: nothing leaves the device; do not log user text anywhere persistent.

CONSTRAINTS: zero network requests after models are cached; the offline test must pass with the rules lane; no cloud AI API anywhere.

WHEN DONE: report the benchmark table, your recommended model with reasons, and everything that failed. Commit "Phase 5: understand layer". Stop.
```

---

## Phase 6 — Tsupher chat: follow-ups, what-ifs, explanations (Must)

**Goal:** the core demo. Ask in Taglish, get options, refine with follow-ups, declare an avoid what-if, and read a Taglish explanation that cannot contain invented facts.
**Depends on:** Phases 2, 4, 5.

```
Read CLAUDE.md fully and BUILD_PHASES.md sections 2 and 6. Phases 2–5 are merged.

TASK: Phase 6 only. Build the Tsupher chat with follow-ups, what-ifs and explanations.

1. Session (in memory only): lastIntent, lastOptions, last N turns, active constraints. No persistent chat history.
2. Follow-up mapper (src/ai/followup.ts): converts an utterance into a ParseDelta {preference?, addAvoid?, removeAvoid?, setOrigin?, setDestination?, ask?: 'fare'|'time'|'steps'|'why'}. Rules first for common phrases ("mas mura", "pinakamura", "mas mabilis", "iwas EDSA", "walang lipat", "ulitin", "bakit"); LLM (constrained JSON) for the rest. Apply the delta to the session and call the router.
3. What-ifs: "paano kung sarado ang X?" adds an avoid constraint and the result is marked simulated; Tsupher says it's a simulation.
4. Explain (src/ai/explain.ts): template-first Taglish steps built deterministically from RouteResult. Optionally run an LLM pass to produce a 2–3 sentence summary, with a validator: every peso amount, minute count, km value and landmark/route name in the output must exist in the RouteResult. If validation fails, discard the LLM text and show the template. The LLM never computes numbers.
5. Chat UI per the showcase: header (Tsupher + Offline pill), user bubbles, Tsupher bubbles containing numbered option cards (tap → Route detail), quick-reply chips ("Mas mura", "Iwas EDSA", "Mas kaunting sakay"), input field (mic stays disabled until Phase 7), streamed tokens, typing indicator with the Thinking sprite, and the Confused state for unclear or out-of-scope requests (polite Taglish refusal, never an invented answer).
6. Wire the Home prompt card and "Voice Chat" tile to open the chat (text-only for now).
7. Dev-only badge on each Tsupher message: lane (rules/llm), latency, tokens/s.
8. Tests: 10 scripted conversations that run through the follow-up mapper with the rules lane (no LLM) and assert router results and the "simulated" flag; a test for the explain validator rejecting an invented fare.

CONSTRAINTS: no cloud calls; if the LLM is unavailable, chat still works through rules and templates.

WHEN DONE: report passed/failed with the 10 conversation results, commit "Phase 6: Tsupher chat". Stop.
```

---

## Phase 7 — Voice: Whisper + listening screen (Should)

**Goal:** speak Taglish, get a transcript on-device, post-correct it with the landmark matcher, and feed it to the chat.
**Needs from you:** 20 short voice clips of the team saying test queries.

```
Read CLAUDE.md fully and BUILD_PHASES.md sections 2 and 7. Phases 2–6 are merged.

TASK: Phase 7 only. Add on-device speech recognition.

1. Runtime: transformers.js Whisper. Benchmark whisper-tiny vs whisper-base (multilingual) on the clips in docs/voice-test/ with language set to Tagalog, English, and auto; record landmark-word accuracy, latency and download size in docs/voice-benchmark.md; choose one. Use WebGPU if available, else WASM. Do NOT use the Web Speech API.
2. Capture: getUserMedia → 16 kHz mono; simple energy-based end-of-speech detection with a max of 8 seconds; request mic permission only on tap; handle denied permission with a typing fallback. Discard audio buffers right after transcription; never store audio.
3. Post-correction: run the transcript through the landmark fuzzy matcher and show "Ito ba ang ibig mong sabihin…?" chips when confidence is low, then pass the confirmed text to the same parser the typed input uses.
4. Listening screen per the showcase: "Makinig si Tsupher…", animated rings (CSS only, reduced-motion safe), a "Tapusin" button, and a "Magsalita nang malinaw sa Taglish" hint.
5. Enable the mic buttons in Home and Chat. Reuse the model manager for the Whisper download and the "Gisingin si Tsupher" setup flow.
6. iOS Safari: confirm the user-gesture requirement works; if on-device Whisper cannot run on iOS, show a graceful message and typing fallback.

CONSTRAINTS: zero network requests after models are cached; the offline test still passes.

WHEN DONE: report accuracy and latency numbers, what failed, commit "Phase 7: voice". Stop.
```

---

## Phase 8 — Trip mode (Stretch)

**Goal:** "Malapit na ang babaan!" using on-device GPS and landmark distance, with a labeled simulated-GPS mode so it can be demoed indoors.

```
Read CLAUDE.md fully and BUILD_PHASES.md sections 2 and 8. Phases 2–6 are merged.

TASK: Phase 8 only. Build Trip mode.

1. Trip screen from "Simulan ang Ruta": current leg, next landmark, distance to the alight point, progress bar, and the Luggage sprite at the start.
2. GPS: navigator.geolocation.watchPosition with an accuracy filter; haversine distance to the alight landmark; alerts at about 1 km, 300 m and 100 m (thresholds in config). Explain the location permission in Taglish before asking. Location never leaves the device and is never stored.
3. Alert screen per the showcase: "Malapit na ang babaan!", the distance, a "Para po!" speech bubble with the Jumping or Waving sprite, a dismiss button ("Sige, Tsupher!"), an in-app chime, and vibration where supported (not on iOS).
4. Keep the screen awake with the Wake Lock API; re-acquire after visibility changes; explain that PWAs cannot reliably run in the background.
5. Simulated GPS (dev and demo only): replay a GPS track along the chosen route at an adjustable speed. A visible "Simulated GPS" banner must be shown whenever it is active.
6. Multi-leg trips: advance to the next leg when the user passes the alight point or taps "Nakababa na ako".

CONSTRAINTS: no background-run claims; no network.

WHEN DONE: report passed/failed (real-GPS behavior is untested until it is tried outside), commit "Phase 8: trip mode". Stop.
```

---

## Phase 9 — Paborito, settings, contribution export (Stretch)

```
Read CLAUDE.md fully and BUILD_PHASES.md sections 2 and 9. Phases 2–6 are merged.

TASK: Phase 9 only. Local favorites, settings and contribution export.

1. Dexie version 2 migration (keep existing data): favorites {id, kind: 'route'|'place', payload, createdAt} and settings {key, value}.
2. Paborito screen per the showcase: tabs Mga Ruta / Address (saved landmarks only), a "Kamakailang Hinanap" list from recent plans, heart toggle on results and detail screens (Love sprite on save).
3. Settings: Wika (Taglish default / English, affects src/copy.ts and Tsupher's replies), Unit (₱ and minutes), reset session, and "Burahin lahat ng data" (deletes all local data after confirmation).
4. Contribution queue: "May mali ba?" form on route detail (what is wrong, optional note), stored locally, exportable as JSON and CSV, importable for the team; a manual "sync now" is just export. No network.
5. Wire Higit Pa to Modes, Offline Mode, Settings, About/Disclosure.

CONSTRAINTS: no accounts, no network, existing tests still pass.

WHEN DONE: report passed/failed, commit "Phase 9: favorites + settings". Stop.
```

---

## Phase 10 — Offline proof and hardening (Must)

**Goal:** make the "local AI" claim demonstrable on screen and make the app survive real-world conditions.

```
Read CLAUDE.md fully and BUILD_PHASES.md sections 2 and 10. All earlier phases are merged.

TASK: Phase 10 only. Proof panel and hardening. Add no new features.

1. Offline Mode screen with real state: service worker active, route pack loaded (version and fare as-of date), model cached (name, size from the cache), backend (WebGPU or WASM), last inference latency and tokens/s, a count of cross-origin requests since load (PerformanceObserver), and the app-measured bytes-sent tally labeled as such. Each checkmark must be derived from actual state, never hardcoded.
2. Failure handling: model load failure or low memory falls back to the rules lane with a Taglish message; storage quota errors are explained; an error boundary shows Tsupher "Sad" with a retry; a new service worker shows an update prompt that does not interrupt an active chat.
3. Data versioning: show the route pack version and fare "as of" date in About and on results; stale-data warning if the fare date is older than a configurable limit.
4. Performance: report precache size, first-load size, time to interactive on a throttled profile; keep the total model plus data download visible in setup.
5. Accessibility: contrast of cream/amber text, 44 px targets, focus order, aria labels on sprites and icons, reduced motion everywhere, text scaling to 200%.
6. iOS notes: document what works and what does not on iOS Safari (WebGPU, Wake Lock, storage eviction, install flow). Add a manual test checklist to the README.
7. E2E: a Playwright script that runs plan → follow-up → avoid → detail with the network off using the rules lane; a separate documented manual test for the LLM lane.
8. Lighthouse PWA/performance/accessibility audit saved to docs/audit.md with fixes applied.

WHEN DONE: report numbers and what remains risky; commit "Phase 10: proof + hardening". Stop.
```

---

## Phase 11 — Demo and submission pack (Must)

**Goal:** a rehearsed three-minute demo, honest disclosure, and a clean repo.

```
Read CLAUDE.md fully and BUILD_PHASES.md sections 2 and 11. All earlier phases are merged.

TASK: Phase 11 only. Documentation and demo preparation. Change app code only to fix demo-blocking bugs.

1. DEMO.md: a three-minute script (hook, airplane mode on, Taglish question, Tsupher thinking, follow-up "may mas mura?", avoid what-if, proof panel with devtools Network showing zero requests, voice if built, simulated-GPS arrival alert labeled as simulated, close). Include exact phrases to say and what to click, plus timings.
2. Pre-flight checklist: models cached on the demo laptop, WebGPU verified in the demo browser, laptop charged, airplane mode toggle practice, a second device ready, browser storage not cleared, a backup screen recording of a successful run, and a rules-lane fallback line to say if the LLM fails.
3. DISCLOSURE.md: every model (name, version, license, size, source), every library with version and license, every data source (synthetic vs team ride-verified, with dates), fonts and their licenses, how the mascot, logo and illustrations were made, and the AI-assisted development tools used. Flag anything unverified.
4. GAP.md: a table of what Sakay.ph, Moovit and Google Maps do in airplane mode, filled only from the team's real tests (leave rows blank if untested, with the test steps).
5. README: what Para! is, what is deterministic vs AI, honest limits (one corridor, sample data labels, GPS caveats), how to run, how to test offline, architecture diagram, screenshots.
6. Submission pack: a one-paragraph project description, a three-bullet "why local AI" statement, a feature list marked built / partial / not built, and a "what we built during the hackathon" list matching the git history.
7. Repo hygiene: remove dead code and dev-only routes from production builds, confirm .gitignore, confirm no secrets or personal data in the repo.

WHEN DONE: report anything in the docs you could not verify. Commit "Phase 11: demo + submission". Stop.
```

---

## Final checklist before submitting

- [ ] Works in real airplane mode on the demo laptop after models are cached
- [ ] Router results are deterministic and never LLM-generated
- [ ] Sample or unverified data is labeled on screen
- [ ] DISCLOSURE.md matches what is actually in the build
- [ ] Backup recording of a successful run exists
- [ ] Git history shows the work was done during the hackathon
