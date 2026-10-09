import { Badge } from './Badge'
import { Card } from './Card'
import { Icon } from './Icon'
import { LandmarkPicker } from './LandmarkPicker'
import { copy } from '../copy'
import { fareStations, lookupStationFares, productLabel } from '../fares/lookup.ts'
import { peso } from '../lib/format'
import type { RoutePack } from '../router/types.ts'
import { setPlan, usePlan } from '../state/plan'
import { useSettings } from '../state/settings'

/**
 * Station-to-station fares from the pack's exact matrices. Shown while the pack has
 * no routes to plan with, so nothing here is a route, a time or an estimate.
 */
/** `testPrefix` keeps test ids unique when two tabs that stay mounted both show a lookup. */
export function FareLookup({ pack, testPrefix = '' }: { pack: RoutePack; testPrefix?: string }) {
  const plan = usePlan()
  const settings = useSettings()
  const stations = fareStations(pack)
  const rows = lookupStationFares(pack, plan.originId, plan.destinationId, settings.fareEligibility)
  const both = Boolean(plan.originId && plan.destinationId && plan.originId !== plan.destinationId)

  return (
    <Card className="p-4" data-testid={`${testPrefix}fare-lookup`}>
      <p className="text-sm text-ink-muted">{copy.fares.intro}</p>
      <div className="mt-4 flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <LandmarkPicker
            label={copy.fares.origin}
            testId={`${testPrefix}origin`}
            landmarks={stations}
            value={plan.originId}
            onChange={(originId) => setPlan({ originId })}
          />
          <LandmarkPicker
            label={copy.fares.destination}
            testId={`${testPrefix}destination`}
            landmarks={stations}
            value={plan.destinationId}
            onChange={(destinationId) => setPlan({ destinationId })}
          />
        </div>
        <button
          type="button"
          aria-label={copy.plan.swap}
          onClick={() => setPlan({ originId: plan.destinationId, destinationId: plan.originId })}
          className="mb-8 flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-warm text-brown-mid"
        >
          <Icon name="swap" className="size-5" />
        </button>
      </div>

      <div aria-live="polite" className="mt-4" data-testid={`${testPrefix}fare-result`}>
        {!both && <p className="text-sm text-ink-muted">{copy.fares.pickBoth}</p>}
        {both && rows.length === 0 && <p className="text-sm">{copy.fares.noFare}</p>}
        {rows.length > 0 && (
          <ul className="flex flex-col gap-3">
            {rows.map(({ fare, calc }) => (
              <li key={fare.id} className="rounded-2xl bg-surface-warm p-3" data-testid="fare-row">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{productLabel(fare)}</p>
                  <p className="font-display text-2xl font-bold tabular-nums">{peso(calc.centavos / 100)}</p>
                </div>
                {calc.promotion && (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="caution">{calc.promotion.label}</Badge>
                    <span className="text-ink-muted">{copy.fares.normally(peso(calc.scheduledCentavos / 100))}</span>
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-muted">{copy.fares.asOf(calc.effectiveDate)}</p>
                {fare.sourceUrl && (
                  <a href={fare.sourceUrl} target="_blank" rel="noreferrer" className="text-xs underline">
                    {copy.fares.source}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && <p className="mt-3 text-xs text-ink-muted">{copy.fares.noRoute}</p>}
        {settings.fareEligibility !== 'adult' && rows.length > 0 && (
          <p className="mt-1 text-xs text-ink-muted">{copy.fares.noEligibilityData}</p>
        )}
      </div>
    </Card>
  )
}
