// Regenerates tests/taglish-50.json. Edit the list here, then run:
//   node tests/build-taglish-50.mjs
// SEED SET against the SYNTHETIC sample pack (landmark ids A to H are made up).
// Replace or extend with real rider phrasings once the corridor pack exists.
import { writeFileSync } from 'node:fs'

const ok = (originId, destinationId, extra = {}) => ({ status: 'ok', originId, destinationId, ...extra })
const ask = { status: 'needs_clarification' }
const no = { status: 'unsupported' }

const queries = [
  ['clean', 'Paano pumunta sa Foxtrot galing Alpha?', ok('A', 'F')],
  ['clean', 'Galing ako sa Alpha Terminal, papunta sa Delta Plaza', ok('A', 'D')],
  ['clean', 'Mula Bravo papuntang Foxtrot Station', ok('B', 'F')],
  ['clean', 'Paano makapunta sa Golf Chapel mula sa Alpha?', ok('A', 'G')],
  ['clean', 'Papunta akong Charlie galing Alpha', ok('A', 'C')],
  ['clean', 'Nasa Bravo ako, pa-Delta ako', ok('B', 'D')],
  ['clean', 'Galing Charlie Junction papuntang Echo Mall', ok('C', 'E')],
  ['clean', 'Paano po pumunta sa Delta galing sa Bravo Market?', ok('B', 'D')],

  ['typo', 'pano pmunta sa Foxtort galing Alhpa', ok('A', 'F')],
  ['typo', 'galing bravoo papunta chalie', ok('B', 'C')],
  ['typo', 'mula alfa terminal papuntang delta plza', ok('A', 'D')],
  ['typo', 'papnta sa ecko mall galing charle', ok('C', 'E')],
  ['typo', 'galing delat papunta foxtrott', ok('D', 'F')],
  ['typo', 'Alpah to Golff', ok('A', 'G')],
  ['typo', 'pano papunta ng Brvo mula sa Dleta', ok('D', 'B')],

  ['tagalog', 'Saan ako sasakay papuntang Kapilya ng Golf mula sa Plaza Delta?', ok('D', 'G')],
  ['tagalog', 'Manggagaling ako sa Palengke ng Bravo, pupunta ako sa Istasyon ng Foxtrot', ok('B', 'F')],
  ['tagalog', 'Paano makakarating sa Kanto Charlie buhat sa Alpha Terminal?', ok('A', 'C')],
  ['tagalog', 'Nandito ako sa Charlie, gusto kong pumunta sa Delta', ok('C', 'D')],
  ['tagalog', 'Mula Alpha hanggang Echo', ok('A', 'E')],
  ['tagalog', 'Pauwi na ako sa Bravo galing Delta', ok('D', 'B')],

  ['english', 'How do I get from Alpha Terminal to Foxtrot Station?', ok('A', 'F')],
  ['english', 'Route from Bravo to Delta please', ok('B', 'D')],
  ['english', "I'm at Charlie, going to Foxtrot", ok('C', 'F')],
  ['english', 'Alpha to Delta', ok('A', 'D')],
  ['english', 'directions to Golf Chapel from Delta Plaza', ok('D', 'G')],
  ['english', "What's the way from Charlie Junction to Echo Mall?", ok('C', 'E')],

  ['code-switched', 'From Alpha papuntang Foxtrot, anong sasakyan?', ok('A', 'F')],
  ['code-switched', 'Galing ako ng Bravo, how do I get to Charlie?', ok('B', 'C')],
  ['code-switched', 'Punta ako Delta from Alpha Terminal', ok('A', 'D')],
  ['code-switched', 'Need to go to Foxtrot Station, galing akong Charlie', ok('C', 'F')],
  ['code-switched', 'Pa-Echo ako, from Charlie', ok('C', 'E')],

  ['preference', 'Pinakamura na ruta galing Alpha papuntang Foxtrot', ok('A', 'F', { preference: 'cheapest' })],
  ['preference', 'Mabilis na way from Alpha to Foxtrot', ok('A', 'F', { preference: 'fastest' })],
  ['preference', 'Galing Alpha pa-Foxtrot, yung walang lipat', ok('A', 'F', { preference: 'fewest_transfers' })],
  ['preference', 'Nagmamadali ako, Alpha to Delta', ok('A', 'D', { preference: 'fastest' })],
  ['preference', 'Tipid lang, mula Bravo hanggang Foxtrot', ok('B', 'F', { preference: 'cheapest' })],
  ['preference', 'Alpha to Foxtrot, fewest transfers please', ok('A', 'F', { preference: 'fewest_transfers' })],

  ['avoid', 'Galing Alpha papuntang Foxtrot, iwas EDSA', ok('A', 'F', { avoid: { tags: ['EDSA'] } })],
  ['avoid', 'Alpha to Foxtrot pero huwag dumaan sa EDSA', ok('A', 'F', { avoid: { tags: ['EDSA'] } })],
  ['avoid', 'From Alpha to Foxtrot, avoid bus', ok('A', 'F', { avoid: { modes: ['bus'] } })],
  ['avoid', 'Mula Alpha papunta Foxtrot, wag sa Charlie', ok('A', 'F', { avoid: { landmarkIds: ['C'] } })],
  ['avoid', 'Paano kung sarado ang Echo? Galing Charlie papuntang Foxtrot', ok('C', 'F', { avoid: { landmarkIds: ['E'] } })],
  ['avoid', 'Pinakamabilis galing Alpha pa-Foxtrot, iwas EDSA at walang bus', ok('A', 'F', { preference: 'fastest', avoid: { tags: ['EDSA'], modes: ['bus'] } })],

  // Incomplete or unclear: the right answer is to ask, never to guess.
  ['ambiguous', 'Paano pumunta sa Delta?', ask],
  ['ambiguous', 'Galing ako sa Alpha', ask],
  ['ambiguous', 'Papunta sa Sierra galing Alpha', ask],
  ['ambiguous', 'Alpha Foxtrot', ask],

  ['out-of-scope', 'Anong oras na?', no],
  ['out-of-scope', 'Kumusta ka Tsupher, ano ang paborito mong kanta?', no],
]

const output = {
  note: 'SEED SET written by the coding agent against the SYNTHETIC sample pack. Landmark ids A to H are made up. Replace or extend with real rider phrasings once the corridor pack exists.',
  pack: 'synthetic-pack',
  queries: queries.map(([category, text, expected], index) => ({ id: index + 1, category, text, expected })),
}
writeFileSync(new URL('./taglish-50.json', import.meta.url), JSON.stringify(output, null, 2) + '\n')
console.log(`${output.queries.length} queries written`)
