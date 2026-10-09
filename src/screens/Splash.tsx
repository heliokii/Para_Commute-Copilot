import { useEffect } from 'react'
import { Button } from '../components/Button'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'

/** Skyline and clouds behind the landing text. Drawn here: no image files, no map of a real place. */
function Scene() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMax meet"
      className="absolute inset-x-0 top-[22%] h-[46%] w-full overflow-visible"
    >
      {/* One 400-wide strip, repeated sideways so it fills a laptop screen without being stretched. */}
      <g id="splash-strip">
        <g fill="var(--color-bg-gradient-glow)" opacity="0.4">
          <path d="M-10 96a16 16 0 0 1 16-16 22 22 0 0 1 42-6 17 17 0 0 1 30 10 12 12 0 0 1 2 24H2a12 12 0 0 1-12-12Z" />
          <path d="M296 62a14 14 0 0 1 16-13 21 21 0 0 1 40-3 16 16 0 0 1 28 10 11 11 0 0 1 0 22h-74a11 11 0 0 1-10-16Z" />
          <path d="M150 150a10 10 0 0 1 11-9 15 15 0 0 1 28-2 11 11 0 0 1 19 7 8 8 0 0 1 0 16h-52a8 8 0 0 1-6-12Z" />
          <path d="M318 176a9 9 0 0 1 10-8 13 13 0 0 1 25-2 10 10 0 0 1 17 6 7 7 0 0 1 0 14h-46a7 7 0 0 1-6-10Z" />
        </g>
        {/* Far row of towers, then a darker near row. */}
        <path
          fill="var(--color-bg-deeper)"
          opacity="0.3"
          d="M0 700V190h22v-26h20v44h16v-70h24v52h18v-30h14v-22h18v66h20v-88h22v60h16v-36h26v50h14v-74h20v96h18v-48h22v30h16v-62h24v80h20v-40h18v-30h32V700Z"
        />
        <path
          fill="var(--color-bg-deeper)"
          opacity="0.6"
          d="M0 700V230h30v-44h8v-14h10v14h8v60h22v-90h26v70h14v-38h30v64h18v-104h12v-16h8v16h12v120h20v-56h28v40h16v-84h30v100h18v-46h24v30h14v-70h10v-12h10v12h10v36h22V700Z"
        />
      </g>
      {[-800, -400, 400, 800].map((x) => (
        <use key={x} href="#splash-strip" x={x} />
      ))}
    </svg>
  )
}

/** Cold-start landing screen. Stays until the rider taps anywhere or presses a key. */
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    window.addEventListener('keydown', onDone)
    return () => window.removeEventListener('keydown', onDone)
  }, [onDone])

  return (
    <div
      onClick={onDone}
      className="backdrop fixed inset-0 z-50 animate-fade overflow-hidden text-center text-on-deep"
    >
      <Scene />

      <div className="relative mx-auto flex h-full max-w-md flex-col items-center px-6 pt-[max(3rem,env(safe-area-inset-top))]">
        <svg aria-hidden="true" viewBox="0 0 120 60" className="-mb-3 h-12 w-24 -rotate-6 text-accent-amber">
          <path fill="currentColor" d="M36 60a24 24 0 0 1 48 0Z" />
          <path
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            d="M60 26V6M42 31 33 13M78 31l9-18M28 44 10 34M92 44l18-10"
          />
        </svg>
        {/* Wordmark placeholder: live text until the wordmark art is exported. */}
        <span className="-rotate-6 font-display text-7xl font-bold tracking-tight drop-shadow-lg">
          {copy.app.name}
        </span>
        <span className="mt-1 -rotate-6 font-display text-xl font-medium">{copy.app.subtitle}</span>
        <span className="mt-6 font-display text-lg leading-snug font-medium drop-shadow">
          {copy.app.tagline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </span>
        {/* The whole screen closes on tap; this is the named control for keyboard and screen readers. */}
        <Button autoFocus data-testid="splash-start" className="mt-5 px-10">
          {copy.splash.start}
        </Button>

        <Tsupher
          state="hero"
          eager
          // Capped by height too, so the art never climbs over the text on a short screen.
          className="absolute -bottom-[3%] -left-[12%] !h-auto !w-[min(104%,50dvh)] max-w-none"
        />
        <span className="absolute right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex -rotate-12 flex-col items-end font-display text-xl font-medium">
          <svg aria-hidden="true" viewBox="0 0 40 30" className="mr-6 h-6 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M34 26C34 12 22 6 8 8m7-6L7 8l8 6" />
          </svg>
          {copy.app.mascot}
        </span>
      </div>
    </div>
  )
}
