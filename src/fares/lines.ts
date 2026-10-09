import type { Landmark } from '../router/types.ts'

// The rail pack names stations rail-<line>-<station> (scripts/rail-fares-to-csv.mjs).

export type RailLine = 'lrt1' | 'lrt2' | 'mrt3'

export const RAIL_LINES: { id: RailLine; label: string; color: string }[] = [
  { id: 'lrt1', label: 'LRT-1', color: '#2E8B3E' },
  { id: 'lrt2', label: 'LRT-2', color: '#7A3E9D' },
  { id: 'mrt3', label: 'MRT-3', color: '#1F5FB4' },
]

export function railLineOf(landmarkId: string): RailLine | null {
  const match = /^rail-(lrt1|lrt2|mrt3)-/.exec(landmarkId)
  return (match?.[1] as RailLine | undefined) ?? null
}

export const railColor = (landmarkId: string) =>
  RAIL_LINES.find((line) => line.id === railLineOf(landmarkId))?.color ?? '#5A4A44'

/** Stations of each line that are in the pack, in the pack's (riding) order. */
export function stationsByLine(landmarks: Landmark[]): Record<RailLine, Landmark[]> {
  const out: Record<RailLine, Landmark[]> = { lrt1: [], lrt2: [], mrt3: [] }
  for (const landmark of landmarks) {
    const line = railLineOf(landmark.id)
    if (line) out[line].push(landmark)
  }
  return out
}
