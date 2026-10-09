// Every word the video adds on top of the app footage. Edit here, then re-render.
// Rules: no caption may claim trip planning, live traffic, real-time data, voice input
// or accessibility routing. Station names, fares, dates and proof numbers are NOT here:
// they are read from the capture files in ../footage/*.json at render time.

export const SCRIPT = {
  hook: {
    words: ['Paano', 'kung', 'walang', 'signal?'],
    en: "What if there's no signal?",
  },
  logo: {
    name: 'Para!', // src/copy.ts app.name
    tagline: ['Tamang ruta.', 'Tamang sakay.', 'Laging kasama ka.'], // src/copy.ts app.tagline
    en: 'Para! · Commute Copilot',
  },
  home: {
    title: 'Walang signal? Sige lang.',
    cut: 'Network: pinutol',
    caption: 'Pinutol ang network. Bukas pa rin ang Para!',
    en: 'Network cut. Para! is still open.',
  },
  chat: {
    title: 'Itanong kay Tsupher',
    caption: 'Pamasahe ito, hindi ruta.',
    en: 'This is a fare, not a route.',
    crossCaption: 'Magkaibang linya? Walang pamasaheng ibinibigay.',
    crossEn: 'Two different lines: no fare is given. Nothing is made up.',
    regular: 'Regular',
    asOf: 'as of',
  },
  mapa: {
    title: 'Mapa ng Metro Manila',
    caption: 'Pindutin ang dalawang istasyon. Lalabas ang pamasahe.',
    en: 'Tap two stations. The fare appears. No route is drawn.',
  },
  laptop: {
    title: 'Sa laptop',
    caption: 'Home, Ruta at Mapa, magkakatabi.',
    en: 'On a laptop: Home, Ruta and Mapa side by side.',
  },
  sample: {
    title: 'Susunod: mga ruta',
    tag: 'SAMPLE DATA · Hindi totoong lugar o pamasahe',
    chipTag: 'SAMPLE',
    simulated: 'Simulated',
    skipped: 'Nilaktawan ang paghihintay',
    caption: 'Sample lang ito. Hindi pa totoong ruta.',
    en: 'Sample only. Not real routes yet.',
    gpsCaption: 'Simulated GPS ito. Hindi totoong lokasyon.',
    gpsEn: 'Simulated GPS on sample data. Not a real location.',
  },
  proof: {
    title: 'Patunay, nasa app mismo',
    caption: 'Walang lumabas sa phone.',
    en: "In-app proof. Bytes sent is the app's own tally.",
  },
  end: {
    name: 'Para!',
    // Use lineIfModelRan only if a model actually ran in the footage (it did not: see footage/real-offline.json).
    modelRan: false,
    line: 'Gumagana kahit walang signal.',
    lineIfModelRan: 'AI na tumatakbo sa phone mo.',
    en: 'Works even with no signal.',
    hackathon: '', // TEAM TO FILL: hackathon name. Left out of the end card while empty.
    team: 'Team git inet', // README.md
    members: ['Daniel Aldreen Manjares', 'Justine Catapang', 'Elijah Emmanuel'], // README.md
    // Model list from DISCLOSURE.md, "AI models".
    models: 'Built with open-source models: Qwen2.5 1.5B Instruct, SmolLM2 1.7B Instruct, Llama 3.2 1B Instruct, Qwen2.5 0.5B Instruct',
    modelsNote: 'Optional on-device download. No model ran in this video.',
    // The data credit itself is read from the app's About screen (footage/real-about.json).
  },
} as const
