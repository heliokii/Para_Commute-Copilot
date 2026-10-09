import type { RouterConfig } from './types.ts'

// Assumptions, not measured data. Tune once the team has ride-verified timings.
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  walkMaxMeters: 300,
  walkSpeedKmh: 4.5,
  transferPenaltyMin: 5,
}
