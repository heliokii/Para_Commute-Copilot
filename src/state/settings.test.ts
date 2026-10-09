import { afterEach, describe, expect, it } from 'vitest'
import { duration, km } from '../lib/format.ts'
import { DEFAULT_SETTINGS, getSettings, parseSettings, resetSettingsInMemory, updateSetting } from './settings.ts'

afterEach(() => resetSettingsInMemory())

// updateSetting changes the in-memory value first and then writes to IndexedDB, which
// node does not have. The write is expected to fail here; the display is what is tested.
const change = (...args: Parameters<typeof updateSetting>) => updateSetting(...args).catch(() => {})

describe('settings', () => {
  it('start at the defaults', () => {
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS)
  })

  it('read saved values and ignore unknown keys and values', () => {
    expect(parseSettings([{ key: 'distanceUnit', value: 'mi' }, { key: 'timeStyle', value: 'min' }, { key: 'theme', value: 'dark' }])).toEqual({ distanceUnit: 'mi', timeStyle: 'min', fareEligibility: 'adult' })
    expect(parseSettings([{ key: 'distanceUnit', value: 'furlong' }, { key: 'timeStyle', value: 5 }])).toEqual(DEFAULT_SETTINGS)
  })

  it('loads the selected fare discount profile', () => {
    expect(parseSettings([{ key: 'fareEligibility', value: 'student' }]).fareEligibility).toBe('student')
    expect(parseSettings([{ key: 'fareEligibility', value: 'other' }]).fareEligibility).toBe('adult')
  })

  it('the Oras setting changes how long trips are written', async () => {
    expect(duration(80)).toBe('1 oras 20 min')
    await change('timeStyle', 'min')
    expect(duration(80)).toBe('80 min')
    expect(duration(30)).toBe('30 min')
  })

  it('the Distansya setting converts kilometres to miles for display', async () => {
    expect(km(17.5)).toBe('17.5 km')
    await change('distanceUnit', 'mi')
    expect(km(16.09344)).toBe('10 mi')
    expect(km(17.5)).toBe('10.87 mi')
  })

  it('a value that is not an option is refused', async () => {
    await change('distanceUnit', 'furlong' as never)
    expect(getSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
