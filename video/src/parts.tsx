import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Img } from 'remotion'
import { captureTime } from './clips'
import { Footage } from './footage'
import { mix, useMotion } from './springs'
import { BODY, C, DISPLAY, type Layer, type Pose, type Ring, SPRITES, type Sprite } from './theme'

/** Deep-brown gradient with the app's faint sunburst and a generic city silhouette. */
export function Backdrop({ shift = 0, dark = 0 }: { shift?: number; dark?: number }) {
  const { width, height, s } = useMotion()
  // Made-up skyline, like the app's landing screen: not a real place.
  const blocks = [5, 9, 6, 12, 8, 15, 7, 10, 13, 6, 9, 16, 8, 11, 7, 14, 9, 6, 12, 8, 10, 15, 7, 9]
  const unit = width / (blocks.length * 0.9)
  const rise = s(0.2, 'smooth')
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.gradientTop}, ${C.deep} 55%, ${C.deeper})` }}>
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${shift * 0.01}deg at ${78 - shift * 0.004}% -8%, rgb(255 255 255 / 0.04) 0deg 6deg, transparent 6deg 12deg), radial-gradient(110% 70% at ${78 - shift * 0.004}% -8%, ${C.glow}, transparent 62%)`,
        }}
      />
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.11 * rise }}>
        {blocks.map((tall, index) => (
          <rect key={index} x={index * unit * 0.95 - unit * 0.6 - shift * 0.03} y={height - tall * unit * 0.16 * rise} width={unit * 0.8} height={tall * unit * 0.16} rx={unit * 0.06} fill={C.cream} />
        ))}
      </svg>
      <AbsoluteFill style={{ background: C.deeper, opacity: dark * 0.75 }} />
    </AbsoluteFill>
  )
}

/** Recorded clips stacked on one screen; each fades in over the one before. */
function Screen({ layers, rings = [] }: { layers: Layer[]; rings?: Ring[] }) {
  const { t, s, inOut } = useMotion()
  return (
    <>
      {layers
        .filter((layer) => t >= layer.from && t < layer.to)
        .map((layer, index) => (
          <div key={`${layer.clip.name}-${layer.from}`} style={{ position: 'absolute', inset: 0, opacity: index === 0 ? 1 : s(layer.from, 'snappy') }}>
            <Footage clip={layer.clip} at={captureTime(t, layer.keys)} />
          </div>
        ))}
      {rings.map((ring) => {
        const grow = s(ring.at, 'smooth')
        return (
          <div
            key={ring.at}
            style={{
              position: 'absolute',
              left: ring.x,
              top: ring.y,
              width: 26,
              height: 26,
              margin: -13,
              borderRadius: 99,
              border: `3px solid ${C.amber}`,
              boxShadow: `0 0 0 1.5px ${C.ink}`,
              transform: `scale(${mix(0.4, 2.1, grow)})`,
              opacity: inOut(ring.at, ring.until, 'snappy'),
            }}
          />
        )
      })}
    </>
  )
}

/** A plain phone: no notch, no logo, no brand. */
export function Phone({ pose, layers, rings, ribbon }: { pose: Pose; layers: Layer[]; rings?: Ring[]; ribbon?: string | false }) {
  return (
    <div style={{ position: 'absolute', left: pose.x, top: pose.y, width: 0, height: 0, perspective: 2200 }}>
      <div
        style={{
          position: 'absolute',
          width: 414,
          height: 868,
          margin: '-434px 0 0 -207px',
          padding: 12,
          boxSizing: 'border-box',
          borderRadius: 58,
          background: 'linear-gradient(145deg, #3a2318, #140a06)',
          boxShadow: '0 50px 90px rgb(0 0 0 / 0.45), 0 12px 24px rgb(0 0 0 / 0.3), inset 0 0 0 1.5px rgb(255 255 255 / 0.12)',
          transform: `scale(${pose.scale}) rotateY(${pose.rotY}deg) rotateX(${pose.rotX}deg)`,
        }}
      >
        <div style={{ position: 'relative', width: 390, height: 844, borderRadius: 46, overflow: 'hidden', background: C.deep }}>
          <Screen layers={layers} rings={rings} />
        </div>
        {ribbon && <Ribbon text={ribbon} />}
      </div>
    </div>
  )
}

/** The mandatory label on every frame of SAMPLE footage; it rides on the device. */
function Ribbon({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: -78,
        right: -78,
        top: -30,
        padding: '10px 8px',
        borderRadius: 12,
        background: `repeating-linear-gradient(-45deg, ${C.amber} 0 14px, #f3a81f 14px 28px)`,
        border: `2.5px solid ${C.ink}`,
        color: C.ink,
        font: `700 24px ${DISPLAY}`,
        letterSpacing: 0.2,
        textAlign: 'center',
        boxShadow: '0 8px 18px rgb(0 0 0 / 0.35)',
      }}
    >
      {text}
    </div>
  )
}

/** A plain laptop for the 1440x900 dashboard clip. */
export function Laptop({ pose, layers, width }: { pose: Pose; layers: Layer[]; width: number }) {
  const k = (width / 1440) * pose.scale
  return (
    <div style={{ position: 'absolute', left: pose.x, top: pose.y, width: 0, height: 0, perspective: 2600 }}>
      <div style={{ position: 'absolute', width: 1476, margin: '-480px 0 0 -738px', transform: `scale(${k}) rotateY(${pose.rotY}deg) rotateX(${pose.rotX}deg)` }}>
        <div style={{ padding: 18, borderRadius: 30, background: 'linear-gradient(145deg, #3a2318, #140a06)', boxShadow: '0 60px 110px rgb(0 0 0 / 0.45), inset 0 0 0 2px rgb(255 255 255 / 0.12)' }}>
          <div style={{ position: 'relative', width: 1440, height: 900, borderRadius: 14, overflow: 'hidden', background: C.deep }}>
            <Screen layers={layers} />
          </div>
        </div>
        <div style={{ height: 26, margin: '0 -90px', borderRadius: '6px 6px 26px 26px', background: 'linear-gradient(180deg, #4a3024, #1c0f0a)', boxShadow: '0 30px 40px rgb(0 0 0 / 0.35)' }} />
      </div>
    </div>
  )
}

/** Tsupher pops in, bobs, and pops out. One sprite per appearance. */
export function Tsupher({ sprite, from, to, x, y, size, flip = false }: { sprite: Sprite; from: number; to: number; x: number; y: number; size: number; flip?: boolean }) {
  const { t, inOut } = useMotion()
  if (t < from || t > to + 0.6) return null
  const pop = inOut(from, to)
  const bob = Math.sin((t - from) * 4.4) * size * 0.022
  return (
    <Img
      src={SPRITES[sprite]}
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2 + bob + (1 - pop) * size * 0.3,
        width: size,
        height: size,
        objectFit: 'contain',
        transform: `scale(${pop * (flip ? -1 : 1)}, ${pop}) rotate(${Math.sin((t - from) * 2.2) * 2}deg)`,
        filter: 'drop-shadow(0 18px 22px rgb(0 0 0 / 0.35))',
      }}
    />
  )
}

/** Lines slide up from behind a mask, one after another. */
export function Reveal({ lines, from, to, gap = 0.12, style }: { lines: ReactNode[]; from: number; to: number; gap?: number; style?: CSSProperties }) {
  const { s } = useMotion()
  const out = s(to, 'snappy')
  return (
    <div style={style}>
      {lines.map((line, index) => (
        <div key={index} style={{ overflow: 'hidden', padding: '0.12em 0.05em 0.14em' }}>
          <div style={{ transform: `translateY(${(1 - s(from + index * gap, 'bouncy')) * 115 - out * 115}%)` }}>{line}</div>
        </div>
      ))}
    </div>
  )
}

/** Burned-in caption: Taglish line, smaller English line under it. */
export function Caption({ tl, en, from, to, box }: { tl: string; en: string; from: number; to: number; box: CSSProperties }) {
  const { t, s, portrait } = useMotion()
  if (t < from - 0.1 || t > to + 0.6) return null
  const size = portrait ? 52 : 50
  return (
    <div style={{ position: 'absolute', ...box }}>
      <Reveal lines={[tl]} from={from} to={to} style={{ font: `600 ${size}px/1.12 ${DISPLAY}`, color: C.cream, textShadow: '0 3px 14px rgb(0 0 0 / 0.45)' }} />
      <div style={{ marginTop: 6, font: `500 ${size * 0.54}px/1.25 ${BODY}`, color: C.warm, opacity: s(from + 0.25, 'smooth') * (1 - s(to, 'snappy')), textShadow: '0 2px 10px rgb(0 0 0 / 0.5)' }}>{en}</div>
    </div>
  )
}

/** Small amber label naming the scene. */
export function Title({ text, from, to, box }: { text: string; from: number; to: number; box: CSSProperties }) {
  const { t, inOut, portrait } = useMotion()
  if (t < from - 0.1 || t > to + 0.6) return null
  const pop = inOut(from, to)
  return (
    <div style={{ position: 'absolute', ...box }}>
      <span style={{ display: 'inline-block', padding: '10px 26px', borderRadius: 99, background: C.amber, color: C.ink, font: `600 ${portrait ? 36 : 34}px ${DISPLAY}`, transform: `scale(${pop})`, opacity: Math.min(1, pop * 2), boxShadow: '0 10px 22px rgb(0 0 0 / 0.3)' }}>{text}</span>
    </div>
  )
}

/** Cream card that springs in with a slight overshoot. */
export function Card({ from, to, children, style }: { from: number; to: number; children: ReactNode; style?: CSSProperties }) {
  const { t, inOut } = useMotion()
  if (t < from - 0.1 || t > to + 0.6) return null
  const pop = inOut(from, to)
  return (
    <div style={{ background: C.cream, color: C.ink, borderRadius: 28, padding: '22px 28px', boxShadow: '0 18px 40px rgb(0 0 0 / 0.3)', transform: `translateY(${(1 - pop) * 60}px) scale(${mix(0.86, 1, pop)})`, opacity: Math.min(1, pop * 1.6), ...style }}>
      {children}
    </div>
  )
}

/** Counts up to a captured peso amount and always lands on the captured text itself. */
export function CountUp({ target, from }: { target: string; from: number }) {
  const { s } = useMotion()
  const value = Number(target.replace(/[^\d.]/g, ''))
  const p = s(from, 'smooth')
  return <>{p > 0.985 ? target : `₱${(value * Math.min(1, p)).toFixed(2)}`}</>
}

/** A flat airplane glyph, drawn here. It is a graphic beside the phone, not phone system UI. */
export function Airplane({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M21.5 2.5 2 10.2l7.3 2.6 2.6 7.3z" fill={C.ink} />
      <path d="m9.3 12.8 6-4.6" stroke={C.amber} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
