import { describe, expect, it } from 'vitest'
import { planRoute } from '../router/plan.ts'
import { parseCsv } from './csv.ts'
import { PACK_HEADERS, packFromCsv, type PackFile } from './packFromCsv.ts'

// SYNTHETIC rows near lat/lon 0,0. Not real places, routes or fares.
const GOOD: Record<PackFile, string> = {
  landmarks: [
    'id,name,aliases,tags,lat,lon,note',
    'A,SYN Alpha,Alpha|Al,,0,0,',
    'B,"SYN Bravo, North",Bravo,EDSA,0,0.02,',
    'C,SYN Charlie,,,0,0.05,',
  ].join('\n'),
  routes: [
    'id,mode,name,tags,fare_table_id,verified,verified_date,verified_by,note',
    'R1,jeepney,SYN Jeep 1,EDSA,F-J,true,2026-10-01,Tester,',
  ].join('\n'),
  route_stops: [
    'route_id,seq,landmark_id,dist_km_from_prev,min_from_prev,min_from_prev_rush,method,measured_date,measured_by,note',
    'R1,1,A,0,0,,,,,',
    'R1,2,B,2.5,12,20,gps,2026-10-01,Tester,',
    'R1,3,C,3.5,18,,gps,2026-10-01,Tester,',
  ].join('\n'),
  fares: [
    'id,mode,product,vehicle_class,rule,base_fare,base_km,per_km,effective_date,expires_at,rounding_rule,source_note,source_url,photo_ref,conflict_note',
    'F-J,jeepney,ordinary,traditional,distance,10,4,1.5,2026-01-01,,nearest_0.25,SYNTHETIC,https://example.test/fare-guide,photo-001.jpg,',
  ].join('\n'),
  fare_matrix: [
    'fare_entry_id,promotion_id,origin_id,destination_id,fare',
  ].join('\n'),
  fare_promotions: [
    'fare_entry_id,id,label,eligibility,kind,value,effective_date,expires_at,source_url,source_note',
  ].join('\n'),
  terminals: [
    'id,name,landmark_id,lat,lon,routes_served,verified_date,note',
    'T1,SYN Alpha Terminal,A,0,0,R1,2026-10-01,',
  ].join('\r\n'),
}

const errorsOf = (files: Partial<Record<PackFile, string>>) =>
  packFromCsv(files)
    .issues.filter((issue) => issue.level === 'error')
    .map((issue) => `${issue.file}:${issue.row ?? '-'} ${issue.message}`)

describe('parseCsv', () => {
  it('handles quotes, embedded commas, doubled quotes and CRLF', () => {
    const table = parseCsv('id,name\r\n1,"Bravo, North"\r\n2,"say ""para"""\r\n')
    expect(table.headers).toEqual(['id', 'name'])
    expect(table.records.map((record) => record.values.name)).toEqual(['Bravo, North', 'say "para"'])
    expect(table.records.map((record) => record.row)).toEqual([2, 3])
  })
})

describe('packFromCsv', () => {
  it('builds a pack the router can use, with no errors', () => {
    const { pack, terminals, issues } = packFromCsv(GOOD)
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(pack.landmarks[1]).toMatchObject({ name: 'SYN Bravo, North', aliases: ['Bravo'], tags: ['EDSA'] })
    expect(pack.landmarks[0].aliases).toEqual(['Alpha', 'Al'])
    expect(pack.routes[0].stops).toHaveLength(3)
    expect(terminals[0]).toMatchObject({ landmarkId: 'A', routesServed: ['R1'] })

    const result = planRoute(pack, {
      originId: 'A',
      destinationId: 'C',
      preference: 'cheapest',
      avoid: { landmarkIds: [], routeIds: [], modes: [], tags: [] },
    })
    // 6.0 km: 10 + 2.0 * 1.5 = 13.00
    expect(result.totalFare).toBe(13)
    expect(result.usedUnverifiedData).toBe(false)
  })

  it('reports missing files and missing columns', () => {
    expect(errorsOf({})).toEqual([
      'landmarks:- landmarks.csv is missing',
      'fare_matrix:- fare_matrix.csv is missing',
      'fare_promotions:- fare_promotions.csv is missing',
      'fares:- fares.csv is missing',
      'route_stops:- route_stops.csv is missing',
      'routes:- routes.csv is missing',
      'terminals:- terminals.csv is missing',
    ])
    expect(errorsOf({ ...GOOD, landmarks: 'id,name\nA,SYN Alpha' })[0]).toBe(
      'landmarks:- missing column(s): lat, lon',
    )
  })

  it('treats header-only templates as empty, not broken', () => {
    const templates = Object.fromEntries(
      Object.entries(PACK_HEADERS).map(([file, headers]) => [file, headers.join(',')]),
    )
    const { issues } = packFromCsv(templates)
    expect(issues.every((issue) => issue.level === 'warning')).toBe(true)
    expect(issues.map((issue) => issue.message)).toContain('no data rows')
  })

  it('reports unknown references', () => {
    const errors = errorsOf({
      ...GOOD,
      route_stops: GOOD.route_stops.replace('R1,3,C,', 'R1,3,ZZ,') + '\nR9,1,A,0,0,,,,,',
      routes: GOOD.routes.replace('F-J,true', 'F-X,true'),
    })
    expect(errors).toContain('route_stops:4 landmark_id "ZZ" is not in landmarks.csv')
    expect(errors).toContain('route_stops:5 route_id "R9" is not in routes.csv')
    expect(errors).toContain('routes:2 fare_table_id "F-X" is not in fares.csv')
  })

  it('reports duplicate ids, bad numbers, bad dates and bad modes', () => {
    const errors = errorsOf({
      ...GOOD,
      landmarks: GOOD.landmarks + '\nA,SYN Again,,,abc,200,',
      fares: GOOD.fares.replace('2026-01-01', 'Jan 2026').replace('F-J,jeepney', 'F-J,tricycle'),
    })
    expect(errors).toContain('landmarks:5 duplicate id "A"')
    expect(errors).toContain('landmarks:5 "lat" is not a number: "abc"')
    expect(errors).toContain('landmarks:5 lon out of range: 200')
    expect(errors).toContain('fares:2 "effective_date" must be YYYY-MM-DD, got "Jan 2026"')
    expect(errors.some((message) => message.includes('unknown mode "tricycle"'))).toBe(true)
    expect(errorsOf({ ...GOOD, fares: GOOD.fares.replace('2026-01-01', '2026-02-30') })).toContain(
      'fares:2 "effective_date" must be YYYY-MM-DD, got "2026-02-30"',
    )
  })

  it('rejects distance fares and percentage promotions with blank required values', () => {
    const fareErrors = errorsOf({ ...GOOD, fares: GOOD.fares.replace(',10,4,1.5,', ',,4,1.5,') })
    expect(fareErrors).toContain('fares:2 "base_fare" is required and must be a number')

    const promotionErrors = errorsOf({
      ...GOOD,
      fare_promotions: [
        PACK_HEADERS.fare_promotions.join(','),
        'F-J,ALL-HALF,Temporary half fare,all,percent_off,,2026-03-23,2026-12-31,https://example.test/promo,OFFICIAL',
      ].join('\n'),
    })
    expect(promotionErrors).toContain('fare_promotions:2 "value" is required and must be a number')
  })

  it('does not let matrix IDs mutate Object.prototype', () => {
    const marker = 'fareCsvPrototypePollution'
    try {
      errorsOf({
        ...GOOD,
        fare_matrix: `${GOOD.fare_matrix}\nF-J,,__proto__,${marker},3`,
      })
      expect(Object.hasOwn(Object.prototype, marker)).toBe(false)
    } finally {
      delete (Object.prototype as Record<string, unknown>)[marker]
    }
  })

  it('reports inconsistent stop distances', () => {
    // A to B is about 2.22 km in a straight line.
    const tooShort = errorsOf({ ...GOOD, route_stops: GOOD.route_stops.replace('R1,2,B,2.5,12', 'R1,2,B,1.0,12') })
    expect(tooShort.some((message) => message.includes('shorter than the straight line'))).toBe(true)

    const detour = packFromCsv({ ...GOOD, route_stops: GOOD.route_stops.replace('R1,2,B,2.5,12', 'R1,2,B,9,12') })
    expect(detour.issues.some((issue) => issue.level === 'warning' && issue.message.includes('3x the straight line'))).toBe(true)

    const zero = errorsOf({ ...GOOD, route_stops: GOOD.route_stops.replace('R1,3,C,3.5,18', 'R1,3,C,0,0') })
    expect(zero).toContain('route_stops:4 "dist_km_from_prev" must be greater than 0')
    expect(zero).toContain('route_stops:4 "min_from_prev" must be greater than 0')
  })

  it('requires proof for verified routes and warns on unverified ones', () => {
    const noProof = errorsOf({ ...GOOD, routes: GOOD.routes.replace('true,2026-10-01,Tester', 'true,,') })
    expect(noProof).toContain('routes:2 verified is true but verified_date is missing or not YYYY-MM-DD')
    expect(noProof).toContain('routes:2 verified is true but verified_by is empty')

    const unverified = packFromCsv({ ...GOOD, routes: GOOD.routes.replace('true,2026-10-01,Tester', 'false,,') })
    expect(unverified.pack.routes[0].verified).toBe(false)
    expect(unverified.issues.some((issue) => issue.message === 'route "R1" is not ride-verified')).toBe(true)
  })

  it('flags conflicting fare sources', () => {
    const { issues } = packFromCsv({
      ...GOOD,
      fares: GOOD.fares.replace('photo-001.jpg,', 'photo-001.jpg,Source A and B disagree on per_km'),
    })
    expect(issues.some((issue) => issue.message.startsWith('sources conflict:'))).toBe(true)
  })

  it('rejects fare source locations that are not HTTPS URLs', () => {
    const errors = errorsOf({ ...GOOD, fares: GOOD.fares.replace('https://example.test/fare-guide', 'javascript:alert(1)') })
    expect(errors).toContain('fares:2 "source_url" must be an HTTPS URL')
  })

  it('requires every fare to have a valid effective date and HTTPS source', () => {
    const noDate = errorsOf({ ...GOOD, fares: GOOD.fares.replace('2026-01-01', '') })
    expect(noDate).toContain('fares:2 "effective_date" must be YYYY-MM-DD, got ""')

    const noSource = errorsOf({ ...GOOD, fares: GOOD.fares.replace('https://example.test/fare-guide', '') })
    expect(noSource).toContain('fares:2 "source_url" must be an HTTPS URL')

    const missingContext = errorsOf({
      ...GOOD,
      fares: GOOD.fares.replace(',ordinary,traditional,', ',,,').replace(',nearest_0.25,SYNTHETIC,', ',nearest_0.25,,')
    })
    expect(missingContext).toContain('fares:2 "product" is required')
    expect(missingContext).toContain('fares:2 "vehicle_class" is required')
    expect(missingContext).toContain('fares:2 "source_note" is required')
  })

  it('loads exact matrix fares and dated fare promotions', () => {
    const files = {
      ...GOOD,
      routes: GOOD.routes.replace('F-J,true', 'F-M,true'),
      fares: [
        PACK_HEADERS.fares.join(','),
        'F-M,train,single-journey,standard,matrix,,,,2026-03-23,,,OFFICIAL,https://example.test/rail-matrix,,',
      ].join('\n'),
      fare_matrix: [
        PACK_HEADERS.fare_matrix.join(','),
        'F-M,,A,B,8',
        'F-M,,A,C,12',
        'F-M,,B,C,8',
      ].join('\n'),
      fare_promotions: PACK_HEADERS.fare_promotions.join(','),
    }
    const { pack, issues } = packFromCsv(files)
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(pack.fares[0].rule).toEqual({ kind: 'matrix', byOriginDestination: { A: { B: 8, C: 12 }, B: { C: 8 } } })
    const result = planRoute(pack, {
      originId: 'A', destinationId: 'C', preference: 'cheapest',
      avoid: { landmarkIds: [], routeIds: [], modes: [], tags: [] },
    })
    expect(result.totalFare).toBe(12)
  })

  it('keeps scheduled and promotional matrix IDs distinct even when they contain separators', () => {
    const files = {
      ...GOOD,
      routes: GOOD.routes.replace('F-J,true', 'F::P,true'),
      fares: [
        PACK_HEADERS.fares.join(','),
        'F::P,train,single-journey,standard,matrix,,,,2026-01-01,,,OFFICIAL,https://example.test/fare,,',
        'F,train,single-journey,standard,matrix,,,,2026-01-01,,,OFFICIAL,https://example.test/fare,,',
      ].join('\n'),
      fare_matrix: [
        PACK_HEADERS.fare_matrix.join(','),
        'F::P,,A,B,20',
        'F,,B,C,17',
        'F,P,A,C,5',
      ].join('\n'),
      fare_promotions: [
        PACK_HEADERS.fare_promotions.join(','),
        'F,P,Promo,all,matrix,,2026-01-01,,https://example.test/promo,OFFICIAL',
      ].join('\n'),
    }
    const { pack, issues } = packFromCsv(files)
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(pack.fares.find((fare) => fare.id === 'F::P')?.rule).toEqual({ kind: 'matrix', byOriginDestination: { A: { B: 20 } } })
    expect(pack.fares.find((fare) => fare.id === 'F')?.rule).toEqual({ kind: 'matrix', byOriginDestination: { B: { C: 17 } } })
    expect(pack.fares.find((fare) => fare.id === 'F')?.promotions?.[0].rule).toEqual({ kind: 'matrix', byOriginDestination: { A: { C: 5 } } })
  })

  it('parses promotions without replacing their scheduled fare rule', () => {
    const { pack, issues } = packFromCsv({
      ...GOOD,
      fare_promotions: [
        PACK_HEADERS.fare_promotions.join(','),
        'F-J,ALL-HALF,Temporary half fare,all,percent_off,50,2026-03-23,2026-12-31,https://example.test/promo,OFFICIAL',
      ].join('\n'),
    })
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(pack.fares[0].rule).toMatchObject({ kind: 'distance', baseFare: 10 })
    expect(pack.fares[0].promotions?.[0]).toMatchObject({ id: 'ALL-HALF', effectiveDate: '2026-03-23', expiresAt: '2026-12-31' })
  })
})
