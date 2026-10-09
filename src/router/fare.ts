import type { FareEligibility, FareEntry, FarePromotion, FareRule, RoundingRule } from './types.ts'

function roundCentavos(centavos: number, rule: RoundingRule | undefined): number {
  switch (rule) {
    case 'none':
      return centavos
    case 'nearest_1':
      return Math.round(centavos / 100) * 100
    case 'ceil_1':
      return Math.ceil(centavos / 100) * 100
    case 'nearest_0.25':
    default:
      return Math.round(centavos / 25) * 25
  }
}

function manilaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

function inWindow(effectiveDate: string, expiresAt: string | undefined, asOf: string) {
  return effectiveDate <= asOf && (!expiresAt || asOf <= expiresAt)
}

function ruleFareCentavos(
  boardId: string,
  alightId: string,
  distKm: number,
  rule: FareRule,
): number | null {
  if (rule.kind === 'matrix') {
    const pesos = rule.byOriginDestination[boardId]?.[alightId]
    return Number.isFinite(pesos) && pesos >= 0 ? Math.round(pesos * 100) : null
  }
  if (![rule.baseFare, rule.baseKm, rule.perKm, distKm].every(Number.isFinite)) return null
  const pesos = rule.baseFare + Math.max(0, distKm - rule.baseKm) * rule.perKm
  if (pesos < 0) return null
  return roundCentavos(Math.round(pesos * 100), rule.roundingRule)
}

function promotionFareCentavos(
  boardId: string,
  alightId: string,
  distKm: number,
  promotion: FarePromotion,
  scheduledCentavos: number,
): number | null {
  if (promotion.rule.kind === 'matrix') {
    return ruleFareCentavos(boardId, alightId, distKm, promotion.rule)
  }
  const { percent } = promotion.rule
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null
  return Math.round((scheduledCentavos * (100 - percent)) / 100)
}

export interface FareCalculation {
  centavos: number
  scheduledCentavos: number
  effectiveDate: string
  promotion?: FarePromotion
}

/** Resolve a scheduled or promotional price; missing matrix pairs are unknown, never estimated. */
export function fareForLeg(
  boardId: string,
  alightId: string,
  distKm: number,
  fare: FareEntry,
  asOf = manilaDate(),
  eligibility: FareEligibility = 'adult',
): FareCalculation | null {
  if (!inWindow(fare.effectiveDate, fare.expiresAt, asOf)) return null
  const scheduledCentavos = ruleFareCentavos(boardId, alightId, distKm, fare.rule)
  if (scheduledCentavos === null) return null

  let best: FareCalculation = {
    centavos: scheduledCentavos,
    scheduledCentavos,
    effectiveDate: fare.effectiveDate,
  }
  for (const promotion of fare.promotions ?? []) {
    if (promotion.eligibility !== 'all' && promotion.eligibility !== eligibility) continue
    if (!inWindow(promotion.effectiveDate, promotion.expiresAt, asOf)) continue
    const centavos = promotionFareCentavos(boardId, alightId, distKm, promotion, scheduledCentavos)
    if (centavos === null && promotion.rule.kind === 'matrix') return null
    if (centavos !== null && centavos < best.centavos) {
      best = { centavos, scheduledCentavos, effectiveDate: promotion.effectiveDate, promotion }
    }
  }
  return best
}

/** Leg fare in centavos. Returns null when the fare is out of date or absent. */
export function fareForLegCentavos(
  boardId: string,
  alightId: string,
  distKm: number,
  fare: FareEntry,
  asOf?: string,
  eligibility?: FareEligibility,
): number | null {
  return fareForLeg(boardId, alightId, distKm, fare, asOf, eligibility)?.centavos ?? null
}

export function legFare(distKm: number, fare: FareEntry): number | null {
  const centavos = fareForLegCentavos('', '', distKm, fare)
  return centavos === null ? null : centavos / 100
}

export interface DistanceFareBreakdown {
  kind: 'distance'
  baseFare: number
  baseKm: number
  extraKm: number
  perKm: number
  extraFare: number
  unrounded: number
  total: number
  scheduledTotal: number
  effectiveDate: string
  promotion?: FarePromotion
}

export interface MatrixFareBreakdown {
  kind: 'matrix'
  boardId: string
  alightId: string
  total: number
  scheduledTotal: number
  effectiveDate: string
  promotion?: FarePromotion
}

export type FareBreakdown = DistanceFareBreakdown | MatrixFareBreakdown

/** Parts of a formula fare or exact OD fare for displaying the calculation. */
export function fareBreakdown(
  boardId: string,
  alightId: string,
  distKm: number,
  fare: FareEntry,
  asOf?: string,
  eligibility?: FareEligibility,
): FareBreakdown | null {
  const calculation = fareForLeg(boardId, alightId, distKm, fare, asOf, eligibility)
  if (!calculation) return null
  if (fare.rule.kind === 'matrix') {
    return {
      kind: 'matrix', boardId, alightId,
      total: calculation.centavos / 100,
      scheduledTotal: calculation.scheduledCentavos / 100,
      effectiveDate: calculation.effectiveDate,
      ...(calculation.promotion ? { promotion: calculation.promotion } : {}),
    }
  }
  const { baseFare, baseKm, perKm } = fare.rule
  const extraKm = Math.round(Math.max(0, distKm - baseKm) * 1000) / 1000
  const extraFare = Math.round(extraKm * perKm * 100) / 100
  return {
    kind: 'distance',
    baseFare,
    baseKm,
    extraKm,
    perKm,
    extraFare,
    unrounded: Math.round((baseFare + extraFare) * 100) / 100,
    total: calculation.centavos / 100,
    scheduledTotal: calculation.scheduledCentavos / 100,
    effectiveDate: calculation.effectiveDate,
    ...(calculation.promotion ? { promotion: calculation.promotion } : {}),
  }
}
