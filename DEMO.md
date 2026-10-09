# Para! demo script (three minutes)

Read this with `docs/LLM_MANUAL_TEST.md` and the pre-flight checklist at the bottom.

**State of the build this script was written against (2026-10-09):**
- The app runs on the **synthetic sample pack**. Place names are "SYN Alpha Terminal", "SYN Foxtrot Station" and so on. Fares and times are made up and labeled "SAMPLE DATA" on screen. Say so out loud. Once the ride-verified corridor pack is in, replace the place names in the lines below and re-time the script.
- **Voice is built on branch `phases-7-9` only (Phase 7), and is untested on human speech.** It is not in `submission-v1`. Do not demo it before a person has run `docs/voice-test/PHRASES.md` on the demo laptop. **Trip mode and the arrival alert are not built** (Phase 8). Their slots are marked below. Do not describe them as working.
- The expected fares below are the hand-computed values for the sample pack. If the screen shows anything else, stop and check: the router or the pack changed.

## Script

| Time | Do | Say |
|---|---|---|
| 0:00 to 0:20 | Para! is open on Home, online. | "Sa commute, madalas mawalan ng signal: sa tunnel, sa terminal, sa probinsya. Ang Para! ay commute copilot na gumagana kahit walang signal. Lahat ng AI, nasa device mismo. Walang ipinapadala kahit saan." |
| 0:20 to 0:35 | Turn on airplane mode in full view. Reload the app. Point at the status pill: "Offline". | "Airplane mode na. I-reload natin. Bukas pa rin." |
| 0:35 to 1:00 | In the Home prompt, type: `Paano pumunta sa Foxtrot galing Alpha?` and send. The chat opens with three options. | "Taglish ang tanong. Ito si Tsupher. Tatlong opsyon: pinakamura, pinakamabilis, at pinakakaunting sakay. Sample data pa ito, kaya may label na 'SAMPLE DATA' at 'Hindi pa verified'." Expected first card: Mas mura, ₱26.00, 45 min, 2 sakay. |
| 1:00 to 1:10 | Nothing to click. | "Mabilis iyon dahil malinaw ang tanong: simpleng rules lang ang nagbasa. Ang AI model, tinatanong lang kapag hindi malinaw, at sa laptop din ito tumatakbo." (The model is not used for a complete question like this one. To show the model itself, use the optional step under the table.) |
| 1:10 to 1:30 | Type: `may mas mura?` | "Follow-up. Hindi nag-imbento si Tsupher ng bagong ruta. Binago lang niya ang hinihingi sa router, at ang router ang sumagot." Expected: ₱26.00 stays first, tagged "Pinili mo". |
| 1:30 to 1:55 | Tap the chip `Iwas EDSA`. | "What-if: paano kung iiwasan ko ang EDSA? Hindi alam ng app ang totoong traffic o sarado, kaya malinaw na 'Simulated' ang label. Simulation ito ng sinabi ko, hindi balita." Expected first card: ₱30.25, tagged Simulated. |
| 1:55 to 2:15 | Tap the first option card. On Route detail, tap "Paano nakuha ang pamasahe?". | "Bawat hakbang: saan sasakay, saan bababa. Ang pamasahe may hati: base, dagdag kada kilometro, at petsa kung kailan ito totoo. Reference lang ito; ang fare matrix sa sasakyan ang masusunod." |
| 2:15 to 2:25 | Close the sheet. Tap "Tingnan sa mapa". | "Schematic na mapa mula sa route pack. Walang map tiles, kaya walang kailangang internet." |
| 2:25 to 2:50 | Higit Pa, then Offline Mode. Then show devtools Network (already open in a side window): zero requests. | "Ito ang patunay. Aktibo ang offline na kopya. Naka-load ang route pack at kita ang petsa ng pamasahe. Zero ang request sa ibang server, bilang ng browser mismo. At sa devtools: wala talagang lumabas." |
| 2:50 to 3:00 | Higit Pa, then About / Disclosure. | "Nakalista ang lahat ng model, library at pinagkunan ng data. Ang ruta at pamasahe, deterministic: hindi kailanman galing sa AI. Para! Salamat." |

### Optional: show the on-device model (adds about 20 seconds; only if the model is installed and warmed up)

After the 2:25 step, go back to the chat and type `Paano pumunta sa Delta?`. The question has no origin, so the rules cannot finish it and the model is consulted: the thinking dots appear for a second or two, then Tsupher asks "Saan ka manggagaling?". Say: "Hindi nanghula ang AI ng pinanggalingan. Nagtanong siya." Then open Offline Mode: the "Huling sagot ng AI" row now shows the measured milliseconds and tokens per second.

If Tsupher shows a route instead of asking, the model guessed. Do not use this step in the demo until that is understood.

### Slots for features that are not built

| Slot | Status | What to do in the demo |
|---|---|---|
| Voice input ("Makinig si Tsupher…") | Not built. The mic buttons are visibly disabled. | Skip. If asked: "Naka-plano, gamit ang on-device Whisper. Hindi pa tapos." |
| Arrival alert ("Malapit na ang babaan!") with simulated GPS | Not built. "Simulan ang Ruta" opens a placeholder. | Do not tap "Simulan ang Ruta". If asked, say it is planned and would be labeled "Simulated GPS" in a demo. |

### Lines for likely questions

- "Totoo ba ang mga ruta at pamasahe?" "Hindi pa. Synthetic na test network ito, kaya may label. Ang plano: isang corridor na kami mismo ang sasakay at magsusukat."
- "Bakit hindi AI ang nagru-ruta?" "Dahil nag-iimbento ang AI. Ang ruta at pamasahe, galing sa graph search at fare table. Ang AI, taga-intindi lang ng tanong."
- "Gaano kalaki ang model?" "Mga 840 MB ang default. Isang beses lang ida-download, sa WiFi. Puwede ring walang model: gumagana pa rin ang app sa rules."

## Fallback if the model fails live

Say: "Kahit walang AI model, gumagana pa rin ang ruta at pamasahe, dahil hindi ang AI ang nagko-compute ng ruta." Then continue the script. Every step in the table works through the rules lane; only the optional model step is skipped.

## Pre-flight checklist

The day before
- [ ] Decide the demo browser (Chrome or Edge) and use only that one. Stored data is per browser.
- [ ] `npm run build`, `npm run preview`. Open the app in the demo browser and install it.
- [ ] Higit Pa, Offline Mode: "AI Assistant" row. If it says no WebGPU, the demo runs on the rules lane; drop the optional model step.
- [ ] If WebGPU is available: download the model on WiFi from "Gisingin si Tsupher" and wait for "Gising na si Tsupher!".
- [ ] Run `docs/LLM_MANUAL_TEST.md` once, fully offline.
- [ ] Run the manual checklist in `README.md`.
- [ ] Record a backup screen recording of one clean run of this script. Keep the file on the laptop and on a phone.
- [ ] Do not clear browsing data after this point. Clearing it deletes the model and the offline copy.

One hour before
- [ ] Laptop charged, charger packed.
- [ ] Open the app once while online so the latest version is active. If "May bagong bersyon ng Para!" appears, tap "I-update" now, not during the demo.
- [ ] If using the optional model step: in the chat, send `Paano pumunta sa Delta?` once so the model is loaded into memory (that first load takes about 15 seconds on the test laptop; a complete question does not load the model). Answer its question (`galing Alpha`) to finish that exchange. Do not reload afterwards: a reload unloads the model, and there is no clear-chat button, so the warm-up exchange stays visible at the top of the chat during the demo.
- [ ] Open devtools Network in a second window and clear it.
- [ ] Practice the airplane-mode toggle. Know where it is without looking.
- [ ] Second device ready: a phone with the app opened once online. Expect the rules lane only on the phone.
- [ ] Notifications off. Other tabs closed.

Right before
- [ ] App on Home, online, zoom level comfortable for the room.
- [ ] Backup recording ready to play.
- [ ] The fallback line memorised.
