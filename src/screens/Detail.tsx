import { useState } from 'react'
import { Badge } from '../components/Badge'
import { BottomSheet } from '../components/BottomSheet'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { duration, km, peso } from '../lib/format'
import { MODES } from '../lib/modes'
import { OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import { daysSince, isFareStale } from '../lib/proof'
import { fareBreakdown } from '../router/fare.ts'
import type { Leg, RoutePack } from '../router/types.ts'
import { landmarkName, routeName, selectedResult, usePlan } from '../state/plan'

function FareSheetLeg({ pack, leg }: { pack: RoutePack; leg: Leg }) {
  const route = pack.routes.find((candidate) => candidate.id === leg.routeId)
  const fare = pack.fares.find((candidate) => candidate.id === route?.fareTableId)
  if (!route || !fare) return null
  const parts = fareBreakdown(leg.distKm, fare)
  const row = 'flex items-baseline justify-between gap-3'
  return (
    <li className="py-3">
      <p className="font-semibold">{route.name}</p>
      <dl className="mt-1 space-y-0.5 text-sm tabular-nums">
        <div className={row}>
          <dt>{copy.detail.base(parts.baseKm)}</dt>
          <dd>{peso(parts.baseFare)}</dd>
        </div>
        <div className={row}>
          <dt>{copy.detail.extra(parts.extraKm, peso(parts.perKm))}</dt>
          <dd>{peso(parts.extraFare)}</dd>
        </div>
        {parts.unrounded !== parts.total && (
          <div className={`${row} text-ink-muted`}>
            <dt>{copy.detail.unrounded}</dt>
            <dd>{peso(parts.unrounded)}</dd>
          </div>
        )}
        <div className={`${row} font-semibold`}>
          <dt>{copy.detail.legFare}</dt>
          <dd>{peso(parts.total)}</dd>
        </div>
      </dl>
      <p className="mt-1.5 text-xs text-ink-muted">
        {copy.detail.effective}: {fare.effectiveDate} · {copy.detail.rounding}: {fare.roundingRule}
        <br />
        {copy.detail.source}: {fare.sourceNote}
      </p>
    </li>
  )
}

export function Detail() {
  const plan = usePlan()
  const [fareOpen, setFareOpen] = useState(false)
  const result = selectedResult(plan)
  const pack = plan.pack
  const backHref = `#${plan.detailBack}`

  if (!result || !pack) {
    return (
      <div className="backdrop min-h-dvh">
        <TopBar title={copy.detail.title} backHref={`#${TAB_PATHS.ruta}`} />
        <div className="px-4 pt-2">
          <Card className="flex flex-col items-center px-6 py-8 text-center">
            <Tsupher state="map" size="lg" decorative />
            <p className="mt-3 text-sm text-ink-muted">{copy.detail.none}</p>
          </Card>
        </div>
      </div>
    )
  }

  const rideLegs = result.legs.filter((leg) => leg.mode !== 'walk')
  // Only notes that exist on the routes used. Nothing is invented here.
  const notes = [
    ...new Set(
      rideLegs
        .map((leg) => pack.routes.find((route) => route.id === leg.routeId)?.note)
        .filter((note): note is string => Boolean(note)),
    ),
  ]

  return (
    <div className="backdrop min-h-dvh pb-10">
      <TopBar
        title={copy.detail.title}
        backHref={backHref}
        right={
          <button
            type="button"
            aria-disabled="true"
            aria-label={copy.detail.favorite}
            title={copy.detail.favorite}
            className="flex size-11 cursor-not-allowed items-center justify-center rounded-full opacity-60"
          >
            <Icon name="heart" />
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-2">
        <Card className="p-4">
          <h2 className="font-display text-2xl leading-tight font-semibold">
            {landmarkName(pack, result.legs[0].boardId)}
            <span aria-hidden="true"> → </span>
            <span className="sr-only"> papuntang </span>
            {landmarkName(pack, result.legs.at(-1)!.alightId)}
          </h2>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold tabular-nums">
            <span className="flex items-center gap-1.5">
              <Icon name="clock" className="size-4.5" />
              {duration(result.totalMinutes)}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="bus" className="size-4.5" />
              {copy.results.rides(rideLegs.length)}
            </span>
            <span data-testid="detail-total" className="flex items-center gap-1.5">
              <Icon name="coins" className="size-4.5" />
              {peso(result.totalFare)}
            </span>
          </p>
          <p className="mt-2 flex flex-wrap gap-2">
            <Badge>{copy.pref[result.preference]}</Badge>
            {result.usedUnverifiedData && <Badge tone="caution">{copy.badge.unverified}</Badge>}
            {result.simulated && <Badge tone="caution">{copy.badge.simulated}</Badge>}
            {pack.note && <Badge tone="caution">{copy.app.sampleData}</Badge>}
          </p>
        </Card>

        <Card className="p-4">
          <ol>
            {result.legs.map((leg, index) => {
              const mode = MODES[leg.mode]
              const last = index === result.legs.length - 1
              return (
                <li key={index} data-testid="leg" className="relative flex gap-3 pb-5 last:pb-0">
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="absolute top-10 bottom-0 left-[1.2rem] w-0.5"
                      style={{ backgroundColor: mode.color }}
                    />
                  )}
                  <span
                    className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: mode.color }}
                  >
                    <Icon name={mode.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-semibold">{mode.label}</p>
                      <p className="font-semibold tabular-nums">
                        {leg.mode === 'walk' ? copy.results.noFare : peso(leg.fare)}
                      </p>
                    </div>
                    {leg.mode !== 'walk' && (
                      <p className="text-sm text-ink-muted">{routeName(pack, leg.routeId)}</p>
                    )}
                    <p className="mt-1 text-sm">
                      <span className="text-ink-muted">{copy.detail.board}:</span>{' '}
                      {landmarkName(pack, leg.boardId)}
                      <br />
                      <span className="text-ink-muted">{copy.detail.alight}:</span>{' '}
                      {landmarkName(pack, leg.alightId)}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted tabular-nums">
                      {duration(leg.minutes)} · {km(leg.distKm)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3 font-semibold tabular-nums">
            <span>{copy.detail.total}</span>
            <span>{peso(result.totalFare)}</span>
          </div>
          <p className="mt-0.5 text-sm text-ink-muted tabular-nums">
            {result.fareAsOf ? copy.results.asOf(result.fareAsOf) : copy.results.noFare}
          </p>
          {isFareStale(result.fareAsOf) && result.fareAsOf && (
            <p data-testid="stale-warning" className="mt-1 rounded-xl bg-surface-warm px-3 py-2 text-sm">
              {copy.stale.long(result.fareAsOf, daysSince(result.fareAsOf) ?? 0)}
            </p>
          )}
          {rideLegs.length > 0 && (
            <button
              type="button"
              onClick={() => setFareOpen(true)}
              className="mt-2 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brown-mid underline underline-offset-2"
            >
              <Icon name="info" className="size-4.5" />
              {copy.detail.fareButton}
            </button>
          )}
        </Card>

        {notes.length > 0 && (
          <Card tone="warm" className="p-4">
            <h3 className="font-display font-semibold">{copy.detail.notesTitle}</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Card>
        )}

        <div className="mt-1 flex flex-col gap-2">
          <Button href={`#${OVERLAY_PATHS.trip}`}>
            <Icon name="send" className="size-5" />
            {copy.detail.start}
          </Button>
          <Button href={`#${TAB_PATHS.mapa}`} variant="secondary">
            <Icon name="map" className="size-5" />
            {copy.detail.seeMap}
          </Button>
        </div>
      </div>

      <BottomSheet open={fareOpen} onClose={() => setFareOpen(false)} title={copy.detail.fareSheetTitle}>
        <ul data-testid="fare-sheet" className="mt-1 max-h-[55dvh] divide-y divide-line overflow-y-auto">
          {rideLegs.map((leg, index) => (
            <FareSheetLeg key={index} pack={pack} leg={leg} />
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">{copy.detail.fareDisclaimer}</p>
        <Button variant="dark" className="mt-4 w-full" onClick={() => setFareOpen(false)}>
          {copy.modes.done}
        </Button>
      </BottomSheet>
    </div>
  )
}
