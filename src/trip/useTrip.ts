import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SIM_SPEEDS,
  START_STATE,
  TRIP_CONFIG,
  advanceLeg,
  applyFix,
  buildTrack,
  pointAt,
  trackLengthM,
  type Fix,
  type TripAlert,
  type TripLeg,
  type TripState,
} from './trip.ts'

export type TripSource = 'ask' | 'gps' | 'sim'
export type GpsProblem = 'denied' | 'unavailable' | 'unsupported' | null

const SIM_TICK_MS = 200

function chime(context: AudioContext | null) {
  if (!context) return
  try {
    ;[880, 1175].forEach((hz, i) => {
      const osc = context.createOscillator()
      const gain = context.createGain()
      const start = context.currentTime + i * 0.25
      osc.frequency.value = hz
      gain.gain.setValueAtTime(0.2, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
      osc.connect(gain).connect(context.destination)
      osc.start(start)
      osc.stop(start + 0.24)
    })
  } catch {
    // No audio: the alert screen still shows.
  }
}

/**
 * Trip session. Positions are used for one calculation and dropped: only the
 * distance to the alight point is kept in state, and nothing is stored or sent.
 */
export function useTrip(legs: TripLeg[]) {
  const [source, setSource] = useState<TripSource>('ask')
  const [state, setState] = useState<TripState>(START_STATE)
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [weakAccuracy, setWeakAccuracy] = useState<number | null>(null)
  const [problem, setProblem] = useState<GpsProblem>(null)
  const [alert, setAlert] = useState<TripAlert | null>(null)
  const [simKmh, setSimKmh] = useState(SIM_SPEEDS[2])
  const [awake, setAwake] = useState<boolean | null>(null)

  const stateRef = useRef(state)
  const audioRef = useRef<AudioContext | null>(null)
  const travelledRef = useRef(0)
  const track = useMemo(() => buildTrack(legs), [legs])

  const feed = useCallback(
    (fix: Fix) => {
      const step = applyFix(stateRef.current, fix, legs)
      if (!step.accepted) {
        if (!stateRef.current.done) setWeakAccuracy(fix.accuracy)
        return
      }
      const sameLeg = step.state.legIndex === stateRef.current.legIndex
      stateRef.current = step.state
      setState(step.state)
      setDistanceM(sameLeg ? step.distanceM : null)
      setWeakAccuracy(null)
      if (step.alert) {
        setAlert(step.alert)
        chime(audioRef.current)
        navigator.vibrate?.([200, 100, 200]) // Not supported on iOS.
      }
    },
    [legs],
  )

  // Start must come from a tap: audio and the permission prompt both need a gesture.
  const start = useCallback((next: 'gps' | 'sim') => {
    try {
      audioRef.current ??= new AudioContext()
      void audioRef.current.resume()
    } catch {
      audioRef.current = null
    }
    if (next === 'gps' && !('geolocation' in navigator)) {
      setProblem('unsupported')
      return
    }
    setProblem(null)
    setSource(next)
  }, [])

  const nakababa = useCallback(() => {
    const next = advanceLeg(stateRef.current, legs.length)
    stateRef.current = next
    setState(next)
    setDistanceM(null)
    setAlert(null)
  }, [legs.length])

  const stop = useCallback(() => {
    setSource('ask')
    setAlert(null)
    setDistanceM(null)
    setWeakAccuracy(null)
    travelledRef.current = 0
    stateRef.current = START_STATE
    setState(START_STATE)
  }, [])

  useEffect(() => {
    if (source !== 'gps') return
    const id = navigator.geolocation.watchPosition(
      (position) =>
        feed({ lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy }),
      (error) => {
        setProblem(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
        if (error.code === error.PERMISSION_DENIED) setSource('ask')
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [source, feed])

  useEffect(() => {
    if (source !== 'sim') return
    const total = trackLengthM(track)
    const timer = setInterval(() => {
      if (stateRef.current.done) return
      const target = Math.min(travelledRef.current + (simKmh / 3.6) * (SIM_TICK_MS / 1000), total)
      // Small steps so a fast replay cannot jump over a threshold.
      const steps = Math.max(1, Math.ceil((target - travelledRef.current) / TRIP_CONFIG.simStepMeters))
      const from = travelledRef.current
      for (let i = 1; i <= steps; i++) {
        feed({ ...pointAt(track, from + ((target - from) * i) / steps), accuracy: 5 })
      }
      travelledRef.current = target
    }, SIM_TICK_MS)
    return () => clearInterval(timer)
  }, [source, simKmh, track, feed])

  const running = source !== 'ask' && !state.done
  useEffect(() => {
    if (!running) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      if (!navigator.wakeLock || document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) return void lock.release()
        sentinel = lock
        setAwake(true)
        lock.addEventListener('release', () => setAwake(false))
      } catch {
        setAwake(false)
      }
    }
    void acquire()
    // The browser drops the lock when the page is hidden; take it again on return.
    const onVisible = () => document.visibilityState === 'visible' && void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [running])

  return {
    source,
    state,
    distanceM,
    weakAccuracy,
    problem,
    alert,
    dismissAlert: () => setAlert(null),
    simKmh,
    setSimKmh,
    awake: running && !navigator.wakeLock ? false : awake,
    start,
    nakababa,
    stop,
  }
}
