import type { IconName } from '../components/Icon'
import { copy } from '../copy'
import type { Mode } from '../router/types.ts'

interface ModeMeta {
  label: string
  icon: IconName
  /** Line colour on the map and timeline. Chosen to read on cream. */
  color: string
}

export const MODES: Record<Mode, ModeMeta> = {
  jeepney: { label: copy.mode.jeepney, icon: 'bus', color: '#C2620A' },
  modern_jeepney: { label: copy.mode.modern_jeepney, icon: 'bus', color: '#A63D2F' },
  uv: { label: copy.mode.uv, icon: 'bus', color: '#6D4AA8' },
  bus: { label: copy.mode.bus, icon: 'bus', color: '#1F66A8' },
  train: { label: copy.mode.train, icon: 'train', color: '#1F7A4D' },
  walk: { label: copy.mode.walk, icon: 'walk', color: '#76655F' },
}

/** Made-up routes from data/metro-manila/mock-pack. Anything that uses one is badged "MOCK DATA". */
export const isMockRoute = (routeId: string) => routeId.startsWith('mock-')

/** Legend order from the showcase, plus walking. */
export const LEGEND_MODES: Mode[] = ['jeepney', 'uv', 'bus', 'train', 'walk']
