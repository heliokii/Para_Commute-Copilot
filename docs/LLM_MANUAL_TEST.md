# Manual test: the LLM lane

The automated end-to-end test (`npm run test:e2e`) covers the rules lane only, because it runs in a clean browser with no model. This is the manual test for the on-device model. Run it on the demo laptop, in the demo browser, before every demo.

An automated version exists for a development machine: `npm run bench -- <model-id>` once (downloads the model), then `npm run check:llm`. It blocks every host except localhost and drives the same steps.

## Setup (online, once)

1. `npm run build`, then `npm run preview`, and open http://localhost:4173.
2. Higit Pa, then "Gisingin si Tsupher".
   - Expected: the screen says "Tulog pa si Tsupher" and warns "Mag-WiFi muna".
   - If it says "Walang WebGPU ang browser na ito", stop. This browser cannot run the model. Use Chrome or Edge on a machine with a GPU.
3. Choose a model (the first one listed is the benchmark pick) and tap "Gisingin si Tsupher".
   - Expected: a progress bar with a percentage and the Driving sprite. The rest of the app stays usable.
   - If the download breaks, tap "Ituloy ang download". It should continue, not restart.
4. Wait for "Gising na si Tsupher!". Note the "Laki sa phone" figure.

## Offline run

5. Turn on airplane mode (or devtools, Network, Offline). Open devtools Network and clear it.
6. Reload the app. Expected: it loads, and Home no longer shows the "Gisingin si Tsupher" banner.
7. Home: type `Paano pumunta sa Delta?` and send.
   - This request has no origin, so the rules cannot finish it and the model is consulted.
   - Expected: "Ginigising ang model…" for some seconds on the first message (the model loads from disk), then Tsupher asks "Saan ka manggagaling?".
   - Not acceptable: Tsupher shows a route. That would mean the model invented an origin.
8. Reply `galing Alpha`. Expected: route options, first fare ₱18.25 with the sample pack.
9. Reply `iwas EDSA`. Expected: Tsupher says it is a simulation; the cards are tagged "Simulated".
10. Type something off-topic, for example `Anong ulam mamaya?`. Expected: a polite refusal and no route.
11. Higit Pa, Offline Mode. Expected:
    - "AI Assistant" is ticked and names the model and "Backend: WebGPU".
    - "Huling sagot ng AI" shows a latency in ms and tokens per second.
    - "Request sa ibang server mula nang buksan" shows 0.
    - "Bytes sent: 0".
12. Devtools Network: no request to any host other than the app's own. This is the real proof; the in-app numbers are a convenience.

## Failure drills

13. Higit Pa, "Gisingin si Tsupher", "Burahin ang model". Expected: back to "Tulog pa si Tsupher", and the chat still answers `Alpha to Delta` through the rules.
14. Fallback line to say if the model fails during a demo: "Kahit walang AI model, gumagana pa rin ang ruta at pamasahe, dahil hindi ang AI ang nagko-compute ng ruta."

## What this test does not cover

- Model-written summaries. That pass is off by default (`LLM_SUMMARY_ENABLED` in `src/ai/explain.ts`) because in real runs the text was slow and never passed the checks.
- Phones. See `docs/IOS_NOTES.md`.
