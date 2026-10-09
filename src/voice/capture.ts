// Microphone capture: 16 kHz mono, stopped by a simple energy check or a time
// limit. Samples live in memory only and are handed to the caller once.

export const VOICE_CONFIG = {
  sampleRate: 16000,
  /** Hard stop. */
  maxMs: 8000,
  /** Silence this long after speech ends the recording. */
  silenceMs: 900,
  /** Leading stretch used to estimate room noise. */
  noiseMs: 250,
  /** Speech is RMS above noise times this, kept inside the two limits below. */
  noiseFactor: 3,
  minThreshold: 0.01,
  maxThreshold: 0.05,
  // shortcut: thresholds were tuned on generated audio only, never on a real phone mic; calibrate on the demo device.
} as const

export const rms = (frame: Float32Array) => {
  let sum = 0
  for (const sample of frame) sum += sample * sample
  return Math.sqrt(sum / Math.max(frame.length, 1))
}

/**
 * Energy-based end-of-speech detector. Feed it the RMS and length of each
 * frame; it returns true when recording should stop.
 */
export function createEndpointer(config: typeof VOICE_CONFIG = VOICE_CONFIG) {
  let elapsedMs = 0
  let noiseSum = 0
  let noiseFrames = 0
  let heardSpeech = false
  let silentMs = 0
  return (level: number, frameMs: number): boolean => {
    elapsedMs += frameMs
    if (elapsedMs >= config.maxMs) return true
    if (elapsedMs <= config.noiseMs) {
      noiseSum += level
      noiseFrames++
    }
    const noise = noiseFrames > 0 ? noiseSum / noiseFrames : 0
    const threshold = Math.min(Math.max(noise * config.noiseFactor, config.minThreshold), config.maxThreshold)
    if (level >= threshold) {
      heardSpeech = true
      silentMs = 0
    } else if (heardSpeech) {
      silentMs += frameMs
    }
    return heardSpeech && silentMs >= config.silenceMs
  }
}

/** Audio-thread tap: posts each block of samples to the page. Inline so no extra file has to be cached. */
const TAP_WORKLET = `registerProcessor('para-tap', class extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0][0]
    if (channel) this.port.postMessage(channel.slice())
    return true
  }
})`

export interface Recording {
  /** Resolves with the samples when speech ends, the time limit hits, or stop() is called. */
  done: Promise<Float32Array>
  stop: () => void
}

/**
 * Starts recording. Asks for the microphone, so call it only from a tap.
 * Rejects with the browser's error (NotAllowedError when the rider says no).
 */
export async function record(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  // The context resamples the microphone to 16 kHz.
  const context = new AudioContext({ sampleRate: VOICE_CONFIG.sampleRate })
  const source = context.createMediaStreamSource(stream)
  // Captured on the audio thread: a main-thread tap dropped most of the audio
  // whenever the page was busy (seen while a model was loading).
  const moduleUrl = URL.createObjectURL(new Blob([TAP_WORKLET], { type: 'text/javascript' }))
  try {
    await context.audioWorklet.addModule(moduleUrl)
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop())
    void context.close()
    throw error
  } finally {
    URL.revokeObjectURL(moduleUrl)
  }
  const tap = new AudioWorkletNode(context, 'para-tap')
  const frames: Float32Array[] = []
  const ended = createEndpointer()

  let finish!: (samples: Float32Array) => void
  const done = new Promise<Float32Array>((resolve) => (finish = resolve))
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    tap.port.onmessage = null
    tap.disconnect()
    source.disconnect()
    stream.getTracks().forEach((track) => track.stop())
    void context.close()
    const samples = new Float32Array(frames.reduce((sum, frame) => sum + frame.length, 0))
    let offset = 0
    for (const frame of frames) {
      samples.set(frame, offset)
      offset += frame.length
    }
    // The frames are dropped here; the caller holds the only copy.
    frames.length = 0
    finish(samples)
  }

  tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const frame = event.data
    frames.push(frame)
    if (ended(rms(frame), (frame.length / context.sampleRate) * 1000)) stop()
  }
  source.connect(tap)
  // Connected to the output so the browser keeps pulling it; the tap writes silence.
  tap.connect(context.destination)
  return { done, stop }
}
