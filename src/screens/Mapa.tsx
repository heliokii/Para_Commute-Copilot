import { useEffect } from 'react'
import { RAIL_LINES } from '../fares/lines.ts'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FareLookup } from '../components/FareLookup'
import { Icon } from '../components/Icon'
import { RouteMap } from '../components/RouteMap'
import { TopBar } from '../components/TopBar'
import { copy } from '../copy'
import { duration, peso } from '../lib/format'
import { LEGEND_MODES, MODES } from '../lib/modes'
import { OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import { ensurePack, landmarkName, searchRoutes, selectedResult, setPlan, usePlan } from '../state/plan'
import { useSettings } from '../state/settings'
import { ToggleRow } from './Modes'

export function Mapa() {
  const plan = usePlan()
  const fareOnly = plan.pack !== null && plan.pack.routes.length === 0
  const result = selectedResult(plan)
  // This tab stays mounted: re-render when a unit setting changes.
  useSettings()

  useEffect(() => {
    void ensurePack()
  }, [])

  // Tapping stations picks the fare lookup: boarding first, then alighting, then start over.
  function pickStation(id: string) {
    if (!plan.originId || plan.destinationId) setPlan({ originId: id, destinationId: '' })
    else if (id !== plan.originId) setPlan({ destinationId: id })
  }

  return (
    <div>
      <TopBar title={copy.map.title} />
      <div className="flex flex-col gap-3 px-4 pt-2">
        {plan.packError && <Card className="p-4 text-sm">{copy.plan.packError}</Card>}
        {!plan.pack && !plan.packError && (
          <p className="px-1 text-sm text-on-deep/85">{copy.plan.loading}</p>
        )}
        {plan.pack && (
          <Card className="p-3">
            {result ? (
              <div className="mb-2 px-1">
                <h2 data-testid="map-heading" className="font-display text-lg leading-tight font-semibold">
                  {landmarkName(plan.pack, result.legs[0].boardId)}
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only"> papuntang </span>
                  {landmarkName(plan.pack, result.legs.at(-1)!.alightId)}
                </h2>
                <p className="text-sm text-ink-muted tabular-nums">
                  {peso(result.totalFare)} · {duration(result.totalMinutes)} ·{' '}
                  {copy.results.transfers(result.transfers)}
                </p>
              </div>
            ) : (
              <p className="mb-2 px-1 text-sm text-ink-muted">{fareOnly ? copy.fares.mapHint : copy.map.noRoute}</p>
            )}

            <RouteMap
              pack={plan.pack}
              result={result}
              marked={{ originId: plan.originId, destinationId: plan.destinationId }}
              onStationClick={fareOnly ? pickStation : undefined}
            />

            <div className="mt-3 px-1">
              <h3 className="sr-only">{copy.map.legend}</h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {fareOnly &&
                  RAIL_LINES.map((railLine) => (
                    <li key={railLine.id} className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-1.5 w-5 rounded-full" style={{ backgroundColor: railLine.color }} />
                      {railLine.label}
                    </li>
                  ))}
                {!fareOnly && LEGEND_MODES.map((mode) => (
                  <li key={mode} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-5 rounded-full"
                      style={{ backgroundColor: MODES[mode].color }}
                    />
                    {MODES[mode].label}
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                {plan.pack.note && <Badge tone="caution">{copy.app.sampleData}</Badge>}
                {result?.simulated && <Badge tone="caution">{copy.badge.simulated}</Badge>}
                {copy.map.schematic}
              </p>
            </div>
          </Card>
        )}

        {/* On the dashboard the Ruta column beside the map already holds the lookup (same state). */}
        {plan.pack && fareOnly && (
          <div className="xl:hidden">
            <FareLookup pack={plan.pack} testPrefix="map-" />
          </div>
        )}

        {plan.pack && !fareOnly &&
          (result ? (
            <Button href={`#${OVERLAY_PATHS.detail}`} variant="secondary">
              {copy.detail.title}
            </Button>
          ) : (
            <Button href={`#${TAB_PATHS.ruta}`}>{copy.map.planFirst}</Button>
          ))}

        {/* Dashboard only: on a phone these live in Mga Mode and Route detail. Both need routes. */}
        <section className={`hidden flex-col gap-3 ${fareOnly ? '' : 'xl:flex'}`}>
          <h2 className="px-1 font-display font-semibold">{copy.map.features}</h2>
          <ToggleRow
            icon="route"
            testId="map-avoid-edsa"
            label={copy.modes.avoidEdsa.label}
            sub={copy.modes.avoidEdsa.sub}
            checked={plan.avoidEdsa}
            onChange={(avoidEdsa) => {
              setPlan({ avoidEdsa })
              // The map sits next to the switch, so it re-plans right away.
              if (plan.searched) void searchRoutes()
            }}
          >
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <Badge tone="caution">{copy.badge.simulated}</Badge>
              {copy.modes.avoidEdsa.note}
            </p>
          </ToggleRow>
          {result && (
            <Card>
              <a href={`#${OVERLAY_PATHS.trip}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <Icon name="flag" className="size-5.5 shrink-0 text-brown-mid" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{copy.map.alertTitle}</span>
                  <span className="block text-sm text-ink-muted">{copy.map.alertSub}</span>
                </span>
                <Icon name="chevron-right" className="size-5 shrink-0 text-ink-muted" />
              </a>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
