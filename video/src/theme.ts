import { continueRender, delayRender } from 'remotion'
import fredokaExt from '../../node_modules/@fontsource-variable/fredoka/files/fredoka-latin-ext-wght-normal.woff2'
import fredoka from '../../node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2'
import interExt from '../../node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2'
import inter from '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'
import confused from '../../public/mascot/tsupher-confused.webp'
import excited from '../../public/mascot/tsupher-excited.webp'
import happy from '../../public/mascot/tsupher-happy.webp'
import hero from '../../public/mascot/tsupher-hero.webp'
import jumping from '../../public/mascot/tsupher-jumping.webp'
import map from '../../public/mascot/tsupher-map.webp'
import sign from '../../public/mascot/tsupher-sign.webp'
import thumbsUp from '../../public/mascot/tsupher-thumbs-up.webp'
import type { ClipMeta, Keys } from './clips'

// Values from src/styles/tokens.css (generated from the design reference). Keep in step with it.
export const C = {
  deep: '#4F2A14',
  deeper: '#40200D',
  gradientTop: '#85491F',
  glow: '#995726',
  cream: '#FAF4ED',
  warm: '#FBE7BB',
  amber: '#FCB840',
  terracotta: '#B66E45',
  brownMid: '#653315',
  green: '#28763A',
  ink: '#260D09',
  muted: '#76655F',
} as const
export const DISPLAY = "'Fredoka Variable', sans-serif"
export const BODY = "'Inter Variable', sans-serif"

// The app's own self-hosted fonts (SIL OFL). The latin-ext files carry the peso sign.
const LATIN = 'U+0000-00FF, U+2000-206F, U+2190-21FF'
const LATIN_EXT = 'U+0100-02FF, U+20A0-20C0'
const fonts = delayRender('fonts')
Promise.all(
  [
    new FontFace('Fredoka Variable', `url(${fredoka})`, { weight: '300 700', unicodeRange: LATIN }),
    new FontFace('Fredoka Variable', `url(${fredokaExt})`, { weight: '300 700', unicodeRange: LATIN_EXT }),
    new FontFace('Inter Variable', `url(${inter})`, { weight: '100 900', unicodeRange: LATIN }),
    new FontFace('Inter Variable', `url(${interExt})`, { weight: '100 900', unicodeRange: LATIN_EXT }),
  ].map((face) => face.load()),
).then((faces) => {
  for (const face of faces) document.fonts.add(face)
  continueRender(fonts)
})

/** Only sprites that exist in public/mascot/. There is no blink sprite, so Tsupher never blinks. */
export const SPRITES = { hero, confused, 'thumbs-up': thumbsUp, happy, map, jumping, excited, sign }
export type Sprite = keyof typeof SPRITES

export interface Pose {
  at: number
  x: number
  y: number
  scale: number
  rotX: number
  rotY: number
}

export interface Layer {
  clip: ClipMeta
  from: number
  to: number
  keys: Keys
}
export interface Ring {
  at: number
  until: number
  x: number
  y: number
}
