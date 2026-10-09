import type { RoutePack } from '../types.ts'

// SYNTHETIC network for tests and the dev harness. Nothing here is a real place,
// route or fare. Coordinates sit near lat/lon 0,0 (open ocean) on purpose, and
// fare values are deliberately unlike any real LTFRB matrix.
//
// Layout (0.01 degrees is about 1.112 km):
//
//   A --R1/R2--> C --R1/R2--> D ~walk 222 m~ G        H (isolated)
//   A --R1--> B --R1--> C        C --R3--> E --R3--> F
//                                D --R1 (detour)--> F,  D --R4--> F
//
// Fares:
//   F-J (jeepney): 10.00 for the first 4 km, then 1.50/km, nearest 0.25
//   F-B (bus):     20.00 for the first 5 km, then 2.20/km, nearest 0.25
//
// Hand-computed legs used by the tests:
//   R1 A>C   6.0 km  30 min  10 + 2.0*1.5  = 13.00
//   R1 A>D   9.5 km  50 min  10 + 5.5*1.5  = 18.25
//   R1 A>F  17.5 km  80 min  10 + 13.5*1.5 = 30.25
//   R2 A>C   6.0 km  12 min  20 + 1.0*2.2  = 22.20 -> 22.25
//   R2 A>D   9.6 km  20 min  20 + 4.6*2.2  = 30.12 -> 30.00
//   R3 C>F   6.0 km  15 min  10 + 2.0*1.5  = 13.00
//   R4 D>F   3.5 km  15 min  under base km = 20.00
//   walk D>G 0.222 km -> ceil(0.2224 / 4.5 * 60) = 3 min, fare 0
//
// A -> D:
//   cheapest          R1 A>D                 18.25, 50 min, 0 transfers
//   fastest           R2 A>D                 30.00, 20 min, 0 transfers
//   fewest_transfers  R2 A>D (0 transfers on both, R2 is quicker)
//
// A -> F (all three differ):
//   cheapest          R1 A>C + R3 C>F        26.00, 45 min, 1 transfer
//   fastest           R2 A>C + R3 C>F        35.25, 27 min, 1 transfer
//   fewest_transfers  R1 A>F                 30.25, 80 min, 0 transfers
//   other candidates  R2 A>D + R4 D>F        50.00, 35 min, 1 transfer
//                     R1 A>D + R4 D>F        38.25, 65 min, 1 transfer

export const SYNTHETIC_LABEL = 'SYNTHETIC SAMPLE DATA, not verified'

export const SYNTHETIC_PACK: RoutePack = {
  id: 'synthetic-pack',
  corridor: 'SYNTHETIC corridor',
  version: '0.2.0-synthetic',
  note: SYNTHETIC_LABEL,
  landmarks: [
    { id: 'A', name: 'SYN Alpha Terminal', aliases: ['Alpha', 'Alpha Terminal'], tags: [], lat: 0, lon: 0 },
    { id: 'B', name: 'SYN Bravo Market', aliases: ['Bravo', 'Palengke ng Bravo'], tags: [], lat: 0, lon: 0.02 },
    { id: 'C', name: 'SYN Charlie Junction', aliases: ['Charlie', 'Kanto Charlie'], tags: [], lat: 0, lon: 0.05 },
    { id: 'D', name: 'SYN Delta Plaza', aliases: ['Delta', 'Plaza Delta'], tags: [], lat: 0, lon: 0.08 },
    { id: 'E', name: 'SYN Echo Mall', aliases: ['Echo'], tags: [], lat: 0.02, lon: 0.05 },
    { id: 'F', name: 'SYN Foxtrot Station', aliases: ['Foxtrot', 'Istasyon ng Foxtrot'], tags: [], lat: 0.03, lon: 0.08 },
    { id: 'G', name: 'SYN Golf Chapel', aliases: ['Golf', 'Kapilya ng Golf'], tags: [], lat: 0.002, lon: 0.08 },
    { id: 'H', name: 'SYN Hotel Island', aliases: ['Hotel'], tags: [], lat: 0.2, lon: 0.2 },
  ],
  routes: [
    {
      id: 'R1',
      mode: 'jeepney',
      name: 'SYN Jeep 1 (Alpha to Foxtrot, slow)',
      tags: [],
      fareTableId: 'F-J',
      verified: false,
      note: SYNTHETIC_LABEL,
      stops: [
        { landmarkId: 'A', distKmFromPrev: 0, minFromPrev: 0 },
        { landmarkId: 'B', distKmFromPrev: 2.5, minFromPrev: 12 },
        { landmarkId: 'C', distKmFromPrev: 3.5, minFromPrev: 18 },
        { landmarkId: 'D', distKmFromPrev: 3.5, minFromPrev: 20 },
        { landmarkId: 'F', distKmFromPrev: 8, minFromPrev: 30 },
      ],
    },
    {
      id: 'R2',
      mode: 'bus',
      name: 'SYN Bus 2 (Alpha to Delta, express)',
      tags: [],
      fareTableId: 'F-B',
      verified: false,
      note: SYNTHETIC_LABEL,
      stops: [
        { landmarkId: 'A', distKmFromPrev: 0, minFromPrev: 0 },
        { landmarkId: 'C', distKmFromPrev: 6, minFromPrev: 12 },
        { landmarkId: 'D', distKmFromPrev: 3.6, minFromPrev: 8 },
      ],
    },
    {
      id: 'R3',
      mode: 'jeepney',
      name: 'SYN Jeep 3 (Charlie to Foxtrot)',
      // Tag only, so "iwas EDSA" can be tested. This is not a real EDSA route.
      tags: ['EDSA'],
      fareTableId: 'F-J',
      verified: false,
      note: SYNTHETIC_LABEL,
      stops: [
        { landmarkId: 'C', distKmFromPrev: 0, minFromPrev: 0 },
        { landmarkId: 'E', distKmFromPrev: 2.4, minFromPrev: 6 },
        { landmarkId: 'F', distKmFromPrev: 3.6, minFromPrev: 9 },
      ],
    },
    {
      id: 'R4',
      mode: 'bus',
      name: 'SYN Bus 4 (Delta to Foxtrot)',
      tags: [],
      fareTableId: 'F-B',
      verified: false,
      note: SYNTHETIC_LABEL,
      stops: [
        { landmarkId: 'D', distKmFromPrev: 0, minFromPrev: 0 },
        { landmarkId: 'F', distKmFromPrev: 3.5, minFromPrev: 15 },
      ],
    },
  ],
  fares: [
    {
      id: 'F-J',
      mode: 'jeepney',
      baseFare: 10,
      baseKm: 4,
      perKm: 1.5,
      effectiveDate: '2026-01-01',
      roundingRule: 'nearest_0.25',
      sourceNote: 'SYNTHETIC, not a real fare',
    },
    {
      id: 'F-B',
      mode: 'bus',
      baseFare: 20,
      baseKm: 5,
      perKm: 2.2,
      effectiveDate: '2026-02-01',
      roundingRule: 'nearest_0.25',
      sourceNote: 'SYNTHETIC, not a real fare',
    },
  ],
}
