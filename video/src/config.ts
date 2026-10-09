// Change FPS to 60 to try a smoother render; every timing in the video is written in seconds.
export const FPS = 30
export const SECONDS = 60
export const DURATION = SECONDS * FPS

/** Scene boundaries in seconds, from the storyboard. */
export const SCENES = {
  hook: [0, 5],
  logo: [5, 10],
  home: [10, 16],
  chat: [16, 25],
  mapa: [25, 33],
  laptop: [33, 38],
  sample: [38, 48],
  proof: [48, 55],
  end: [55, 60],
} as const
export type SceneId = keyof typeof SCENES

/** Scenes overlap by this much (10 frames at 30 fps). */
export const OVERLAP = 1 / 3
