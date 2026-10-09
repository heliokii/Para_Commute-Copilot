## Fixes applied after the first audit run

| Finding | Fix |
|---|---|
| SEO: `robots.txt` was the app's HTML fallback, so it was invalid (score 92) | Added `public/robots.txt`. SEO is now 100. |
| Contrast: the sample-data label in About was terracotta on cream, 3.6:1 | Replaced with the caution badge (dark text). Terracotta is no longer used for text on cream. |
| Tap target: the Home prompt had a 1 px screen-reader-only submit button | Replaced with a visible 48 px send button. |
| 200% text: the bottom nav pushed two tabs off-screen | Tabs can now shrink and their labels truncate. |
| 200% text: Home header, Setup card and Detail fare column overflowed sideways | Header wraps, long words wrap, the fare drops under the mode name. |
| 200% text: mascot images doubled in size with the text and squeezed it | Mascot and logo sizes are now in pixels, so only text grows. |
| Reduced motion | No element was still animating; no change needed. |
| Focus order | No backward jumps and no focus on hidden elements once measured from the top of the document; no change needed. |

## What remains

- Performance is about 90 on a simulated slow phone. First Contentful Paint (about 2.2 s) and Largest Contentful Paint (about 2.9 s) are the weak spots. The main bundle is about 393 KiB (123 KiB gzipped); splitting the plan and chat screens into lazy chunks would help and was not done.
- Lighthouse runs against the Home screen only. The other screens were checked by the sweep above, which is a custom script, not a full WCAG audit.
- No screen reader was used. Accessible names exist on every control, but how the screens read aloud is untested.
- Colour contrast was checked for the token pairs listed above. Text drawn at reduced opacity on the gradient backdrop was not measured.
- Nothing here was measured on a phone.
