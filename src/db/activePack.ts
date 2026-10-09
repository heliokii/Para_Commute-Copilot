import { SYNTHETIC_PACK } from '../router/__fixtures__/synthetic-pack.ts'
import type { RoutePack } from '../router/types.ts'
// Written by "npm run import:ncr". Empty until real data passes validation.
import generated from './generated/metro-manila-pack.json' with { type: 'json' }

/** The real pack once it has landmarks and fares (routes may still be empty), otherwise the synthetic sample pack. */
export function pickActivePack(real: RoutePack, synthetic: RoutePack): RoutePack {
  return real.landmarks.length > 0 && real.fares.length > 0 ? real : synthetic
}

// `vite build --mode sample` (npm run build:sample) forces the sample pack so the route-flow
// end-to-end test has routes to plan. Normal builds never set this.
const FORCE_SAMPLE = import.meta.env?.VITE_SAMPLE_PACK === '1'

export const ACTIVE_PACK = FORCE_SAMPLE ? SYNTHETIC_PACK : pickActivePack(generated as unknown as RoutePack, SYNTHETIC_PACK)
