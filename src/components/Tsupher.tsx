import { copy } from '../copy'

// App state to sprite, per BUILD_PHASES.md section 2.6.
export type TsupherState =
  | 'hero'
  | 'happy'
  | 'thinking'
  | 'map'
  | 'thumbs-up'
  | 'confused'
  | 'sad'
  | 'sign'
  | 'driving'
  | 'luggage'
  | 'jumping'
  | 'love'
  | 'excited'

// Pixel sizes on purpose: pictures should not grow when the rider scales text up.
const SIZES = {
  sm: 'size-[48px]',
  md: 'size-[80px]',
  lg: 'size-[128px]',
  xl: 'size-[224px]',
} as const

interface TsupherProps {
  state: TsupherState
  size?: keyof typeof SIZES
  /** Above-the-fold sprites load eagerly; everything else is lazy. */
  eager?: boolean
  /** Set when the sprite only repeats nearby text. */
  decorative?: boolean
  bob?: boolean
  className?: string
}

export function Tsupher({
  state,
  size = 'md',
  eager = false,
  decorative = false,
  bob = false,
  className = '',
}: TsupherProps) {
  return (
    <img
      src={`/mascot/tsupher-${state}.webp`}
      alt={decorative ? '' : copy.tsupher[state]}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`${SIZES[size]} shrink-0 object-contain select-none ${bob ? 'animate-bob motion-reduce:animate-none' : ''} ${className}`}
    />
  )
}
