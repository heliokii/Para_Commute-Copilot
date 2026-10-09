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
