# Para! Offline Commute Helper

Taglish commute helper that works with no signal. Offline-first PWA: Vite, React, TypeScript, Tailwind, Dexie. See `CLAUDE.md` for the full plan.

Current state: PWA shell plus the deterministic router (Phase 2). No LLM, Whisper or voice yet. The local database holds a synthetic test network labeled "SAMPLE DATA, not verified". It contains no real routes or fares. Progress log: `docs/PROGRESS.md`.

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
```

`check:offline` needs Chrome or Edge. Set `CHROME_PATH` if it is not in a default location.

Router dev harness (development only, not in production builds): run `npm run dev`, then open http://localhost:5173/#/dev/router.

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
6. Reload. The Home screen should load, the status chip should read "Offline", and `bytes sent` should stay at 0.
7. Open About. The library list and the sample data counts should still load (they come from IndexedDB).

For a stricter check, stop the preview server and reload the installed app. It should still load.

Note: while online, the browser itself re-checks `sw.js` for updates on navigation. That is the only request after first load, and it sends no app data.
