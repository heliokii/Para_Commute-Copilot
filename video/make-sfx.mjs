// Usage: npm run sfx
// Synthesizes the three UI sounds used in the video (tap, whoosh, chime) as 16-bit mono WAV.
// They are generated from the maths below, not sampled from anything: no third-party audio.
import { mkdirSync, writeFileSync } from 'node:fs'

const RATE = 44100
const OUT = new URL('./src/sfx/', import.meta.url)
mkdirSync(OUT, { recursive: true })

function wav(name, seconds, sample) {
  const count = Math.round(seconds * RATE)
  const buffer = Buffer.alloc(44 + count * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + count * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(RATE, 24)
  buffer.writeUInt32LE(RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(count * 2, 40)
  for (let i = 0; i < count; i++) {
    const value = Math.max(-1, Math.min(1, sample(i / RATE, i / count)))
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2)
  }
  writeFileSync(new URL(name, OUT), buffer)
}

const tone = (t, hz) => Math.sin(2 * Math.PI * hz * t)
// Fixed seed, so the files are the same on every run.
let seed = 7
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1

// Tap: a short, soft click that drops in pitch.
wav('tap.wav', 0.07, (t) => tone(t, 900 - 5000 * t) * Math.exp(-t * 70) * 0.5)
// Whoosh: filtered noise that swells and fades.
let low = 0
wav('whoosh.wav', 0.45, (t, p) => {
  low += (noise() - low) * (0.04 + 0.25 * p)
  return low * Math.sin(Math.PI * p) ** 2 * 0.6
})
// Chime: two bell-like notes a fifth apart.
wav('chime.wav', 0.9, (t) => {
  const note = (start, hz) => (t < start ? 0 : (tone(t - start, hz) + 0.3 * tone(t - start, hz * 2.01)) * Math.exp(-(t - start) * 6))
  return (note(0, 880) + note(0.11, 1318.5)) * 0.3
})
console.log('src/sfx: tap.wav, whoosh.wav, chime.wav')
