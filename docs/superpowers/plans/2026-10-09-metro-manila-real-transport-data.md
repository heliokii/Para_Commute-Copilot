# Metro Manila Real Transport Data Plan

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to execute this plan task by task.

**Goal:** Replace the app's active mock Metro Manila routes and fares with sourced, dated, validated real data for the modes the app supports.

**Architecture:** Keep the app offline and feed it a versioned Metro Manila route pack. Preserve the synthetic pack for tests. Use official fare sources and an official LTFRB route inventory where available; treat legacy GTFS only as a candidate until its freshness, license, and route accuracy are checked. The fare model must support both distance bands for road PUVs and exact origin–destination fares for rail.

**Tech Stack:** Existing TypeScript `RoutePack`, CSV parser/validator, Dexie local database, Web Worker router, and Vitest tests. No new dependency planned.

**Spec:** User request in this thread; data conventions in `docs/DATA_COLLECTION.md`.

## Current state

## User-directed exclusions

- Railway routes stay excluded. 2026-10-10: user reversed the fare exclusion for rail fares only. `scripts/rail-fares-to-csv.mjs` writes LRT-1/LRT-2/MRT-3 fare matrices to `data/metro-manila/rail-pack/` (separate from the Q City Bus pack so `npm run import:ncr` cannot overwrite it). No rail routes: stations have coordinates but no segment times.
- Do not pursue or import the EDSA Carousel.
- Continue with road PUVs and other in-scope non-rail bus services. Existing rail research artifacts remain historical work and are not active-pack candidates.

- `src/db/seed.ts` still makes `SYNTHETIC_PACK` the active pack. Its transactional reseed replaces only that pack's rows and preserves other packs and user state.
- `src/router/__fixtures__/synthetic-pack.ts` contains the ocean-coordinate sample network and invented fare values. Keep it as a test fixture.
- `data/templates/*.csv` contain headers only. `docs/DATA_COLLECTION.md` says example values are made up and that routes need ride verification.
- `packFromCsv()` can build a `RoutePack`, but the app currently reads packs from Dexie; no production CSV-to-Dexie loader is connected.
- `FareEntry` now supports distance rules and exact directional OD matrices, with products, vehicle classes, effective dates, expiring fares/promotions, rider eligibility, and source provenance. The offline CSV importer and fare-detail UI support these records. Road fares use distance rules; rail support remains out of active-pack scope per user direction.
- No approved active route pack exists. Current non-rail bus leads include the MMDA Love Bus and Quezon City's eight Q City Bus services, but stop coordinates and per-segment times are still incomplete; jeepney and UV routes remain unsourced.

## Source findings (rechecked 2026-10-10)

- LRMC's two official LRT-1 matrices effective 2025-04-02 are transcribed in `data/metro-manila/lrt1-fare-matrices.json`. Their filenames are crossed: visible image headings identify Single Journey vs Stored Value. Recheck current discount products and reuse terms before import: [LRMC fare matrix](https://lrmc.ph/our-business-featured/fare-matrix/).
- LRTA's four LRT-2 matrices and the regular/discounted MRT-3 matrices are recorded as separate products. LRTA's current fare page still states a 50% LRT-2/MRT-3 promotion effective 2026-03-23, with no end date shown; recheck before activation: [LRTA Tickets and Fares](https://www.lrta.gov.ph/tickets-and-fares/).
- LRTA's embedded station-distance spreadsheet gives all LRT-2 consecutive station distances (15.967 km total), while its Railway Operations page says 17.6 km. Preserve as an unresolved discrepancy; it is not route geometry or segment time data.
- LRTA and DOTr-MRT3 official pages confirm active station lists and publish operating schedules, but do not provide station coordinates or per-segment ride times. Approximate end-to-end times are not sufficient to invent edge weights.
- Government sources report the September 2026 road fare adjustment and temporary-guide validity through 2026-12-31, but the underlying official current LTFRB files were not retrieved. Treat reported rates as research leads only. No current route-level inventory with operating status, alignment, stops, and timings was found. The prepared LTFRB FOI request remains unsubmitted.
- Transitland's current Sakay static feed URL was fetched in 2026, but its active feed version ends 2020-06-30 and the source license restricts redistribution. Reject it for current routes. PNR Metro Manila service is suspended pending future NSCR operations; MRT-7 and Metro Manila Subway remain future services.

## Global constraints

- Include only routes and passenger stops within Metro Manila; clip cross-boundary routes only when the real NCR segment and boundary endpoints can be established without inventing stops.
- Every fare needs its official source, effective date, service area, vehicle/ticket class, and confidence/status.
- Never infer road-route alignments, times, or fares from an app screenshot or an unverified route name.
- Keep synthetic data in tests and development harnesses; do not present it as the active passenger network.
- Preserve offline routing and existing user/imported data when updating the active pack.
- Refresh current fare orders and temporary discounts at execution time; the source findings above are date-stamped, not permanent values.

## Review focus

1. Stale or modified GTFS route records can look complete while no longer operating. Record source date and route status; do not mark these routes ride-verified.
2. Fare matrices may distinguish ordinary/air-conditioned, single-journey/stored-value, and eligible discounts. Test each fare class and discount separately.
3. Temporary system-wide rail discounts can change without a route change. Store validity windows and keep the scheduled fare distinct from the promotional fare.
4. Road routes that cross the NCR boundary must not create false out-of-area itineraries or fake termini.
5. A new pack must not clear other packs or user-imported routes. Test a populated database before changing seed behavior.

---

### Task 1: Establish source inventory and coverage boundary

**Files:**
- Create: `data/metro-manila/SOURCES.md`
- Create: `data/metro-manila/source-manifest.json`

**Interfaces:**
- Record mode, publisher, source URL, source file/version date, capture date, license/terms, geography, update cadence, and whether the source is official, provisional, or field-verified.
- Define the authoritative NCR boundary source and the rule for cross-boundary PUV routes.

- [x] Check current LTFRB NCR fare guides and route circulars; locate the latest route inventory or prepare a specific FOI request for route IDs, active status, alignments, and stops. Do not file the request without the user's authorization. (Current rates found only in secondary reporting; official matrix remains a gap. Draft request remains unsubmitted.)
- [x] Check current LRTA/LRMC/MRT-3 station lists, maps, and fare matrices, including discount eligibility and any end date. (Current rail fare matrices extracted for LRT-1, LRT-2, and MRT-3; current promotions and reuse terms still need recheck before activation.)
- [x] Inspect the Sakay GTFS history, `dotc` branch, and license. Use it only as a provisional candidate set if reuse is permitted; compare it against official and field evidence. (Rejected for active pack due 2015 data, no feed dates, and restrictive license.)
- [x] Record gaps and source freshness in the manifest. Pass when every intended mode has an identified source or an explicit data gap.

### Task 2: Support road PUV fares and fare products (rail excluded)

**Files:**
- Modify: `src/router/types.ts`
- Modify: `src/router/fare.ts`
- Modify: `src/router/graph.ts`
- Modify: `src/pack/packFromCsv.ts`
- Modify: `src/screens/Detail.tsx`
- Test: `src/router/fare.test.ts`
- Test: `src/router/plan.test.ts`
- Test: `src/pack/packFromCsv.test.ts`

**Interfaces:**
- Support distance-band fares for traditional/modern jeepneys, UV Express, and bus classes, with product, vehicle class, source, and effective interval.
- Keep scheduled fares distinct from temporary or eligibility-based discounts; explain the fare calculation in `Detail.tsx`.
- Railway fare collection and exact station-pair matrices are excluded from the active pack at user direction. Existing shared matrix-fare code may remain, but do not pursue rail sources or import rail fares.

- [x] Implement road PUV distance-band fares, fare products, eligibility discounts, effective dates, CSV parsing, and fare explanations. Existing implementation and previous verification are recorded above.
- [x] Exclude railway fare research and rail fare imports from active scope at user direction.

### Task 3: Build and validate the NCR route pack

**Files:**
- Create: `scripts/import-metro-manila-pack.mjs`
- Create: `data/metro-manila/` source artifacts and generated pack files
- Modify: `scripts/validate-pack.mjs`
- Modify: `src/pack/packFromCsv.ts` only if Task 2 requires matrix rows
- Test: `src/pack/packFromCsv.test.ts`

**Interfaces:**
- Deterministically transform the approved source set into route-pack landmarks, route variants/directions, ordered stops, travel minutes, fare references, and provenance.
- Use GTFS `routes`, `trips`, `stops`, `stop_times`, and `shapes` when a vetted feed exists. Keep each direction/variant distinct. Do not substitute straight-line distance for a missing road alignment or schedule time.
- Build road fares from the latest LTFRB guide, including vehicle class. As reported effective 2026-09-28, the rates to verify against the actual current LTFRB sheets are traditional jeepney Php 14/first 4 km + Php 2/km; modern jeepney Php 17/first 4 km + Php 2.40/km; city ordinary bus Php 15/first 5 km + Php 2.49/km; city air-conditioned bus Php 18/first 5 km + Php 2.98/km; UV Express Php 2.60/km traditional and Php 3.00/km modern provisional rates.

- [x] Add the NCR geometry check and provenance checks to pack validation. Keep sourced-but-unverified routes explicitly unverified. (Stop geometry is checked against the supplied boundary; fare rows require an HTTPS source, valid effective date, product, vehicle class, and source note; unverified routes remain warnings.)
- [ ] Import all active in-scope road modes: traditional/modern jeepney, UV Express, and city bus classes. Exclude railways and the EDSA Carousel per user direction; record other suspended, stale, or out-of-scope road services with a reason.
  - 2026-10-10: `scripts/import-metro-manila-pack.mjs` (`npm run import:ncr`) exists and imports **0 routes**. It reads the Q City Bus stop inventory plus the field worksheets in `data/metro-manila/field/` and emits a route direction only when every stop has coordinates and every segment a measured distance and time. All 12 importable directions (Routes 2, 3, 4, 5, 7, 8) are skipped for missing measurements; Route 1 (historical list) and Route 6 (no direction order) are blocked at the source. Jeepney, UV Express and other bus routes still have no source. The MMDA Love Bus is not in the importer: the PIA notice returned HTTP 403 on 2026-10-10, so no stop list could be transcribed.
- [ ] Run `npm run validate:pack data/metro-manila`. Expected: no schema/reference/geometry errors; every accepted fare has a source and effective date; warnings identify any route not ride-verified.
  - 2026-10-10: the pack folder is `data/metro-manila/pack`. `npm run validate:pack data/metro-manila/pack` reports 1 error (`ncr_boundary.geojson is required`) and 0 routes. Still open.

### Task 4: Activate the real pack without deleting user data

**Files:**
- Modify: `src/db/seed.ts`
- Modify: `src/state/plan.ts`
- Modify: `src/dev/Bench.tsx` and `src/dev/RouterHarness.tsx` if they assume the active pack is synthetic
- Test: seed/pack activation tests and existing synthetic router tests

**Interfaces:**
- Export `ACTIVE_PACK_ID` for the versioned Metro Manila pack; keep `SYNTHETIC_PACK` available to unit tests and development tools that need deterministic fixtures.
- Seed/replace only the app-owned Metro Manila pack inside a transaction. Do not clear unrelated route packs, favorites, contributions, or settings.

- [x] Add a populated-database test proving reseeding updates the app-owned pack and preserves another pack plus user state. (`npm run check:migrate`.)
- [x] Seed only the app-owned pack rows transactionally; preserve other packs, fares, terminals, favorites, settings, and contributions.
- [ ] Switch the app's default pack and update labels/disclosures with the pack's `as of` date and source confidence.
  - 2026-10-10: the switch is built but not thrown. `src/db/activePack.ts` picks the bundled pack in `src/db/generated/metro-manila-pack.json` once it has a route, else the synthetic pack; `src/db/seed.ts` seeds whichever is active. The bundled pack is empty, so the default is still `synthetic-pack`. About and the router harness show the sample label only for a pack that carries a `note`.
- [ ] Build the app and run router, pack, seed, and offline smoke checks. Confirm the default route results use only in-scope real data and report unverified coverage honestly.
  - 2026-10-10: build and checks pass with the synthetic pack still active. Not done for real data: there is none. The app has never been run in a browser with a real pack.

## Completion criteria

- The default pack contains sourced Metro Manila routes and fares for all modes claimed by the app; every imported row has provenance and an `as of` date.
- Road PUV fares match current LTFRB fare guides and vehicle classes. Railways and the EDSA Carousel are outside the active-pack scope per user direction.
- Routes outside NCR are not returned. Unsupported or unverified services are labeled, not silently invented.
- The synthetic fixture still supports deterministic tests and the active database update preserves user data.
- Validation, route/fare tests, production build, and offline smoke checks pass.
