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
- `design/reference/Para__Commute_Copilot_UI_Showcase.png` is not in the repo. Phase 3 needs it.
- Phase 3 asset prep (`BUILD_PHASES.md` 2.9) is not done: no `public/mascot/` sprites, no transparent hero, no wordmark.
