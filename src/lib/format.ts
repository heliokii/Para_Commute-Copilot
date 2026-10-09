import { copy } from '../copy'
import { getSettings } from '../state/settings'

export function peso(amount: number): string {
  return `₱${amount.toFixed(2)}`
}

/** Minutes, or hours and minutes from 60 up, as the Oras setting says. */
export function duration(minutes: number): string {
  const whole = Math.round(minutes)
  if (whole < 60 || getSettings().timeStyle === 'min') return `${whole} ${copy.units.min}`
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  return rest === 0
    ? `${hours} ${copy.units.hour}`
    : `${hours} ${copy.units.hour} ${rest} ${copy.units.min}`
}

export const KM_PER_MILE = 1.609344

/** Distance in the unit the Distansya setting says. The input is always kilometres. */
export function km(distance: number): string {
  if (getSettings().distanceUnit === 'mi') return `${Number((distance / KM_PER_MILE).toFixed(2))} ${copy.units.mi}`
  return `${Number(distance.toFixed(2))} ${copy.units.km}`
}

export function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}
