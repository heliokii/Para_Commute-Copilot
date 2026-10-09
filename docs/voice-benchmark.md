# Voice benchmark

**Accuracy on human speech: untested.** No team voice clips existed when Phase 7 was built (2026-10-09). Everything below was measured with **generated audio**: the Windows speech synthesizer (an English voice) played into Chrome's fake microphone. It proves the plumbing, not how well Whisper understands a Filipino speaker. Fill the last section in with `/voice-bench` (see `docs/voice-test/PHRASES.md`).

## What was measured (generated audio only)

Laptop with an RTX 4050 (6 GB), headless Chrome, transformers.js 4.3.1, WebGPU. `npm run check:voice`.

| | Whisper tiny | Whisper base |
|---|---|---|
| Repository | `onnx-community/whisper-tiny` | `onnx-community/whisper-base` |
| Build used on WebGPU | encoder fp32, decoder 4-bit | encoder fp32, decoder 4-bit |
| Download, runtime files included (WebGPU) | 142 MB | 224 MB |
| Download time on the test connection | 16 to 21 s | 29 to 47 s |
| Spoken (synthesizer): "From Alpha to Delta, cheapest please." | heard "From Alpha to Delta, cheapest please" | heard "From alpha to delta. Cheapest please." |
| Parsed to the expected Intent, router answered ₱18.25 | yes | yes |
| Transcription time for about 4.2 s of audio | 1.3 to 2.3 s (first use, includes warm-up) | not recorded |

One clip is not a benchmark. Both models transcribed the one English sentence the synthesizer could say correctly; that is all that can be claimed.

Other observations:

- The same WAV decoded directly (no microphone) gave the same text on four builds of Whisper tiny: WebGPU fp32 + 4-bit decoder, WebGPU fp32, WebGPU fp16, and WASM 8-bit. On WASM it took about 3.5 s for 4.1 s of audio; on WebGPU 0.75 to 1.1 s once warm.
- A Tagalog sentence ("Galing Alpha, papunta sa Delta.") read by the English synthesizer voice came back as "Galing Alpha, papon to SA Delta". The synthesizer cannot pronounce Tagalog, so this says nothing about real Tagalog speech.
- `language` must be `tagalog` or `english`. transformers.js has no auto-detect: with no language it assumes English. The app default is `tagalog` (`VOICE_LANGUAGE` in `src/voice/whisper.ts`), chosen without evidence. Compare both on `/voice-bench`.

## Model choice

**Whisper tiny is the default**, because it is the smaller download and both models passed the only test available. Whisper base is selectable on the Setup screen. Choose between them only after the human test below.

## Human test (to be filled in by the team)

| Speaker | Device, browser | Model | Language | Phrases passed (of 15) | Median latency | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |
