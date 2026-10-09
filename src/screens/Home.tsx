import { useState, type FormEvent } from 'react'
import { StatusChip } from '../components/StatusChip'

export function Home() {
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    // Router lands in a later phase (CLAUDE.md section 8, step 3).
    setNotice('Wala pang router. Shell pa lang ito, kaya walang rutang maipapakita.')
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-32">
      <header className="flex items-center justify-between gap-3">
        <span className="text-lg font-semibold tracking-tight">Para!</span>
        <a
          href="#/about"
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:text-ink"
        >
          About
        </a>
      </header>

      <div className="mt-3">
        <StatusChip />
      </div>

      <main className="mt-8 flex flex-col gap-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="destination" className="text-3xl font-semibold tracking-tight">
            Saan ka papunta?
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2 focus-within:border-accent">
            <input
              id="destination"
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setNotice('')
              }}
              placeholder="Hal. bahay papuntang trabaho"
              autoComplete="off"
              enterKeyHint="go"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
            >
              Hanap
            </button>
          </div>
          <p aria-live="polite" className="min-h-5 text-sm text-muted">
            {notice}
          </p>
        </form>

        <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
          <h2 id="recent-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
            Mga huling ruta
          </h2>
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <p className="font-medium">Wala pang ruta</p>
            <p className="mt-1 text-sm text-muted">
              Lalabas dito ang mga huli mong hinanap sa session na ito.
            </p>
          </div>
        </section>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-disabled="true"
          aria-describedby="ask-hint"
          className="pointer-events-auto flex cursor-not-allowed flex-col items-center gap-1"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-accent text-on-accent opacity-60 shadow-lg">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </span>
          <span className="sr-only">Magtanong gamit ang boses</span>
          <span id="ask-hint" className="rounded-full bg-bg px-2 text-xs font-medium text-muted">
            Boses: hindi pa gumagana
          </span>
        </button>
      </div>
    </div>
  )
}
