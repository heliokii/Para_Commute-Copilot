import { fareForLeg, type FareCalculation } from '../router/fare.ts'
import type { FareEligibility, FareEntry, RoutePack } from '../router/types.ts'

// Station-to-station fares from the pack's exact matrices (rail). No routing,
// no travel time, no estimate: a pair with no matrix entry has no answer.

export interface StationFare {
  fare: FareEntry
  calc: FareCalculation
}

/** One row per fare product that has a published price for this exact pair, in this direction. */
export function lookupStationFares(
  pack: RoutePack,
  originId: string,
  destinationId: string,
  eligibility?: FareEligibility,
  asOf?: string,
): StationFare[] {
  if (!originId || !destinationId || originId === destinationId) return []
  const rows: StationFare[] = []
  for (const fare of pack.fares) {
    if (fare.rule.kind !== 'matrix') continue
    const calc = fareForLeg(originId, destinationId, 0, fare, asOf, eligibility)
    if (calc) rows.push({ fare, calc })
  }
  return rows
}

/** Landmarks that appear in at least one matrix fare: the places a fare can be looked up for. */
export function fareStations(pack: RoutePack) {
  const ids = new Set<string>()
  for (const fare of pack.fares) {
    if (fare.rule.kind !== 'matrix') continue
    for (const origin of Object.keys(fare.rule.byOriginDestination)) ids.add(origin)
  }
  return pack.landmarks.filter((landmark) => ids.has(landmark.id))
}

const peso = (amount: number) => `₱${amount.toFixed(2)}`

const PRODUCT_LABEL: Record<string, string> = {
  'single-journey': 'Single journey',
  'stored-value': 'Stored value',
  'regular-posted-matrix': 'Regular',
}

export const productLabel = (fare: FareEntry) => PRODUCT_LABEL[fare.product] ?? fare.product

/** One line per product, built only from the fare calculation. */
export function describeStationFares(rows: StationFare[], fromName: string, toName: string): string[] {
  if (rows.length === 0) return [`Walang nakalistang pamasahe mula ${fromName} papuntang ${toName} sa data.`]
  const lines = rows.map(({ fare, calc }) => {
    const base = `${productLabel(fare)}: ${peso(calc.scheduledCentavos / 100)}`
    return calc.promotion
      ? `${base}. May ${calc.promotion.label} ngayon: ${peso(calc.centavos / 100)} (as of ${calc.effectiveDate}).`
      : `${base} (as of ${calc.effectiveDate}).`
  })
  return [`Pamasahe, ${fromName} → ${toName}:`, ...lines, 'Walang oras o ruta na data pa, pamasahe lang.']
}
