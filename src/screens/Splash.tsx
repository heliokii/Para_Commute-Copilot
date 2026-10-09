import { useEffect } from 'react'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'

const MAX_MS = 1200

/** Cold-start splash. Leaves after 1.2 s at most, or on any tap or key. */
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, MAX_MS)
    window.addEventListener('keydown', onDone)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onDone)
    }
  }, [onDone])

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label={copy.splash.skip}
      className="backdrop fixed inset-0 z-50 flex animate-fade flex-col items-center overflow-hidden px-6 pt-[max(4rem,env(safe-area-inset-top))] text-center text-on-deep"
    >
      {/* Wordmark placeholder: live text until the wordmark art is exported. */}
      <span className="-rotate-6 font-display text-7xl font-bold tracking-tight drop-shadow-lg">
        {copy.app.name}
      </span>
      <span className="mt-1 -rotate-6 font-display text-xl font-medium">{copy.app.subtitle}</span>
      <span className="mt-8 font-display text-lg leading-snug font-medium">
        {copy.app.tagline.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
      <Tsupher state="hero" size="xl" eager bob className="mt-auto mb-10 size-[288px]" />
    </button>
  )
}
