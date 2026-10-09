import { useEffect } from 'react'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { RouteMap } from '../components/RouteMap'
import { TopBar } from '../components/TopBar'
import { copy } from '../copy'
import { duration, peso } from '../lib/format'
import { LEGEND_MODES, MODES } from '../lib/modes'
import { OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import { ensurePack, landmarkName, selectedResult, usePlan } from '../state/plan'
import { useSettings } from '../state/settings'

export function Mapa() {
  const plan = usePlan()
  const result = selectedResult(plan)
  // This tab stays mounted: re-render when a unit setting changes.
  useSettings()

  useEffect(() => {
    void ensurePack()
  }, [])

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
              <p className="mb-2 px-1 text-sm text-ink-muted">{copy.map.noRoute}</p>
            )}

            <RouteMap pack={plan.pack} result={result} />

            <div className="mt-3 px-1">
              <h3 className="sr-only">{copy.map.legend}</h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {LEGEND_MODES.map((mode) => (
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

        {plan.pack &&
          (result ? (
            <Button href={`#${OVERLAY_PATHS.detail}`} variant="secondary">
              {copy.detail.title}
            </Button>
          ) : (
            <Button href={`#${TAB_PATHS.ruta}`}>{copy.map.planFirst}</Button>
          ))}
      </div>
    </div>
  )
}
