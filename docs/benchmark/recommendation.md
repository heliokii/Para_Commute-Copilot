## Recommendation

**Use Qwen2.5 1.5B Instruct (`Qwen2.5-1.5B-Instruct-q4f16_1-MLC`) as the default model.** It is set as the default in `src/ai/runtime.ts`.

Why:
- It was the only model that asked or declined on every unclear and out-of-scope query (6 of 6). The other three turned some of those into a confident trip. For an app whose rule is "never guess", that matters more than raw extraction.
- Its avoid-list accuracy was the highest (93%) and it never produced invalid JSON.
- In the hybrid setup the app actually uses, it was the only model that did not make the result worse than rules alone.
- Apache-2.0 licence, 840 MB download, about 15 s to load from cache and about 1.7 s per reply on the test laptop.

What argues against it:
- SmolLM2 1.7B read origin and destination far better on its own (80% against 41%). If real rider phrasings turn out to defeat the rules often, SmolLM2 may be the better pick, but only with a fix for its habit of guessing a missing place.
- 840 MB is large for a phone, and phone speed was not measured.
- Qwen2.5 0.5B is the only small download (277 MB), but it found no origin or destination at all with this prompt.

What these numbers do not show:
- The seed set gives the model only 6 queries that the rules cannot finish. That is too few to rank models with confidence.
- The rules scored 100% because they were tuned on this same set. On this set the model adds nothing to accuracy; its value is unproven until the team adds real queries that the rules get wrong.
- Only one prompt was tried. Prompt changes could move every row.
- Gemma 3 1B was not available in this WebLLM version.

Before the demo: add real Taglish queries to `tests/taglish-50.json`, rerun `npm run bench`, and test the chosen model on the demo device.
