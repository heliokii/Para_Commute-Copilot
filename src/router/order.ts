import type { RouteResult } from './types.ts'

export const legSequenceKey = (result: RouteResult) =>
  result.legs.map((leg) => `${leg.routeId}:${leg.boardId}>${leg.alightId}`).join('|')

/**
 * Puts the option that answers the rider's own preference first.
 * `options` comes from planOptions, `chosen` from planRoute for the same intent.
 * Returns the reordered list and the index of the chosen option (-1 if absent).
 */
export function orderOptions(
  options: RouteResult[],
  chosen: RouteResult,
): { options: RouteResult[]; chosenIndex: number } {
  const chosenKey = chosen.status === 'ok' ? legSequenceKey(chosen) : null
  const index = options.findIndex(
    (option) => option.status === 'ok' && legSequenceKey(option) === chosenKey,
  )
  if (index < 0) return { options, chosenIndex: -1 }
  return {
    options: index > 0 ? [options[index], ...options.filter((_, i) => i !== index)] : options,
    chosenIndex: 0,
  }
}
