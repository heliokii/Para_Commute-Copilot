import type { Landmark } from '../router/types.ts'

// Fuzzy landmark matching over names and aliases. Pure: used by the pickers
// now and by the Taglish parser later.

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Damerau-Levenshtein distance (adjacent transpositions count as one edit). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let beforePrevious: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, beforePrevious[j - 2] + 1)
      }
      current.push(value)
    }
    beforePrevious = previous
    previous = current
  }
  return previous[b.length]
}

const similarity = (a: string, b: string) =>
  1 - editDistance(a, b) / Math.max(a.length, b.length, 1)

/**
 * How well a query matches one candidate string, 0 to 1.
 * 1 exact, 0.9 prefix, 0.85 a word starts with it, 0.75 substring,
 * otherwise edit-distance similarity against the whole string and each word.
 */
export function matchScore(query: string, candidate: string): number {
  const q = normalize(query)
  const c = normalize(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (c.startsWith(q)) return 0.9
  const words = c.split(' ')
  if (words.some((word) => word.startsWith(q))) return 0.85
  if (q.length >= 3 && c.includes(q)) return 0.75
  // Typos: compare with the whole name and with each word, capped below a substring hit.
  const best = Math.max(similarity(q, c), ...words.map((word) => similarity(q, word)))
  return Math.min(best, 1) * 0.7
}

export interface LandmarkMatch {
  landmark: Landmark
  score: number
  /** The name or alias that matched best. */
  matchedOn: string
}

/** Minimum score for a typo-level match to count. */
export const MIN_MATCH_SCORE = 0.45

/** Ranked landmark matches. Ties break by name, then id, so output is stable. */
export function searchLandmarks(
  query: string,
  landmarks: readonly Landmark[],
  limit = 6,
): LandmarkMatch[] {
  if (!normalize(query)) return []
  const matches: LandmarkMatch[] = []
  for (const landmark of landmarks) {
    let best = { score: 0, matchedOn: landmark.name }
    for (const candidate of [landmark.name, ...landmark.aliases]) {
      const score = matchScore(query, candidate)
      if (score > best.score) best = { score, matchedOn: candidate }
    }
    if (best.score >= MIN_MATCH_SCORE) matches.push({ landmark, ...best })
  }
  return matches
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.landmark.name.localeCompare(b.landmark.name) ||
        a.landmark.id.localeCompare(b.landmark.id),
    )
    .slice(0, limit)
}
