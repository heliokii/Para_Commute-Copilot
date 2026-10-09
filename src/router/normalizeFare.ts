import type { FareEntry, Mode, RoundingRule } from './types.ts'

const MODES = new Set<Mode>(['jeepney', 'modern_jeepney', 'uv', 'bus', 'train', 'walk'])
const ROUNDING = new Set<RoundingRule>(['nearest_0.25', 'nearest_1', 'ceil_1', 'none'])

/** Converts pre-v2 flat fare rows; malformed legacy rows are ignored. */
export function normalizeFare(row: unknown): FareEntry | null {
  if (!row || typeof row !== 'object') return null
  const fare = row as Record<string, unknown>
  if (fare.rule && typeof fare.rule === 'object') {
    const current = { ...fare }
    delete current.packId
    return current as unknown as FareEntry
  }
  const { id, mode, baseFare, baseKm, perKm, effectiveDate, roundingRule, sourceNote } = fare
  if (
    typeof id !== 'string' || !MODES.has(mode as Mode) ||
    ![baseFare, baseKm, perKm].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0) ||
    typeof effectiveDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
    !ROUNDING.has(roundingRule as RoundingRule) || typeof sourceNote !== 'string'
  ) return null
  return {
    id, mode: mode as Mode, product: 'legacy', vehicleClass: 'unspecified',
    rule: { kind: 'distance', baseFare: baseFare as number, baseKm: baseKm as number, perKm: perKm as number, roundingRule: roundingRule as RoundingRule },
    effectiveDate, sourceNote,
  }
}
