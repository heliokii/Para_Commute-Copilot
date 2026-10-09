# Para! Offline Commute Helper

Taglish commute helper that works with no signal. Offline-first PWA: Vite, React, TypeScript, Tailwind, Dexie. See `CLAUDE.md` for the full plan.

Current state: Phase 1, the PWA shell. No router, LLM, Whisper or voice yet. The local database holds placeholder rows labeled "SAMPLE DATA, not verified".

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
