import { useEffect, useState, type FormEvent } from 'react'
import { ACTIVE_PACK_ID, SAMPLE_LABEL } from '../db/seed.ts'
import { backHref } from '../lib/nav.ts'
import { initRouter, planOptions, planRoute } from '../router/client.ts'
import type { Mode, Preference, RoutePack } from '../router/types.ts'

// Dev-only: loaded behind import.meta.env.DEV in App.tsx, absent from production builds.

const PREFERENCES: Preference[] = ['cheapest', 'fastest', 'fewest_transfers']

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

interface CheckGroupProps {
  legend: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}

function CheckGroup({ legend, options, selected, onChange }: CheckGroupProps) {
  return (
    <fieldset className="rounded-xl border border-line-on-deep p-3">
      <legend className="px-1 text-xs font-semibold text-on-deep/80 uppercase">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onChange(toggle(selected, option.value))}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function RouterHarness() {
  const [pack, setPack] = useState<RoutePack | null>(null)
  const [error, setError] = useState('')
  const [originId, setOriginId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [preference, setPreference] = useState<Preference>('cheapest')
  const [avoidLandmarks, setAvoidLandmarks] = useState<string[]>([])
  const [avoidRoutes, setAvoidRoutes] = useState<string[]>([])
  const [avoidModes, setAvoidModes] = useState<string[]>([])
  const [avoidTags, setAvoidTags] = useState<string[]>([])
  const [output, setOutput] = useState('')

  useEffect(() => {
    let cancelled = false
    initRouter(ACTIVE_PACK_ID)
      .then((loaded) => {
        if (cancelled) return
        setPack(loaded)
        setOriginId(loaded.landmarks[0]?.id ?? '')
        setDestinationId(loaded.landmarks[1]?.id ?? '')
      })
      .catch((reason) => !cancelled && setError(String(reason)))
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="p-4 text-accent-amber">{error}</p>
  if (!pack) return <p className="p-4 text-on-deep/80">Loading route pack from Dexie…</p>

  const modes = [...new Set<string>([...pack.routes.map((route) => route.mode), 'walk'])].sort()
  const tags = [
    ...new Set([
      ...pack.routes.flatMap((route) => route.tags),
      ...pack.landmarks.flatMap((landmark) => landmark.tags),
    ]),
  ].sort()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const intent = {
      originId,
      destinationId,
      preference,
      avoid: {
        landmarkIds: avoidLandmarks,
        routeIds: avoidRoutes,
        modes: avoidModes as Mode[],
        tags: avoidTags,
      },
    }
    try {
      const [single, options] = await Promise.all([planRoute(intent), planOptions(intent)])
      setOutput(JSON.stringify({ planRoute: single, planOptions: options }, null, 2))
    } catch (reason) {
      setOutput(String(reason))
    }
  }

  const landmarkOptions = pack.landmarks.map((landmark) => (
    <option key={landmark.id} value={landmark.id}>
      {landmark.id}: {landmark.name}
    </option>
  ))
  const selectClass = 'surface rounded-lg border border-line bg-surface-cream px-2 py-2 text-sm text-ink-dark'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Router harness (dev only)</h1>
        <a href={backHref()} className="text-sm text-on-deep/80">
          ← Back
        </a>
      </header>
      <p className="surface rounded-xl bg-surface-warm px-3 py-2 text-sm font-semibold text-ink-dark">
        {SAMPLE_LABEL}. Pack: {pack.id} v{pack.version}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Origin
            <select
              name="origin"
              className={selectClass}
              value={originId}
              onChange={(event) => setOriginId(event.target.value)}
            >
              {landmarkOptions}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Destination
            <select
              name="destination"
              className={selectClass}
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
            >
              {landmarkOptions}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Preference
            <select
              name="preference"
              className={selectClass}
              value={preference}
              onChange={(event) => setPreference(event.target.value as Preference)}
            >
              {PREFERENCES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <CheckGroup
          legend="Avoid landmarks"
          options={pack.landmarks.map((landmark) => ({ value: landmark.id, label: landmark.id }))}
          selected={avoidLandmarks}
          onChange={setAvoidLandmarks}
        />
        <CheckGroup
          legend="Avoid routes"
          options={pack.routes.map((route) => ({ value: route.id, label: route.id }))}
          selected={avoidRoutes}
          onChange={setAvoidRoutes}
        />
        <CheckGroup
          legend="Avoid modes"
          options={modes.map((mode) => ({ value: mode, label: mode }))}
          selected={avoidModes}
          onChange={setAvoidModes}
        />
        <CheckGroup
          legend="Avoid tags"
          options={tags.map((tag) => ({ value: tag, label: tag }))}
          selected={avoidTags}
          onChange={setAvoidTags}
        />

        <button
          type="submit"
          className="self-start rounded-xl bg-accent-amber px-4 py-2 text-sm font-semibold text-ink-dark"
        >
          Plan
        </button>
      </form>

      <pre
        data-testid="router-output"
        className="surface overflow-x-auto rounded-xl bg-surface-cream p-3 text-xs text-ink-dark"
      >
        {output || 'No result yet.'}
      </pre>
    </div>
  )
}
