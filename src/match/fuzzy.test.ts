import { describe, expect, it } from 'vitest'
import { SYNTHETIC_PACK } from '../router/__fixtures__/synthetic-pack.ts'
import { editDistance, matchScore, normalize, searchLandmarks } from './fuzzy.ts'

const landmarks = SYNTHETIC_PACK.landmarks
const ids = (query: string) => searchLandmarks(query, landmarks).map((match) => match.landmark.id)

describe('normalize', () => {
  it('lowercases and strips accents and punctuation', () => {
    expect(normalize('  Señor  Sto.-Niño! ')).toBe('senor sto nino')
  })
})

describe('editDistance', () => {
  it('counts insert, delete, substitute and transpose as one edit each', () => {
    expect(editDistance('alpha', 'alpha')).toBe(0)
    expect(editDistance('alpha', 'alpa')).toBe(1)
    expect(editDistance('alpha', 'alphas')).toBe(1)
    expect(editDistance('alpha', 'alpho')).toBe(1)
    expect(editDistance('alpha', 'aplha')).toBe(1)
    expect(editDistance('', 'abc')).toBe(3)
  })
})

describe('matchScore', () => {
  it('ranks exact over prefix over word-prefix over substring over typo', () => {
    const exact = matchScore('syn alpha terminal', 'SYN Alpha Terminal')
    const prefix = matchScore('syn al', 'SYN Alpha Terminal')
    const word = matchScore('alpha', 'SYN Alpha Terminal')
    const substring = matchScore('lph', 'SYN Alpha Terminal')
    const typo = matchScore('alhpa', 'SYN Alpha Terminal')
    expect(exact).toBe(1)
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(word)
    expect(word).toBeGreaterThan(substring)
    expect(substring).toBeGreaterThan(typo)
    expect(typo).toBeGreaterThan(0.45)
  })

  it('returns 0 for empty input', () => {
    expect(matchScore('', 'Alpha')).toBe(0)
    expect(matchScore('   ', 'Alpha')).toBe(0)
  })
})

describe('searchLandmarks', () => {
  it('matches names and aliases', () => {
    expect(ids('alpha')[0]).toBe('A')
    expect(ids('Foxtrot Station')[0]).toBe('F')
    const [match] = searchLandmarks('golf', landmarks)
    expect(match.landmark.id).toBe('G')
    expect(match.matchedOn).toBe('Golf')
  })

  it('tolerates typos', () => {
    expect(ids('carlie')[0]).toBe('C')
    expect(ids('dleta')[0]).toBe('D')
    expect(ids('foxtrott')[0]).toBe('F')
  })

  it('returns nothing for empty or unrelated queries', () => {
    expect(ids('')).toEqual([])
    expect(ids('zzzzqq')).toEqual([])
  })

  it('is stable and respects the limit', () => {
    // Every landmark name starts with "SYN".
    const all = searchLandmarks('syn', landmarks, 3)
    expect(all).toHaveLength(3)
    expect(all.map((match) => match.landmark.id)).toEqual(['A', 'B', 'C'])
    expect(searchLandmarks('syn', [...landmarks].reverse(), 3)).toEqual(all)
  })
})
