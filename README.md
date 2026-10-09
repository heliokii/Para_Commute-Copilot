# Para! Offline Commute Helper

Taglish commute helper that works with no signal. Offline-first PWA: Vite, React, TypeScript, Tailwind, Dexie. See `CLAUDE.md` for the full plan.

Current state: typed plan flow (Ruta, results, detail, schematic map, modes) on the deterministic router. Tsupher chat with follow-ups and what-ifs works on rules and templates, with an optional on-device model (see `docs/model-benchmark.md`). Voice is not built. The local database holds a synthetic test network labeled "SAMPLE DATA, not verified". It contains no real routes or fares. Progress log: `docs/PROGRESS.md`.

## Run

```sh
npm install
npm run dev
```

The service worker is not active in `npm run dev`. Use the build and preview steps below to test offline behavior.

## Build

```sh
npm run build     # type-check, then build to dist/ with sw.js and manifest.json
npm run preview   # serve dist/ at http://localhost:4173
npm run lint
```

## Test

```sh
npm test                 # router and data-validator unit tests (Vitest)
npm run check:offline    # after a build: headless Chrome, network off, then server stopped
npm run test:e2e         # after a build: plan, results, detail and map with the network off
npm run bench            # on-device model benchmark (downloads models on first run, needs WebGPU)
npm run check:llm        # after a bench run: LLM lane with all outside requests blocked
npm run check:update     # after a build: a new version waits for the rider and never reloads mid-chat
npm run audit            # after a build: Lighthouse plus an accessibility sweep, written to docs/audit.md
```

`check:offline` needs Chrome or Edge. Set `CHROME_PATH` if it is not in a default location.

Router dev harness (development only, not in production builds): run `npm run dev`, then open http://localhost:5173/#/dev/router.

## Design assets

Reference art lives in `design/reference/` and is never shipped.

```sh
npm run tokens       # sample the palette into src/styles/tokens.css
npm run assets       # cut mascot sprites and build icons into public/
npm run screenshots  # 390x844 screenshots of every screen into docs/screenshots/
```

## Route pack data

Collection guide: `docs/DATA_COLLECTION.md`. CSV templates: `data/templates/`.

```sh
npm run validate:pack              # checks data/pack
npm run validate:pack -- some/dir  # checks another folder
```

## Test airplane mode

1. `npm run build`
2. `npm run preview`, then open http://localhost:4173 in Chrome or Edge.
3. Install the app: use the install icon in the address bar (or menu, then "Install Para!").
4. Open devtools. In Application, then Service workers, confirm `sw.js` is "activated and is running".
5. In Network, set throttling to **Offline**.
6. Reload. The Home screen should load and the status pill should read "Offline".
7. Open Higit Pa, then Offline Mode. "Bytes sent" should stay at 0.
8. Open Higit Pa, then About. The library list and the sample data counts should still load (they come from IndexedDB).

For a stricter check, stop the preview server and reload the installed app. It should still load.

## Manual test checklist

Run on the demo device, in the demo browser, from the production build (`npm run build`, `npm run preview`).

Offline shell
- [ ] Load once online, then go offline and reload. Home appears.
- [ ] Higit Pa, Offline Mode: "Offline na kopya ng app" and "Route pack" are ticked; "Request sa ibang server" is 0; "Bytes sent" is 0.
- [ ] Devtools Network shows no request to any other host.

Plan flow
- [ ] Ruta: type part of a place name with a typo. The right place is suggested.
- [ ] Hanap shows options with a fare, a time, a fare "as of" date, and the "SAMPLE DATA" label while the sample pack is loaded.
- [ ] Open an option. Each leg shows where to board and alight. "Paano nakuha ang pamasahe?" shows the base fare, the per-km part and the source.
- [ ] Mapa shows the same route as a schematic. The zoom buttons work.
- [ ] Mga Mode: turn on "Iwas Traffic / Iwas EDSA", search again. Every option is tagged "Simulated".

Chat
- [ ] Home: type a full question. The chat opens with options.
- [ ] "May mas mura?" keeps or finds the cheapest option.
- [ ] The "Iwas EDSA" chip gives a simulation, and Tsupher says so.
- [ ] An off-topic question gets a polite refusal and no route.
- [ ] Tap an option card, then Back. The conversation is still there.

Model (only if the device has WebGPU)
- [ ] Follow `docs/LLM_MANUAL_TEST.md`.

Resilience
- [ ] Deploy a new build while the app is open in the chat. No reload happens. Leaving the chat shows "May bagong bersyon ng Para!", and "I-update" reloads.
- [ ] Browser text size at 200%: no sideways scrolling; every button is reachable.
- [ ] Reduce Motion on: the mascot does not bob.

iPhone and iPad: see `docs/IOS_NOTES.md`. None of it has been tested on a device.

Note: while online, the browser itself re-checks `sw.js` for updates on navigation. That is the only request after first load, and it sends no app data.
