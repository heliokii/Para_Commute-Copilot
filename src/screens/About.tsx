import { useEffect, useState, type ReactNode } from 'react'
import pkg from '../../package.json'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { copy } from '../copy'
import { db } from '../db/db'
import { seedReady } from '../db/seed'
import { backHref } from '../lib/nav'

const versions: Record<string, string> = { ...pkg.devDependencies, ...pkg.dependencies }

const LIBRARIES = [
  { name: 'react', role: 'UI' },
  { name: 'react-dom', role: 'UI rendering' },
  { name: 'dexie', role: 'IndexedDB wrapper for local data' },
  { name: 'tailwindcss', role: 'Styling' },
  { name: 'vite', role: 'Build tool' },
  { name: 'vite-plugin-pwa', role: 'Service worker and manifest (Workbox)' },
  { name: 'workbox-window', role: 'Service worker registration' },
]

const FONTS = [
  { name: '@fontsource-variable/inter', role: 'Inter, body text (SIL OFL 1.1)' },
  { name: '@fontsource-variable/fredoka', role: 'Fredoka, headings (SIL OFL 1.1)' },
]

interface Counts {
  packs: number
  routes: number
  fares: number
  fareAsOf: string | undefined
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function PackageList({ items }: { items: { name: string; role: string }[] }) {
  return (
    <Card>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.name} className="flex items-baseline justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-sm text-ink-muted">{item.role}</p>
            </div>
            <span className="shrink-0 text-sm text-ink-muted tabular-nums">{versions[item.name]}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function About() {
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    let cancelled = false
    seedReady
      .then(() =>
        Promise.all([
          db.routePacks.count(),
          db.routes.count(),
          db.fares.count(),
          db.fares.orderBy('effectiveDate').last(),
        ]),
      )
      .then(([packs, routes, fares, latestFare]) => {
        if (!cancelled) setCounts({ packs, routes, fares, fareAsOf: latestFare?.effectiveDate })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="backdrop min-h-full pb-10">
      <TopBar title={copy.about.title} backHref={backHref()} />
      <main className="flex flex-col gap-6 px-4 pt-2">
        <p className="px-1 text-sm text-on-deep/90">{copy.about.intro}</p>

        <Section title={copy.about.libraries}>
          <PackageList items={LIBRARIES} />
        </Section>

        <Section title={copy.about.fonts}>
          <PackageList items={FONTS} />
        </Section>

        <Section title={copy.about.models}>
          <Card className="px-4 py-3 text-sm text-ink-muted">{copy.about.modelsNone}</Card>
        </Section>

        <Section title={copy.about.data}>
          <Card className="px-4 py-3 text-sm">
            <p className="font-semibold text-accent-terracotta">{copy.app.sampleData}</p>
            <p className="mt-1 text-ink-muted tabular-nums">
              {counts
                ? `On this device: route packs ${counts.packs}, routes ${counts.routes}, fare tables ${counts.fares} (latest as of ${counts.fareAsOf ?? 'unknown'}).`
                : copy.about.dataLoading}
            </p>
            <p className="mt-1 text-ink-muted">{copy.about.dataNote}</p>
          </Card>
        </Section>

        <Section title={copy.about.art}>
          <Card className="px-4 py-3 text-sm text-ink-muted">{copy.about.artNote}</Card>
        </Section>
      </main>
    </div>
  )
}
