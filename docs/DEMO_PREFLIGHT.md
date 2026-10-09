# Demo pre-flight (one page)

Demo laptop, production build, one browser only (Chrome or Edge). Full script: `DEMO.md`.

## Before the day

- [ ] `npm ci`, `npm run build`, `npm run preview`, open http://localhost:4173 in the demo browser, install the app.
- [ ] Higit Pa, Offline Mode: AI row must read WebGPU. If it says no WebGPU, run the demo on the rules lane and skip the model step.
- [ ] Setup, "Gisingin si Tsupher": download **Qwen2.5 1.5B Instruct** (about 840 MB) on WiFi. Wait for "Gising na si Tsupher!". Model files live in this browser profile only. Another browser or profile has no model.
- [ ] Voice (branch `phases-7-9` only): on the same Setup screen tap "I-download ang boses" (Whisper tiny, about 142 MB). Then tap the mic once and allow the microphone, so the permission prompt does not appear during the demo. Run `docs/voice-test/PHRASES.md` first: voice has never been tested with a human voice.
- [ ] Do not clear browsing data. It deletes the model and the offline copy.
- [ ] Record a backup screen recording of one clean run.

## One hour before

- [ ] Charged, charger packed, notifications off, other tabs closed.
- [ ] Open the app online once. If "May bagong bersyon ng Para!" shows, tap "I-update" now.
- [ ] Warm the model: send `Alpha -> Charlie` in the chat once and wait for the options (first load takes 10 to 18 s). Do not reload afterwards: a reload unloads the model.
- [ ] Devtools Network in a second window, cleared.
- [ ] Know where the airplane-mode switch is.

## Browser flags

- None needed on current desktop Chrome or Edge with a GPU. WebGPU is on by default.
- Do not use headless mode, a remote desktop session or a VM: WebGPU may be missing.
- `--enable-unsafe-webgpu` and `--ignore-gpu-blocklist` were used only by our test scripts. If the AI row says no WebGPU, try `chrome://flags` > "Unsafe WebGPU Support". Untested as a demo fix.
- Not tested on any phone. Expect rules lane only on a phone.

## If the model lane fails

- Symptom: AI row says no WebGPU, the "Ginigising ang model…" note never ends, or Tsupher says the model did not open.
- Say: "Kahit walang AI model, gumagana pa rin ang ruta at pamasahe, dahil hindi ang AI ang nagko-compute ng ruta."
- Continue with the `DEMO.md` table. Every step there works on the rules lane. Skip the model step.
- If a route shows when it should have asked (model guessed): stop using the model step.

## Five queries the rules lane cannot parse but the model can

Run on 2026-10-09 against the synthetic pack, with the cached Qwen2.5 1.5B model, network blocked, through `parse()` in `src/ai/parse.ts`. "Lane" is the lane that answered. The rules lane was tried first on each and could not finish, so the model answered. All five returned the origin and destination listed, preference "cheapest", no avoid-list. Repeat runs (3 runs for 1 to 4, 1 run for 5) gave the same answers.

| # | Type this | Lane | Result | Fare/route |
|---|---|---|---|---|
| 1 | `Alpha -> Charlie` | llm | SYN Alpha Terminal to SYN Charlie Junction | from router |
| 2 | `Charlie Junction hanggang Golf Chapel, pinakamura` | llm | Charlie Junction to Golf Chapel | from router |
| 3 | `Alpha Terminal hanggang Foxtrot Station, pinakamura` | llm | Alpha Terminal to Foxtrot Station | from router |
| 4 | `Charlie -> Foxtrot, pinakamura` | llm | Charlie Junction to Foxtrot Station | from router |
| 5 | `Bravo Market hanggang Delta Plaza, pinakamura` | llm | Bravo Market to Delta Plaza | from router |

Honest notes:
- Each took 1.5 to 2.2 s once the model was loaded; the first query after a restart took 9 to 18 s.
- The model is weak on this kind of phrasing. In the same session it did **not** finish: `Bravo -> Delta`, `Foxtrot > Alpha`, `Echo Mall hanggang Golf Chapel`, `Golf -> Delta`, `Bravo Market hanggang Alpha Terminal`, `Echo -> Alpha, pinakamura`. It asked a question or said unsupported. Use only the five above, and type them exactly.
- These were verified through the parser, not typed into the chat screen. After warm-up, type #1 in the chat once before the demo to confirm the options appear.
- The model asks "Saan ka manggagaling?" for `Paano pumunta sa Delta?`. That is the safe model demo from `DEMO.md`.
