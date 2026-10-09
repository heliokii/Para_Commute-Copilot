# iOS Safari notes

**Nothing in this file was tested on an iPhone or iPad.** No iOS device was available during the build. Every line below comes from platform documentation and release notes as understood at the time of writing (October 2026), and each needs a check on a real device before the team relies on it. The "How to check" column says what to do.

## What should work

| Area | Expectation | How to check on a device |
|---|---|---|
| Service worker and offline shell | Supported. The app shell, fonts, mascot images and route pack should load in airplane mode after one online visit. | Open the site, wait a few seconds, turn on airplane mode, reload. |
| IndexedDB (Dexie) | Supported. | Higit Pa, About: the data counts should show. |
| Install | No install prompt exists on iOS. The rider uses Share, then "Add to Home Screen". The app then opens standalone with the Para! icon (`apple-touch-icon.png`, 180 px). | Add to Home Screen, open from the icon, confirm there is no Safari toolbar. |
| Safe areas and viewport | The layout uses `env(safe-area-inset-*)` and `dvh` units. | Check the top bar under the notch and the bottom nav above the home indicator. |
| Rules lane (plan flow, chat without a model) | Plain JavaScript and a Web Worker. Should work. | Run the manual checklist in `README.md`. |
| Reduced motion and text size | `prefers-reduced-motion` is honoured. Text scaling was tested by doubling the root font size in desktop Chrome, not with iOS Dynamic Type. | Settings, Accessibility: turn on Reduce Motion; use Safari's text size control. |

## What is uncertain or likely limited

| Area | Concern | How to check |
|---|---|---|
| WebGPU | Safari 26 (iOS 26) ships WebGPU on by default. Older iOS versions have it off or behind a feature flag. Without WebGPU the app shows "Walang WebGPU ang browser na ito" and uses the rules lane. | Higit Pa, Offline Mode: read the AI Assistant row. |
| `shader-f16` | Every benchmarked model build is a `q4f16` build, which needs the WebGPU `shader-f16` feature. It is not known whether iOS Safari exposes it on all devices. If it is missing, the model will fail to load and the app falls back to rules. | Try the Setup screen with the smallest model. |
| Memory | iOS ends web pages that use too much memory. The recommended model is an 840 MB download and needs more than that while running. A phone may reload the page while the model loads. The 277 MB model is the safer first try, although it parsed poorly in the benchmark. | Download the smallest model first. Watch for the page reloading by itself. |
| Model download size and storage | Safari sets a storage quota per site. A large model may hit it. The Setup screen shows a plain message for storage-full errors, but that path was only exercised with a simulated error name, never a real full device. | Download a model on a device with little free space. |
| Storage eviction | Safari can delete a site's stored data (including a downloaded model and the offline shell) after about seven days without a visit, unless the site was added to the Home Screen. The app calls `navigator.storage.persist()`, but Safari decides on its own whether to grant it. | Install to the Home Screen before the demo. Check the storage line on the Setup screen: it says whether storage is protected. |
| Update prompt | The "May bagong bersyon" banner depends on the service worker update flow, which was tested in desktop Chrome only. | Deploy twice and reopen the app. |
| Performance | All timings in `docs/model-benchmark.md` and `docs/audit.md` are from a laptop. Expect a phone to be several times slower, especially for the model. | Time one chat reply on the device. |

## Branch `phases-7-9`: built, never run on an iPhone

| Feature | iOS point to remember |
|---|---|
| Voice (Phase 7) | The microphone needs a user gesture and a permission prompt each session in some cases. On-device Whisper may be too heavy for a phone. |
| Trip mode (Phase 8) | The Vibration API does not exist on iOS. The Screen Wake Lock API exists in recent Safari versions but has had problems inside Home Screen web apps on older iOS releases. Web apps do not run in the background, so GPS alerts stop when the screen locks. Only Simulated GPS was ever run. |
| Export of reports (Phase 9) | "I-export" makes a file with a temporary link and a download attribute. How Safari on iOS saves or previews a .json or .csv file this way is not known; the desktop test replaced the click. Check where the file lands and that it can be shared. |
| Import of reports (Phase 9) | A file picker for .json and .csv. Whether the Files app offers those types here is not known. |
| Saved favorites, settings and reports (Phase 9) | Stored in IndexedDB, so the same seven-day eviction risk as the model applies unless the app is on the Home Screen. |

## Install flow to rehearse before the demo

1. Open the site in Safari while online.
2. Share, then "Add to Home Screen".
3. Open Para! from the Home Screen icon (not from Safari: the two do not share storage on iOS).
4. If the device has WebGPU: Higit Pa, "Gisingin si Tsupher", download a model on WiFi, wait for "Gising na si Tsupher!".
5. Turn on airplane mode and run the manual checklist.

## Voice (Phase 7, branch `phases-7-9`)

Not tested on any iPhone or iPad. From the code only: the microphone is requested inside the tap handler, which is what Safari requires; audio capture uses AudioWorklet and a 16 kHz AudioContext; Whisper runs on WASM when WebGPU is missing. If any of these fails, the listening screen shows "Hindi gumana ang boses sa device na ito" and the rider types instead. Whether the model loads within iOS memory limits is unknown.
