import { Composition } from 'remotion'
import { DURATION, FPS } from './config'
import { ParaVideo } from './Video'

/** One composition, two shapes: the layout reflows from the frame's own width and height. */
export function Root() {
  return (
    <>
      <Composition id="Para16x9" component={ParaVideo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
      <Composition id="Para9x16" component={ParaVideo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
    </>
  )
}
