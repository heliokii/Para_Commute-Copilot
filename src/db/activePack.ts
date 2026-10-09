import { SYNTHETIC_PACK } from '../router/__fixtures__/synthetic-pack.ts'
import type { RoutePack } from '../router/types.ts'
// Written by "npm run import:ncr". Empty until real routes pass validation.
import generated from './generated/metro-manila-pack.json' with { type: 'json' }

/** The real pack once it has routes, otherwise the synthetic sample pack. */
export function pickActivePack(real: RoutePack, synthetic: RoutePack): RoutePack {
  return real.routes.length > 0 ? real : synthetic
}

export const ACTIVE_PACK = pickActivePack(generated as unknown as RoutePack, SYNTHETIC_PACK)
