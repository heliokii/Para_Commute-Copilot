# Voice test phrases

15 Taglish phrases for testing voice input. They use the **synthetic sample pack** names (Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel), which are not real places. Replace them when the real corridor pack exists.

The same list lives in `tests/voice-phrases.json`, with the Intent each phrase should produce. A unit test (`src/voice/voice.test.ts`) confirms every phrase parses to that Intent when typed, so a failure on the bench page is a speech problem, not a parser problem.

## How to run the test

1. `npm run dev`, then open http://localhost:5173/#/voice-bench in Chrome or Edge. The page exists only in the dev server, never in the production build.
2. If the page says the voice model is not downloaded, follow its link to "Gisingin si Tsupher" and tap "I-download ang boses" (Whisper tiny, about 142 MB with WebGPU).
3. Pick the Whisper language (`tagalog` or `english`). There is no auto-detect in transformers.js.
4. For each phrase: tap **Record**, allow the microphone, read the phrase aloud. Recording stops on silence, or after 8 seconds, or when you tap **Stop**.
5. The row shows what Whisper heard, the corrected text, the audio length, the latency, and **PASS** or **FAIL** (whether the corrected text parsed to the expected Intent with the same parser the chat uses).
6. Copy the JSON at the bottom of the page into `docs/voice-benchmark.md`, with the speaker, device, browser and room noted.

Run the list once per language setting, per model (tiny and base), and per speaker. Audio is never saved: it is wiped right after transcription.

## Phrases

| # | Say this | Expected |
|---|---|---|
| 1 | Paano pumunta sa Foxtrot galing Alpha? | Alpha to Foxtrot |
| 2 | Galing ako sa Alpha Terminal, papunta sa Delta Plaza. | Alpha to Delta |
| 3 | Mula Bravo papuntang Foxtrot Station. | Bravo to Foxtrot |
| 4 | Paano makapunta sa Golf Chapel mula sa Alpha? | Alpha to Golf |
| 5 | Galing Charlie, papunta sa Echo Mall. | Charlie to Echo |
| 6 | Papunta ako sa Delta galing Bravo, yung pinakamura. | Bravo to Delta, cheapest |
| 7 | Galing Alpha papunta sa Foxtrot, yung pinakamabilis. | Alpha to Foxtrot, fastest |
| 8 | Mula Alpha hanggang Foxtrot, walang lipat. | Alpha to Foxtrot, fewest transfers |
| 9 | Galing Alpha papunta sa Foxtrot, iwas EDSA. | Alpha to Foxtrot, avoid tag EDSA (simulated) |
| 10 | Nasa Charlie ako, paano pumunta sa Foxtrot? | Charlie to Foxtrot |
| 11 | From Alpha to Delta, cheapest please. | Alpha to Delta, cheapest |
| 12 | Galing Kanto Charlie papunta sa Istasyon ng Foxtrot. | Charlie to Foxtrot |
| 13 | Mula sa Palengke ng Bravo papunta sa Plaza Delta. | Bravo to Delta |
| 14 | Papunta sa Kapilya ng Golf galing Alpha Terminal, mabilis lang. | Alpha to Golf, fastest |
| 15 | Galing Hotel papunta sa Alpha. | Hotel to Alpha (the router then reports no route: Hotel is isolated in the sample pack) |
