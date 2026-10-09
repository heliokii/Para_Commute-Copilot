import { copy } from '../copy'

export function peso(amount: number): string {
  return `₱${amount.toFixed(2)}`
}

export function duration(minutes: number): string {
  const whole = Math.round(minutes)
  if (whole < 60) return `${whole} ${copy.units.min}`
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  return rest === 0
    ? `${hours} ${copy.units.hour}`
    : `${hours} ${copy.units.hour} ${rest} ${copy.units.min}`
}

export function km(distance: number): string {
  return `${Number(distance.toFixed(2))} ${copy.units.km}`
}
