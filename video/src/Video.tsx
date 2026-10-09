import type { CSSProperties } from 'react'
import { AbsoluteFill, Audio, Img, Sequence } from 'remotion'
import icon from '../../public/icons/pwa-512.png'
import { SCENES } from './config'
import { CLIPS, type ClipMeta, type Keys, mark } from './clips'
import { Airplane, Backdrop, Caption, Card, CountUp, Laptop, Phone, Reveal, Title, Tsupher } from './parts'
import { SCRIPT } from './script'
import chime from './sfx/chime.wav'
import tap from './sfx/tap.wav'
import whoosh from './sfx/whoosh.wav'
import { mix, useMotion, usePose } from './springs'
import { BODY, C, DISPLAY, type Layer, type Pose, type Ring } from './theme'

const { home, chat, mapa, dashboard, offline, about, sampleChat, sampleTrip } = CLIPS
const m = (clip: ClipMeta, label: string) => mark(clip, label).t
const end = (clip: ClipMeta) => clip.frames[clip.frames.length - 1]
const pesos = (text: string) => text.match(/₱[\d,.]+/g) ?? []

// --- What the app said, read from the captures. Nothing below is typed in by hand. ---
const fare = chat.facts.answer.match(/^Pamasahe, (.+?) → (.+?): Regular: (₱[\d,.]+)\. May (.+?) ngayon: (₱[\d,.]+) \(as of ([\d-]+)\)\./)
if (!fare) throw new Error(`The chat answer no longer matches the fare card layout. Answer was: ${chat.facts.answer}`)
const [, fromName, toName, regularFare, promoLabel, promoFare, fareAsOf] = fare
const banner = home.facts.offlineBanner
const bannerTitle = banner.startsWith('100% Offline') ? '100% Offline' : banner
const optionLabels = ['Mas mura', 'Mas mabilis', 'Pinakakaunting sakay'].filter((label) => sampleChat.facts.options.includes(label))
const optionFares = pesos(sampleChat.facts.options)
const whatIfFares = pesos(sampleChat.facts.whatIf)
const proofRows = offline.facts.rows.filter((row) => ['sw', 'pack', 'cross-origin'].includes(row.id))
const mapRow = mapa.facts.rows[0].replace(/ Pinagkunan$/, '')
const mapFare: string = pesos(mapRow)[0] ?? ''
if (!mapFare) throw new Error(`No fare in the map's fare row: ${mapRow}`)

// --- Video second -> capture second, pinned to the marks the capture script saved. ---
const S = SCENES
const KEYS: Record<string, Keys> = {
  home: [[10, 0], [12.6, m(home, 'network-cut')], [16.4, end(home)]],
  chat: [[16, 0.3], [16.6, m(chat, 'type:q1')], [18.6, m(chat, 'typed:q1')], [18.9, m(chat, 'send:q1')], [19.05, m(chat, 'reply:q1') + 0.15], [21.9, m(chat, 'type:q2')], [23.2, m(chat, 'typed:q2')], [23.5, m(chat, 'send:q2')], [23.65, m(chat, 'reply:q2') + 0.15], [25.4, end(chat)]],
  mapa: [[25, 0.8], [25.7, m(mapa, 'zoom')], [26.6, m(mapa, 'pan')], [27.9, m(mapa, 'tap:origin') - 0.25], [28.2, m(mapa, 'tap:origin')], [29.4, m(mapa, 'tap:destination')], [30.5, m(mapa, 'scroll')], [32, m(mapa, 'scroll') + 1.6], [33.5, end(mapa)]],
  dashboard: [[33, 0.6], [33.9, m(dashboard, 'zoom')], [35.3, m(dashboard, 'tap:origin')], [36, m(dashboard, 'tap:destination')], [36.3, end(dashboard)]],
  sampleChat: [[38, 0.3], [38.5, m(sampleChat, 'type:q1')], [39.9, m(sampleChat, 'typed:q1')], [40.1, m(sampleChat, 'send:q1')], [40.25, m(sampleChat, 'reply:q1') + 0.15], [41.9, m(sampleChat, 'type:q2')], [42.6, m(sampleChat, 'typed:q2')], [42.8, m(sampleChat, 'send:q2')], [42.95, m(sampleChat, 'reply:q2') + 0.15], [44.1, m(sampleChat, 'tap:iwas-edsa')], [44.3, m(sampleChat, 'reply:whatif') + 0.2], [45.6, end(sampleChat)]],
  tripStart: [[45.3, 0.7], [45.6, m(sampleTrip, 'tap:use-sim')], [46.4, m(sampleTrip, 'tap:speed') + 0.3]],
  // The wait for the simulated trip to reach the stop is skipped, and the video says so.
  tripAlert: [[46.3, m(sampleTrip, 'alert') - 0.2], [48.4, m(sampleTrip, 'alert') + 1.9]],
  offline: [[48, 0.3], [50, m(offline, 'scroll') - 0.1], [51.5, m(offline, 'scroll') + 1.2], [56, end(offline)]],
}
const SAMPLE_ON_SCREEN = [37.5, 48.4] as const
const PHONE_LAYERS: Layer[] = [
  { clip: home, from: 10, to: 16.5, keys: KEYS.home },
  { clip: chat, from: 16, to: 25.5, keys: KEYS.chat },
  { clip: mapa, from: 25, to: 33.5, keys: KEYS.mapa },
  { clip: sampleChat, from: SAMPLE_ON_SCREEN[0], to: 45.8, keys: KEYS.sampleChat },
  { clip: sampleTrip, from: 45.3, to: 46.8, keys: KEYS.tripStart },
  { clip: sampleTrip, from: 46.3, to: SAMPLE_ON_SCREEN[1], keys: KEYS.tripAlert },
  { clip: offline, from: 48, to: 56, keys: KEYS.offline },
]
// Rings only where the capture confirmed the markers did not move after the taps.
const RINGS: Ring[] = mapa.facts.markersStill
  ? (['tap:origin', 'tap:destination'] as const).map((label, index) => ({ at: [28.2, 29.4][index], until: 30.4, x: mark(mapa, label).x!, y: mark(mapa, label).y! }))
  : []
const SOUNDS: [number, string, number][] = [
  ...[5, 10, 16, 25, 33, 38, 48, 55].map((at): [number, string, number] => [at - 0.15, whoosh, 0.45]),
  ...[18.9, 23.5, 28.2, 29.4, 35.3, 36, 40.1, 42.8, 44.1, 45.6].map((at): [number, string, number] => [at, tap, 0.6]),
  ...[12.6, 19.2, 30, 46.4, 55.5].map((at): [number, string, number] => [at, chime, 0.4]),
]

function useLayout() {
  const { portrait, width, height } = useMotion()
  const pose = (at: number, x: number, y: number, scale: number, rotY: number, rotX: number): Pose => ({ at, x, y, scale, rotX: portrait ? rotX / 2 : rotX, rotY: portrait ? rotY / 2 : rotY })
  if (portrait) {
    return {
      phone: [pose(0, 540, 2900, 1.2, -16, 8), pose(10, 540, 830, 1.28, -12, 4), pose(15.9, 540, 830, 1.28, 9, 2), pose(25.3, 540, 880, 1.4, -3, 1), pose(29.9, 540, 830, 1.28, -8, 2), pose(32.7, 1900, 830, 1.1, -24, 0), pose(37.9, 540, 870, 1.25, 10, 2), pose(45.3, 540, 870, 1.25, -7, 2), pose(48, 540, 800, 1.2, -10, 3), pose(55, 540, 3000, 1, 0, 10)],
      laptop: [pose(0, 540, 2600, 1, -8, 8), pose(33, 540, 820, 1, -6, 5), pose(35.6, 540, 820, 1.03, 5, 4), pose(37.8, 540, -900, 0.9, 0, -8)],
      laptopWidth: 980,
      title: { left: 0, right: 0, top: 110, textAlign: 'center' } as CSSProperties,
      panel: { left: 60, right: 60, top: 1415 } as CSSProperties,
      proofPanel: { left: 50, right: 50, top: 1345 } as CSSProperties,
      caption: { left: 60, right: 60, top: 1710, textAlign: 'center' } as CSSProperties,
      wideCaption: { left: 60, right: 60, top: 1710, textAlign: 'center' } as CSSProperties,
      tsupher: { x: 940, y: 185, size: 170 },
      laptopTsupher: { x: 540, y: 1400, size: 300 },
      width,
      height,
    }
  }
  return {
    phone: [pose(0, 1420, 1750, 0.9, -20, 10), pose(10, 1420, 545, 1, -12, 4), pose(15.9, 1400, 545, 1, 9, 2), pose(25.3, 1400, 830, 1.55, -3, 1), pose(29.9, 1400, 545, 1, -8, 2), pose(32.7, 2800, 545, 0.9, -25, 0), pose(37.9, 1400, 560, 0.98, 10, 2), pose(45.3, 1400, 560, 0.98, -7, 2), pose(48, 1420, 545, 1, -10, 3), pose(55, 1420, 1800, 0.9, 0, 10)],
    laptop: [pose(0, 960, 1900, 1, -8, 8), pose(33, 960, 505, 1, -6, 5), pose(35.6, 960, 505, 1.03, 5, 4), pose(37.8, 960, -700, 0.9, 0, -8)],
    laptopWidth: 1180,
    title: { left: 120, top: 120 } as CSSProperties,
    panel: { left: 120, top: 235, width: 800 } as CSSProperties,
    proofPanel: { left: 120, top: 225, width: 860 } as CSSProperties,
    caption: { left: 120, top: 805, width: 880 } as CSSProperties,
    wideCaption: { left: 0, right: 0, top: 925, textAlign: 'center' } as CSSProperties,
    tsupher: { x: 1050, y: 690, size: 230 },
    laptopTsupher: { x: 1760, y: 930, size: 210 },
    width,
    height,
  }
}

const big: CSSProperties = { font: `700 112px/1 ${DISPLAY}`, fontVariantNumeric: 'tabular-nums' }
const small: CSSProperties = { font: `500 27px/1.3 ${BODY}`, color: C.muted }
const chip: CSSProperties = { display: 'inline-block', padding: '5px 16px', borderRadius: 99, background: C.warm, border: `2px solid ${C.terracotta}`, font: `600 24px ${BODY}` }

function Hook() {
  const { t, s, portrait, width, height } = useMotion()
  if (t > S.hook[1] + 0.6) return null
  const words = SCRIPT.hook.words.map((word, index) => (
    <span key={word} style={{ color: index === SCRIPT.hook.words.length - 1 ? C.amber : C.cream }}>
      {word}
    </span>
  ))
  const lines = portrait ? [words.slice(0, 2), words.slice(2)] : [words]
  const size = portrait ? 150 : 140
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height * (portrait ? 0.28 : 0.27), textAlign: 'center', font: `700 ${size}px/1.05 ${DISPLAY}` }}>
        {lines.map((line, row) => (
          <div key={row} style={{ display: 'flex', justifyContent: 'center', gap: size * 0.26 }}>
            <Reveal lines={line} from={0.45 + row * 0.5} to={4.6} gap={0.24} style={{ display: 'flex', gap: size * 0.26 }} />
          </div>
        ))}
        <div style={{ marginTop: 26, font: `500 ${size * 0.26}px ${BODY}`, color: C.warm, opacity: s(1.9) * (1 - s(4.6, 'snappy')) }}>{SCRIPT.hook.en}</div>
      </div>
      <Tsupher sprite="confused" from={2} to={4.6} x={width / 2} y={height * (portrait ? 0.67 : 0.76)} size={portrait ? 430 : 300} />
    </>
  )
}

function Logo() {
  const { t, s, inOut, portrait, width, height } = useMotion()
  const [from, to] = S.logo
  if (t < from - 0.2 || t > to + 0.6) return null
  const pop = inOut(from + 0.2, to - 0.3)
  const burst = s(from, 'smooth')
  const size = portrait ? 230 : 250
  const cx = portrait ? width / 2 : width * 0.37
  const cy = height * (portrait ? 0.3 : 0.4)
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: cx - 900,
          top: cy - 900,
          width: 1800,
          height: 1800,
          borderRadius: '50%',
          background: 'repeating-conic-gradient(rgb(252 184 64 / 0.16) 0deg 7deg, transparent 7deg 14deg)',
          maskImage: 'radial-gradient(circle, black 12%, transparent 62%)',
          transform: `scale(${mix(0.3, 1, burst)}) rotate(${mix(-30, 12, s(from, 'smooth') * 0.6 + s(from + 1.5, 'smooth') * 0.4)}deg)`,
          opacity: burst * (1 - s(to - 0.3, 'snappy')),
        }}
      />
      <div style={{ position: 'absolute', left: cx - 700, width: 1400, top: cy - size * 0.75, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.16, transform: `scale(${pop})` }}>
          <Img src={icon} style={{ width: size * 0.8, height: size * 0.8, borderRadius: size * 0.2, boxShadow: '0 18px 40px rgb(0 0 0 / 0.4)' }} />
          <span style={{ font: `700 ${size}px/1 ${DISPLAY}`, color: C.cream, letterSpacing: -4, textShadow: '0 8px 30px rgb(0 0 0 / 0.35)' }}>{SCRIPT.logo.name}</span>
        </div>
        <Reveal lines={[...SCRIPT.logo.tagline]} from={from + 1} to={to - 0.3} gap={0.3} style={{ marginTop: 36, font: `600 ${portrait ? 66 : 52}px/1.1 ${DISPLAY}`, color: C.amber, ...(portrait ? {} : { display: 'flex', justifyContent: 'center', gap: 22 }) }} />
        <div style={{ marginTop: 14, font: `500 30px ${BODY}`, color: C.warm, opacity: s(from + 2.2) * (1 - s(to - 0.3, 'snappy')) }}>{SCRIPT.logo.en}</div>
      </div>
      <Tsupher sprite="hero" from={from + 0.6} to={to - 0.3} x={portrait ? width / 2 : width * 0.85} y={height * (portrait ? 0.72 : 0.52)} size={portrait ? 560 : 400} />
    </>
  )
}

function Chips({ fares, from, to, simulated = false, chosen = -1 }: { fares: string[]; from: number; to: number; simulated?: boolean; chosen?: number }) {
  const { t, portrait } = useMotion()
  if (t < from - 0.1 || t > to + 0.6) return null
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: portrait ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
      {fares.map((amount, index) => (
        <Card key={index} from={from + index * 0.16} to={to} style={{ padding: '14px 24px', flex: portrait ? 1 : undefined, minWidth: portrait ? 0 : 660, outline: index === chosen ? `5px solid ${C.amber}` : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ ...chip, background: C.amber, borderColor: C.ink, fontSize: 19 }}>{SCRIPT.sample.chipTag}</span>
            {simulated && <span style={{ ...chip, fontSize: 19 }}>{SCRIPT.sample.simulated}</span>}
            {!portrait && <span style={{ font: `600 28px ${BODY}` }}>{optionLabels[index] ?? ''}</span>}
            <span style={{ marginLeft: portrait ? 0 : 'auto', font: `700 ${portrait ? 46 : 50}px ${DISPLAY}`, fontVariantNumeric: 'tabular-nums' }}>{amount}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}

function EndCard() {
  const { t, s, portrait, width, height } = useMotion()
  const from = S.end[0]
  if (t < from - 0.2) return null
  const e = SCRIPT.end
  const fade = (at: number) => ({ opacity: s(at, 'smooth'), transform: `translateY(${(1 - s(at, 'bouncy')) * 30}px)` })
  const fine: CSSProperties = { font: `500 ${portrait ? 26 : 27}px/1.4 ${BODY}`, color: C.warm, marginTop: 14 }
  return (
    <div style={{ position: 'absolute', left: portrait ? 60 : 200, right: portrait ? 60 : 200, top: height * (portrait ? 0.14 : 0.1), textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 26, transform: `scale(${s(from + 0.3, 'bouncy')})` }}>
        <Img src={icon} style={{ width: 130, height: 130, borderRadius: 32, boxShadow: '0 14px 30px rgb(0 0 0 / 0.4)' }} />
        <span style={{ font: `700 170px/1 ${DISPLAY}`, color: C.cream, letterSpacing: -3 }}>{e.name}</span>
      </div>
      <Reveal lines={[e.modelRan ? e.lineIfModelRan : e.line]} from={from + 0.8} to={999} style={{ marginTop: 18, font: `600 ${portrait ? 68 : 74}px/1.1 ${DISPLAY}`, color: C.amber }} />
      <div style={{ ...fine, fontSize: 30, ...fade(from + 1.1) }}>{e.en}</div>
      <div style={{ marginTop: portrait ? 60 : 44, font: `600 ${portrait ? 36 : 34}px/1.3 ${DISPLAY}`, color: C.cream, ...fade(from + 1.5) }}>
        {e.hackathon && <div>{e.hackathon}</div>}
        {e.team} · {e.members.join(' · ')}
      </div>
      <div style={{ ...fine, marginTop: portrait ? 50 : 36, ...fade(from + 1.9) }}>
        {e.models}
        <br />
        {e.modelsNote}
      </div>
      <div style={{ ...fine, ...fade(from + 2.2) }}>{about.facts.credit}</div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
        <Tsupher sprite="excited" from={from + 0.6} to={999} x={portrait ? width / 2 - 60 : -40} y={portrait ? height * 0.66 : height * 0.2} size={portrait ? 400 : 260} />
      </div>
    </div>
  )
}

export function ParaVideo() {
  const { t, s, portrait } = useMotion()
  const L = useLayout()
  const phone = usePose(L.phone)
  const laptop = usePose(L.laptop)
  const T = L.tsupher
  const sampleOn = t >= SAMPLE_ON_SCREEN[0] && t < SAMPLE_ON_SCREEN[1]
  const { fps } = useMotion()

  return (
    <AbsoluteFill style={{ fontFamily: BODY, color: C.cream, overflow: 'hidden' }}>
      <Backdrop shift={phone.x - L.width / 2} dark={1 - s(4.7, 'smooth') + s(S.proof[0], 'smooth') * 0.5 - s(S.end[0], 'smooth') * 0.5} />
      <Hook />
      <Logo />

      {t >= 9.8 && t < 56 && <Phone pose={phone} layers={PHONE_LAYERS} rings={RINGS} ribbon={sampleOn && SCRIPT.sample.tag} />}
      {t >= 32.6 && t < 38.6 && <Laptop pose={laptop} layers={[{ clip: dashboard, from: 32.6, to: 38.6, keys: KEYS.dashboard }]} width={L.laptopWidth} />}

      {/* 10-16 Home: the network is cut for real and the app's own pill flips. */}
      <Title text={SCRIPT.home.title} from={10.4} to={15.7} box={L.title} />
      <div style={{ position: 'absolute', ...L.panel, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Card from={12.7} to={15.7}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Airplane size={58} />
            <div>
              <div style={{ font: `600 40px ${DISPLAY}` }}>{SCRIPT.home.cut}</div>
              <div style={small}>
                {home.facts.pillBefore} → <b style={{ color: C.green }}>{home.facts.pillAfter}</b>
              </div>
            </div>
          </div>
        </Card>
        {!portrait && (
          <Card from={13.5} to={15.7} style={{ background: C.warm }}>
            <div style={{ font: `700 44px ${DISPLAY}` }}>{bannerTitle}</div>
            <div style={{ ...small, color: C.ink }}>{banner.slice(bannerTitle.length).trim()}</div>
          </Card>
        )}
      </div>
      <Caption tl={SCRIPT.home.caption} en={SCRIPT.home.en} from={12.8} to={15.7} box={L.caption} />
      <Tsupher sprite="hero" from={10.5} to={12.5} {...T} />
      <Tsupher sprite="thumbs-up" from={12.8} to={15.7} {...T} />

      {/* 16-25 Chat: a fare from the published matrix. Not a route. */}
      <Title text={SCRIPT.chat.title} from={16.2} to={24.8} box={L.title} />
      <div style={{ position: 'absolute', ...L.panel }}>
        <Card from={19.2} to={23.3}>
          <div style={small}>
            {fromName} → {toName}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
            <span style={big}>
              <CountUp target={promoFare} from={19.3} />
            </span>
            <span style={{ ...small, fontSize: 32 }}>
              {SCRIPT.chat.regular}: {regularFare}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
            <span style={chip}>{promoLabel}</span>
            <span style={small}>
              {SCRIPT.chat.asOf} {fareAsOf}
            </span>
          </div>
        </Card>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
          <Card from={23.7} to={24.8}>
            <div style={{ font: `600 ${portrait ? 34 : 38}px/1.25 ${DISPLAY}` }}>{chat.facts.crossAnswer}</div>
          </Card>
        </div>
      </div>
      <Caption tl={SCRIPT.chat.caption} en={SCRIPT.chat.en} from={19.5} to={23.3} box={L.caption} />
      <Caption tl={SCRIPT.chat.crossCaption} en={SCRIPT.chat.crossEn} from={23.75} to={24.8} box={L.caption} />
      <Tsupher sprite="happy" from={16.4} to={19} {...T} />
      <Tsupher sprite="thumbs-up" from={19.3} to={23.3} {...T} />
      <Tsupher sprite="confused" from={23.7} to={24.8} {...T} />

      {/* 25-33 Mapa: recorded as is. Two taps, a fare, no route drawn. */}
      <Title text={SCRIPT.mapa.title} from={25.2} to={32.6} box={L.title} />
      <div style={{ position: 'absolute', ...L.panel }}>
        {/* Portrait: the phone is large enough that the map's own credit line is readable. */}
        {!portrait && (
          <Card from={25.6} to={29.9} style={{ display: 'inline-block', padding: '12px 22px' }}>
            <span style={{ ...small, color: C.ink }}>{mapa.facts.credit.text}</span>
          </Card>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
          <Card from={30.2} to={32.6}>
            <div style={small}>
              {mapa.facts.origin} → {mapa.facts.destination}
            </div>
            <div style={big}>
              <CountUp target={mapFare} from={30.1} />
            </div>
            <div style={small}>{mapRow}</div>
            {!portrait && <div style={{ ...small, fontSize: 22, marginTop: 6 }}>{mapa.facts.credit.text}</div>}
          </Card>
        </div>
      </div>
      <Caption tl={SCRIPT.mapa.caption} en={SCRIPT.mapa.en} from={25.7} to={32.6} box={L.caption} />
      <Tsupher sprite="map" from={25.5} to={29.8} {...T} x={portrait ? T.x : 900} />
      <Tsupher sprite="excited" from={30.1} to={32.6} {...T} />

      {/* 33-38 Laptop dashboard. */}
      <Title text={SCRIPT.laptop.title} from={33.2} to={37.6} box={portrait ? L.title : { left: 0, right: 0, top: 18, textAlign: 'center' }} />
      <Caption tl={SCRIPT.laptop.caption} en={SCRIPT.laptop.en} from={33.5} to={37.6} box={L.wideCaption} />
      <Tsupher sprite="happy" from={33.6} to={37.6} {...L.laptopTsupher} />

      {/* 38-48 SAMPLE build: made-up places, tagged on every frame. */}
      <Title text={SCRIPT.sample.title} from={38.2} to={47.8} box={L.title} />
      <div style={{ position: 'absolute', ...L.panel, height: 300 }}>
        <Chips fares={optionFares} from={40.4} to={44.1} chosen={t > 43 ? 0 : -1} />
        <Chips fares={whatIfFares} from={44.4} to={45.3} simulated />
        <Card from={46.4} to={47.8} style={{ display: 'inline-block', padding: '12px 22px' }}>
          <span style={{ ...small, color: C.ink }}>{SCRIPT.sample.skipped}</span>
        </Card>
      </div>
      <Caption tl={SCRIPT.sample.caption} en={SCRIPT.sample.en} from={38.6} to={45.2} box={L.caption} />
      <Caption tl={SCRIPT.sample.gpsCaption} en={SCRIPT.sample.gpsEn} from={45.6} to={47.8} box={L.caption} />
      <Tsupher sprite="sign" from={38.5} to={45.2} {...T} />
      <Tsupher sprite="jumping" from={46.4} to={47.8} {...T} />

      {/* 48-55 Offline Mode: the app's own proof rows, as captured. */}
      <Title text={SCRIPT.proof.title} from={48.3} to={54.7} box={L.title} />
      <div style={{ position: 'absolute', ...L.proofPanel, display: 'grid', gridTemplateColumns: portrait ? '1fr 1fr' : '1fr', gap: 14 }}>
        {proofRows.map((row, index) => (
          <Card key={row.id} from={49 + index * 0.3} to={54.7} style={{ padding: '14px 22px' }}>
            <div style={{ font: `600 ${portrait ? 24 : 28}px/1.2 ${BODY}` }}>
              {row.ok === 'true' ? '✓ ' : ''}
              {row.label}
            </div>
            <div style={{ ...small, fontSize: portrait ? 22 : 25, fontVariantNumeric: 'tabular-nums' }}>{row.value}</div>
          </Card>
        ))}
        <Card from={49.9} to={54.7} style={{ padding: '14px 22px', background: C.warm }}>
          <div style={{ font: `600 ${portrait ? 24 : 28}px/1.2 ${BODY}`, fontVariantNumeric: 'tabular-nums' }}>{offline.facts.bytesSent}</div>
        </Card>
      </div>
      <Caption tl={SCRIPT.proof.caption} en={SCRIPT.proof.en} from={50.3} to={54.7} box={L.caption} />
      {!portrait && <Tsupher sprite="thumbs-up" from={50.5} to={54.7} {...T} y={T.y + 60} />}

      <EndCard />

      {SOUNDS.map(([at, src, volume]) => (
        <Sequence key={`${src}-${at}`} from={Math.round(at * fps)} layout="none">
          <Audio src={src} volume={volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
