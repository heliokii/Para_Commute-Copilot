import { isFunctionWord } from '../ai/parse.ts'
import { editDistance, normalize } from '../match/fuzzy.ts'
import type { Landmark } from '../router/types.ts'

// Post-correction of a speech transcript: words that nearly spell a landmark in
// the route pack are replaced by the pack's own spelling. Nothing is invented:
// a replacement is always a name or alias from the pack, and a weak one is
// flagged so the rider confirms it.

/** Below this a span is left alone. "alfa" against "alpha" is exactly 0.6. */
const MIN_SIMILARITY = 0.6
/** At or above this a replacement needs no confirmation. Same bar as the parser's typo rule. */
const CONFIDENT_SIMILARITY = 0.8
const MAX_ALTERNATIVES = 3

export interface Correction {
  text: string
  /** False when a replacement was a weak match: ask "Ito ba ang ibig mong sabihin…?". */
  confident: boolean
  /** Other readings to offer, the uncorrected transcript last. Empty when confident. */
  alternatives: string[]
}

const similarity = (a: string, b: string) => 1 - editDistance(a, b) / Math.max(a.length, b.length, 1)

export function correctTranscript(transcript: string, landmarks: readonly Landmark[]): Correction {
  // Whisper writes non-speech as "[BLANK_AUDIO]" or "(music)".
  const words = transcript.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').split(/\s+/).filter(Boolean)
  const original = words.join(' ')
  const forms = landmarks.flatMap((landmark) =>
    [landmark.name, ...landmark.aliases].map((display) => ({ id: landmark.id, display, key: normalize(display) })),
  )

  const out: string[] = []
  // The first weak replacement: where it sits in `out`, and what else it could be.
  let weak: { index: number; options: string[] } | null = null
  let confident = true

  for (let i = 0; i < words.length; ) {
    // The best-scoring span starting here wins; on a tie, the longer one.
    let best: { length: number; span: string; scored: (typeof forms[number] & { score: number })[] } | null = null
    for (let length = Math.min(3, words.length - i); length >= 1; length--) {
      const keys = words.slice(i, i + length).map(normalize)
      if (isFunctionWord(keys[0]) || isFunctionWord(keys[length - 1])) continue
      const span = keys.join(' ')
      const joined = keys.join('')
      if (joined.length < 4) continue
      const scored = forms
        .map((form) => ({
          ...form,
          // Joined too, so "fox trot" reads as "foxtrot".
          score: Math.max(similarity(span, form.key), similarity(joined, form.key.replaceAll(' ', ''))),
        }))
        .filter((form) => form.score >= MIN_SIMILARITY)
        .sort((a, b) => b.score - a.score || a.display.localeCompare(b.display))
      if (scored.length > 0 && (!best || scored[0].score > best.scored[0].score)) best = { length, span, scored }
    }
    if (!best) {
      out.push(words[i])
      i++
      continue
    }
    const top = best.scored[0]
    if (best.span === top.key) {
      out.push(...words.slice(i, i + best.length))
    } else {
      if (top.score < CONFIDENT_SIMILARITY) {
        confident = false
        const others = best.scored.filter((form) => form.id !== top.id).map((form) => form.display)
        weak ??= { index: out.length, options: [...new Set(others)] }
      }
      out.push(top.display)
    }
    i += best.length
  }

  const text = out.join(' ')
  if (confident) return { text, confident, alternatives: [] }
  const alternatives = (weak?.options ?? []).map((option) => out.map((word, index) => (index === weak?.index ? option : word)).join(' '))
  return {
    text,
    confident,
    alternatives: [...new Set([...alternatives, original])].filter((option) => option !== text).slice(0, MAX_ALTERNATIVES),
  }
}
