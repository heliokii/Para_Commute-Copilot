# CLAUDE.md — Para! Offline Commute Helper

> "Para!" is a working name. Check it is not already taken before branding.
> Plan compiled October 9, 2026. Part A is the concept; Part B merges in the Tarsi-style offline-first PWA blueprint and agent skills.

## 1. One-line pitch

A Taglish commute copilot that plans, re-plans and guides a trip with no signal, and never sends the user's location anywhere. It is a web app (PWA) with all AI inference on the user's device.

## 2. Ground rules for the coding agent

1. **The LLM is never the router.** A deterministic graph search computes routes. The LLM only (a) parses Taglish into structured intent, (b) maps follow-ups ("pinakamura", "iwas EDSA") to router parameters, (c) explains results in Taglish.
2. **Zero network at runtime.** No analytics, no remote fonts, no CDN calls after install. Every asset, model and data pack is cached locally. A visible `bytes sent: 0` counter is part of the product.
3. **No invented data.** Never output a jeepney line, fare or terminal that is not in the route pack or fare table. If unknown, say so.
4. **What-if = user-declared constraints.** "What if EDSA is closed?" becomes an avoid-list labeled "simulated". The app cannot know real closures.
5. **Memory = a small in-memory session object.** No persistent chat history.
6. **Fares are versioned reference data**, shown with an "as of" date and a link to the official LTFRB matrix. Not a dispute resolver.
7. **Disclose** every model, library and data source in an About screen.

## 3. Corrections that shape scope

| # | Finding | Consequence |
|---|---------|-------------|
| 1 | Sakay.ph, Google Maps and Lakbayan already cover routes, fares and crowdsourcing | The gap is narrower. Test Sakay.ph, Moovit and Google Maps in airplane mode, then state exactly what they cannot do offline. |
| 2 | LLM should not route | Deterministic router in a Web Worker |
| 3 | Suggested model name "Gemma-SEA-LION-v4.5-E2B-IT" could not be verified. Gemma-SEA-LION-v4-4B-VL exists (4.3B, Filipino-capable, tool calling) but is heavy for a phone browser (a 4-bit 1B model is already ~695MB) | Benchmark 2–3 small models on a 50-query Taglish set. Use fuzzy matching against a landmark list first, LLM as fallback. |
| 4 | OpenStreetMap data claim unverified. A Metro Manila GTFS feed exists (Philippine Transit App Challenge). Jeepneys have no fixed stops, some Sakay repos were last updated in 2023, Cavite may be missing | Team ride-verifies the MVP corridor. Do not trust the feed alone. |
| 5 | DOTr lifted the suspension on the March fare hike, effective **Sept 28, 2026**. Traditional jeepney ₱14 for the first 4 km + ₱2/km; modern ₱17 + ₱2.40/km (GMA, Philstar). Top Gear differs on base-fare coverage and modern per-km (₱2.30). UV Express provisional, taxi petitions pending | Versioned fare table with effective dates. Flag conflicting sources in the data file. |

## 4. Architecture: three layers

```
Understand (local AI)  ->  Plan (deterministic, local)  ->  Explain (local AI)
Whisper-tiny + small LLM    Route pack + Router + Fares     LLM -> Taglish steps,
Taglish text/voice -> JSON  + Constraint engine             follow-up handling
```

- **Understand:** typed or spoken Taglish becomes JSON `{origin, destination, preferences, avoid[]}`. Voice uses Whisper-tiny, because the Web Speech API is cloud-backed and fails offline. Landmark fuzzy-match first, LLM fallback.
- **Plan:** route pack in IndexedDB, router in a Web Worker, versioned fare table, constraint engine.
- **Explain:** LLM turns router output into Taglish steps and answers follow-ups such as "may mas mura?" by changing router parameters, never by inventing routes.

### Concept map (nodes and links)

- **Router** (center, deterministic): takes intent from Understand, routes from Route pack, fares from Fare table, constraints from What-if rules. Output goes to Explain and Mid-trip help.
- **Understand** (MVP), **Explain** (MVP), **Route pack** (MVP), **Fare table** (MVP), **What-if rules** (MVP), **Local proof** (MVP).
- **Mid-trip help** (stretch): GPS landmark alerts along the router's path.
- **Contributions** (stretch): local queue with export, feeds the Route pack.

## 5. Feature decisions

**Keep (MVP)**
- Conversational refinement: the core demo
- What-if scenarios as declared constraints, labeled "simulated"
- Session-only contextual memory (drop "routes past a pharmacy"; needs POI data)
- Route pack: a single Cavite–Metro Manila pack, ride-verified by the team
- Fare reference with as-of date
- Terminal directory: 3–5 terminals verified on site

**Reframe**
- Offline contribution queue: local queue + JSON/CSV export + manual "sync now" (Background Sync is mostly Chromium-only)
- Accessibility: rider-contributed notes only; do not promise accessibility routing

**Defer**
- Gamified validation (needs server, moderation, anti-spam)

**Stretch: mid-trip help**
"Malapit ka na" alert using GPS (works without data on most phones) and landmark distance. PWAs cannot reliably run in the background, so use the Wake Lock API to keep the screen on.

## 6. Pre-build decisions (the team resolves these before splitting work)

- [ ] **Corridor:** pick one route set (e.g. Imus to Makati) that the team ride-verifies
- [ ] **Model:** run the 50-query Taglish test on 2–3 small models; pick the most reliable at landmarks + preferences
- [ ] **Gap claim:** airplane-mode test of Sakay.ph, Moovit, Google Maps; write down what each cannot do offline

## 7. Part B — Frontend/PWA foundation (Tarsi-style blueprint, adapted)

The Tarsi-style budget app blueprint contributes the **offline-first PWA shell, local database pattern, visual system and prompting workflow**. Its finance features (net worth, budgets, categories) do not apply and are not built.

### 7.1 Stack
- Vite + React + Tailwind (Next.js is unnecessary for a fully offline app)
- Dexie.js over IndexedDB for all local data
- Service worker via Workbox or `vite-plugin-pwa` to precache the app shell
- GSAP for motion (check bundle size; it must be cached for offline)

### 7.2 PWA core (do this first)
- `manifest.json`: app icons, theme color, `display: "standalone"`, `start_url: "/"`
- Service worker precaches HTML/CSS/JS, fonts, route pack, fare table and model files. Model weights are large: cache with explicit progress UI and a "storage used" readout.
- No account creation, ever.

### 7.3 Local database (Dexie), adapted for Para!

```js
import Dexie from 'dexie';

export const db = new Dexie('ParaDB');
db.version(1).stores({
  routePacks:    'id, corridor, version',
  routes:        '++id, packId, mode, name',
  landmarks:     '++id, packId, name, lat, lon',
  terminals:     '++id, packId, name',
  fares:         '++id, mode, effectiveDate',
  contributions: '++id, type, status, createdAt'
});
```
The chat session (origin, destination, avoid-list, last result) stays in memory, not in Dexie.

### 7.4 Core modules (replacing Tarsi's dashboard/budget modules)
| Tarsi module | Para! equivalent |
|---|---|
| Dashboard overview | Home: "Saan ka papunta?" prompt box, recent routes, offline/"bytes sent: 0" status |
| Quick Entry bottom sheet + FAB | Ask sheet: persistent mic/text button, under 3 seconds to ask |
| Category and budget progress | Route result cards: legs, transfer points, fare breakdown, as-of date |
| Analytics screen | Route compare view: cheapest vs fastest vs fewest transfers |
| Data privacy and export | Contribution queue and local JSON/CSV import/export, plus "delete all data" |

### 7.5 Agent skills to load (paths from the pasted source; verify they exist in your skills repo)
1. **Visual system:** `agent-skills/web-design/clean-minimal-beige-light-mode/` and `dark-glass-clean-layout/` for theme variables, card hierarchy, high-contrast type. Dark mode matters for night commutes.
2. **Styling:** `agent-skills/web-design/tailwindcss/` for route cards, fare tags and responsive layout.
3. **Motion:** `agent-skills/web-design/gsap/` and `animation-systems/` for sheet transitions and step-by-step route reveal; `number-details/` for the animated fare total and the `bytes sent: 0` counter. Respect `prefers-reduced-motion`.
4. **Illustration:** `agent-skills/illustration/illustration-flat/` or `illustration-outlined-cartoon/` for a mascot and empty states (e.g. offline, no route found). Inline SVG only, no remote images.
5. **Workflow:** `agent-skills/ui/design-first-ui-prompting/`. Build screens in this order with tight guardrails: Home/Ask, then Route result, then Follow-up chat, then Trip mode (mid-trip help), then Contributions/Settings.

### 7.6 Example agent prompt
> "Load `agent-skills/web-design/clean-minimal-beige-light-mode/SKILL.md` and `agent-skills/web-design/tailwindcss/SKILL.md`. Design a mobile-first PWA commute helper called Para!. Build a Home screen with a Taglish prompt box and mic button, a route result card list with fare breakdown and an 'as of' date, and a bottom-sheet follow-up chat. Store route packs and fares in IndexedDB via Dexie. Everything must work in airplane mode with zero network requests after install."

## 8. Build order

1. PWA shell + Dexie schema + airplane-mode smoke test
2. Seed route pack and fare table for the chosen corridor (ride-verified)
3. Router (Web Worker) + constraint engine + unit tests on known trips
4. Understand layer: fuzzy landmark match, then LLM parse, benchmarked on the 50-query set
5. Explain layer: Taglish steps, follow-up to parameter mapping
6. Whisper-tiny voice input
7. Polish UI with the skills in 7.5
8. Stretch: mid-trip alerts (GPS + Wake Lock), contribution queue with export

## 9. Demo plan

Airplane mode on. Ask a Taglish question. Follow up with "may mas mura?". Declare an "avoid" what-if. Keep the live `bytes sent: 0` counter visible. Close with the disclosure screen (models, libraries, data sources).

## 10. Definition of done (MVP)

- [ ] Works fully in airplane mode after first install
- [ ] One verified corridor with routes, fares and 3–5 terminals
- [ ] Router output is deterministic and never LLM-generated
- [ ] 50-query Taglish test run and model chosen
- [ ] Fare table versioned with effective date, shown on screen
- [ ] `bytes sent: 0` verified in devtools network tab
- [ ] About screen discloses models, libraries, data sources

## 11. Sources

- Commute apps overview (Globe): https://www.globe.com.ph/blog/commute-in-the-philippines-apps
- Sakay.ph on the App Store: https://apps.apple.com/app/id937998546
- Lakbayan paper (UP Diliman): https://www.atlantis-press.com/proceedings/wctp-25/126023796
- Gemma-SEA-LION-v4-4B-VL: https://featherless.ai/models/aisingapore/Gemma-SEA-LION-v4-4B-VL
- Browser LLM sizes (Pinggy): https://pinggy.io/blog/run_llm_in_browser_webgpu/
- Metro Manila GTFS feed (Sakay): https://github.com/sakayph/gtfs
- Modeling jeepney routes in GTFS: https://pleasantprogrammer.com/posts/jeepney-and-bus-routes.html
- Fare hike lifted, effective Sept. 28 (Philstar): https://philstar.com/headlines/2026/09/26/2558947/dotr-lifts-suspension-puv-fare-hike
- Fare matrix details (GMA): https://www.gmanetwork.com/news/money/economy/1003882/puvs-must-post-fare-matrix-before-charging-higher-fares-acto/story/
- 2026 fare adjustments (Top Gear): https://www.topgear.com.ph/news/motoring-news/ltfrb-approves-fare-adjustments-puvs-a2578-20260317
- DOTr fare adjustment (Manila Times via Newswav): https://newswav.com/article/dotr-approves-fare-adjustment-for-puvs-A2609_vaPwPI
- Ghost-Walk (Web Speech API offline note): https://github.com/Nabil-Mabrouk/ghost

## 12. Brand, UI and phase map (added after Phase 1)

This section overrides anything earlier that conflicts (including the GSAP and `agent-skills/...` references in section 7, since those skill files do not exist in this repo).

**Names:** the app is **Para!**; the mascot and AI guide is **Tsupher**. Never write "Kuya Para".

**Look:** Tsupher theme per the showcase in `design/reference/` (reference only, never shipped): deep-brown gradients, cream cards, amber primary buttons, rounded corners, bottom nav (Home, Ruta, Mapa, Paborito, Higit Pa). Full spec, tokens, mascot state map and copy rules are in `BUILD_PHASES.md` section 2. Animations are CSS only. No remote fonts or images.

**Assets:** processed mascot sprites live in `public/mascot/tsupher-<state>.webp`; icons in `public/icons/`. If an asset is missing, use a labeled placeholder and report it.

**Rules that matter for honesty**
- Mockup values (₱95, 2 oras, 815 MB, Imus → Cubao) are placeholders; never hardcode them. Sample or unverified data is labeled on screen.
- The map is a schematic SVG from the route pack, not map tiles.
- LLM text is never trusted for numbers or names: explanations are template-first and validated against the RouteResult.
- Simulated GPS and simulated what-ifs must always be labeled as simulated.
- "Bytes sent" is an app-measured tally; devtools Network is the real proof.
- Location, audio and typed text never leave the device and are never persisted beyond what the user saves.

**Phase map (see `BUILD_PHASES.md` for prompts):** 2 router · 3 brand shell · 4 plan flow · 5 understand (local LLM) · 6 Tsupher chat · 7 voice · 8 trip mode · 9 favorites/settings · 10 proof + hardening · 11 demo + submission. Cut order if short on time: 9, then 8, then 7.
