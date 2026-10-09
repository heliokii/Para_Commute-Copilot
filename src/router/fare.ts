import type { FareEntry, RoundingRule } from './types.ts'

function roundCentavos(centavos: number, rule: RoundingRule | undefined): number {
  switch (rule) {
    case 'none':
      return centavos
    case 'nearest_1':
      return Math.round(centavos / 100) * 100
    case 'ceil_1':
      return Math.ceil(centavos / 100) * 100
    // Default: nearest 0.25 peso.
    case 'nearest_0.25':
    default:
      return Math.round(centavos / 25) * 25
  }
}

/**
 * Leg fare in centavos: baseFare + max(0, distKm - baseKm) * perKm, then the
 * entry's roundingRule. Every number comes from the FareEntry.
 */
export function legFareCentavos(distKm: number, fare: FareEntry): number {
  const pesos = fare.baseFare + Math.max(0, distKm - fare.baseKm) * fare.perKm
  // Snap to whole centavos first so float drift cannot flip a rounding step.
  return roundCentavos(Math.round(pesos * 100), fare.roundingRule)
}

export function legFare(distKm: number, fare: FareEntry): number {
  return legFareCentavos(distKm, fare) / 100
}

export interface FareBreakdown {
  baseFare: number
  baseKm: number
  /** Distance charged per km, beyond baseKm. */
  extraKm: number
  perKm: number
  extraFare: number
  /** Before the rounding rule. */
  unrounded: number
  total: number
}

/** The parts of legFare, for showing the working on screen. */
export function fareBreakdown(distKm: number, fare: FareEntry): FareBreakdown {
  const extraKm = Math.round(Math.max(0, distKm - fare.baseKm) * 1000) / 1000
  const extraFare = Math.round(extraKm * fare.perKm * 100) / 100
  return {
    baseFare: fare.baseFare,
    baseKm: fare.baseKm,
    extraKm,
    perKm: fare.perKm,
    extraFare,
    unrounded: Math.round((fare.baseFare + extraFare) * 100) / 100,
    total: legFare(distKm, fare),
  }
}
