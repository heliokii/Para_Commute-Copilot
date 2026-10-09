import { describe, expect, it } from 'vitest'
import phrases from '../../tests/voice-phrases.json'
import { parseWithRules, scoreParse, type ExpectedParse } from '../ai/parse.ts'
import { SYNTHETIC_PACK as pack } from '../router/__fixtures__/synthetic-pack.ts'
import { createEndpointer, rms, VOICE_CONFIG } from './capture.ts'
import { correctTranscript } from './correct.ts'

describe('correctTranscript', () => {
  it('leaves a clean transcript alone and is confident', () => {
    const result = correctTranscript('Papunta sa Delta galing Alpha.', pack.landmarks)
    expect(result).toEqual({ text: 'Papunta sa Delta galing Alpha.', confident: true, alternatives: [] })
  })

  it('fixes a near miss without asking', () => {
    const result = correctTranscript('galing alfa terminal papunta sa dalta', pack.landmarks)
    expect(result.text).toBe('galing Alpha Terminal papunta sa Delta')
    expect(result.confident).toBe(true)
  })

  it('joins a split word', () => {
    expect(correctTranscript('papunta sa fox trot', pack.landmarks).text).toBe('papunta sa Foxtrot')
  })

  it('asks when the match is weak, and offers the transcript as heard', () => {
    const result = correctTranscript('galing alfa papunta sa Delta', pack.landmarks)
    expect(result.text).toBe('galing Alpha papunta sa Delta')
    expect(result.confident).toBe(false)
    expect(result.alternatives).toContain('galing alfa papunta sa Delta')
  })

  it('never touches cue words, and drops non-speech markers', () => {
    const result = correctTranscript('[BLANK_AUDIO] may mas mura ba', pack.landmarks)
    expect(result).toEqual({ text: 'may mas mura ba', confident: true, alternatives: [] })
  })

  it('corrected text parses to the intended trip', () => {
    const { text } = correctTranscript('Galing alfa terminal, papunta sa fox trot.', pack.landmarks)
    expect(parseWithRules(text, pack).intent).toMatchObject({ originId: 'A', destinationId: 'F' })
  })
})

describe('voice test phrases', () => {
  // The bench page scores speech against these, so the typed form must already parse.
  it.each(phrases.phrases)('phrase $id parses to its expected intent when typed', ({ text, expected }) => {
    const corrected = correctTranscript(text, pack.landmarks)
    expect(corrected.text).toBe(text)
    const score = scoreParse(parseWithRules(corrected.text, pack), expected as ExpectedParse)
    expect(score).toMatchObject({ status: true, places: true, preference: true, avoid: true })
  })
})

describe('createEndpointer', () => {
  const frameMs = 100
  const feed = (levels: number[]) => {
    const ended = createEndpointer()
    return levels.findIndex((level) => ended(level, frameMs))
  }

  it('stops after speech is followed by enough silence', () => {
    const levels = [...Array(3).fill(0.001), ...Array(10).fill(0.2), ...Array(20).fill(0.001)]
    // 13 frames in, then silenceMs of quiet.
    expect(feed(levels)).toBe(13 + VOICE_CONFIG.silenceMs / frameMs - 1)
  })

  it('does not stop on silence before any speech', () => {
    expect(feed(Array(40).fill(0.001))).toBe(-1)
  })

  it('stops at the time limit even while speech continues', () => {
    expect(feed(Array(200).fill(0.2))).toBe(VOICE_CONFIG.maxMs / frameMs - 1)
  })

  it('rms of a constant frame is its level', () => {
    expect(rms(new Float32Array(160).fill(0.5))).toBeCloseTo(0.5)
  })
})
