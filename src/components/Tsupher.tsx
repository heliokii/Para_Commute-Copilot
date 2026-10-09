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

const SIZES = {
  sm: 'size-12',
  md: 'size-20',
  lg: 'size-32',
  xl: 'size-56',
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
