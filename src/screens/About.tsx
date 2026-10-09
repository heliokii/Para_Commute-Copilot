import { useEffect, useState } from 'react'
import pkg from '../../package.json'
import { db } from '../db/db'
import { SAMPLE_LABEL } from '../db/seed'

const versions: Record<string, string> = { ...pkg.devDependencies, ...pkg.dependencies }

const LIBRARIES = [
  { name: 'react', role: 'UI' },
  { name: 'react-dom', role: 'UI rendering' },
  { name: 'dexie', role: 'IndexedDB wrapper for local data' },
  { name: 'tailwindcss', role: 'Styling' },
  { name: 'vite', role: 'Build tool' },
  { name: 'vite-plugin-pwa', role: 'Service worker and manifest (Workbox)' },
  { name: 'workbox-window', role: 'Service worker registration' },
  { name: '@fontsource-variable/inter', role: 'Self-hosted Inter font (SIL OFL)' },
]

interface Counts {
  packs: number
  routes: number
  fares: number
  fareAsOf: string | undefined
}

export function About() {
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      db.routePacks.count(),
      db.routes.count(),
      db.fares.count(),
      db.fares.orderBy('effectiveDate').last(),
    ]).then(([packs, routes, fares, latestFare]) => {
      if (!cancelled) setCounts({ packs, routes, fares, fareAsOf: latestFare?.effectiveDate })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center justify-between gap-3">
        <a
          href="#/"
          className="-ml-3 rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:text-ink"
        >
          ← Bumalik
        </a>
      </header>

      <main className="mt-6 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">About</h1>
          <p className="mt-2 text-sm text-muted">
            Para! is an offline commute helper. No accounts, no analytics, nothing leaves this
            device.
          </p>
        </div>

        <section aria-labelledby="libraries-heading" className="flex flex-col gap-3">
          <h2 id="libraries-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
            Libraries
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {LIBRARIES.map((library) => (
              <li key={library.name} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{library.name}</p>
                  <p className="text-sm text-muted">{library.role}</p>
                </div>
                <span className="shrink-0 text-sm text-muted tabular-nums">
                  {versions[library.name]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="models-heading" className="flex flex-col gap-3">
          <h2 id="models-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
            Models
          </h2>
          <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            None yet. No AI model is bundled in this build.
          </p>
        </section>

        <section aria-labelledby="data-heading" className="flex flex-col gap-3">
          <h2 id="data-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
            Data sources
          </h2>
          <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
            <p className="font-semibold text-warn">{SAMPLE_LABEL}</p>
            <p className="mt-1 text-muted tabular-nums">
              {counts
                ? `On this device: ${counts.packs} route pack, ${counts.routes} routes, ${counts.fares} fare entry (as of ${counts.fareAsOf ?? 'unknown'}).`
                : 'Reading local database…'}
            </p>
            <p className="mt-1 text-muted">
              Placeholder rows only. No real routes, terminals or fares are included.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
