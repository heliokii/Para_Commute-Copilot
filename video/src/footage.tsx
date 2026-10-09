import { Img, staticFile } from 'remotion'
import type { ClipMeta } from './clips'

/** The recorded frame that was on screen at capture time `at`. */
export function Footage({ clip, at }: { clip: ClipMeta; at: number }) {
  let index = 0
  while (index + 1 < clip.frames.length && clip.frames[index + 1] <= at) index++
  return <Img src={staticFile(`${clip.name}/${String(index).padStart(5, '0')}.jpg`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
}
