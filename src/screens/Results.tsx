import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { duration, peso } from '../lib/format'
import { MODES } from '../lib/modes'
import { go, OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import type { RouteResult } from '../router/types.ts'
import { landmarkName, setPlan, usePlan } from '../state/plan'

const rideCount = (result: RouteResult) => result.legs.filter((leg) => leg.mode !== 'walk').length

function OptionCard({ result, index, chosen }: { result: RouteResult; index: number; chosen: boolean }) {
  const rides = rideCount(result)
  return (
    <button
      type="button"
      data-testid="route-option"
      onClick={() => {
        setPlan({ selectedIndex: index })
        go(OVERLAY_PATHS.detail)
      }}
      className="surface w-full rounded-card bg-surface-cream p-4 text-left text-ink-dark shadow-card"
    >
      <span className="flex flex-wrap items-center gap-2">
        <Badge>{copy.pref[result.preference]}</Badge>
        {chosen && <Badge tone="strong">{copy.badge.chosen}</Badge>}
        {result.usedUnverifiedData && <Badge tone="caution">{copy.badge.unverified}</Badge>}
        {result.simulated && <Badge tone="caution">{copy.badge.simulated}</Badge>}
      </span>

      <span className="mt-3 flex items-baseline justify-between gap-3">
        <span data-testid="option-fare" className="font-display text-3xl font-semibold tabular-nums">
          {peso(result.totalFare)}
        </span>
        <span className="text-right font-semibold tabular-nums">{duration(result.totalMinutes)}</span>
      </span>

      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-muted">
        {result.legs.map((leg, legIndex) => (
          <span key={legIndex} className="flex items-center gap-1.5">
            {legIndex > 0 && <Icon name="chevron-right" className="size-3.5" />}
            <span className="font-medium text-ink-dark">{MODES[leg.mode].label}</span>
          </span>
        ))}
      </span>

      <span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
        <span>
          {rides === 0 ? copy.results.walkOnly : copy.results.rides(rides)} ·{' '}
          {copy.results.transfers(result.transfers)}
        </span>
        <span className="tabular-nums">
          {result.fareAsOf ? copy.results.asOf(result.fareAsOf) : copy.results.noFare}
        </span>
      </span>
    </button>
  )
}

export function Results() {
  const plan = usePlan()
  const intent = plan.searched
  const found = plan.options.filter((option) => option.status === 'ok')
  const failure = plan.options.find((option) => option.status === 'no_route')

  return (
    <div className="backdrop min-h-dvh pb-10">
      <TopBar title={copy.results.title} backHref={`#${TAB_PATHS.ruta}`} />
      <div className="flex flex-col gap-3 px-4 pt-2">
        {intent && (
          <div className="px-1">
            <h2 className="font-display text-2xl leading-tight font-semibold">
              {landmarkName(plan.pack, intent.originId)}
              <span aria-hidden="true"> → </span>
              <span className="sr-only"> papuntang </span>
              {landmarkName(plan.pack, intent.destinationId)}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-on-deep/85">
              {found.length > 0 && <span>{copy.results.found(found.length)}</span>}
              {plan.pack?.note && <Badge tone="label">{copy.app.sampleData}</Badge>}
            </p>
          </div>
        )}

        {found.some((option) => option.simulated) && (
          <p className="rounded-2xl border border-line-on-deep bg-black/15 px-4 py-2.5 text-sm">
            {copy.results.simulatedNote}
          </p>
        )}

        {found.map((result, index) => (
          <OptionCard
            key={index}
            result={result}
            index={plan.options.indexOf(result)}
            chosen={plan.options.indexOf(result) === plan.chosenIndex}
          />
        ))}

        {found.length === 0 && (
          <Card className="flex flex-col items-center px-6 py-8 text-center">
            <Tsupher state="confused" size="lg" />
            <h2 className="mt-3 font-display text-xl font-semibold">{copy.results.emptyTitle}</h2>
            <p data-testid="no-route-reason" className="mt-1 text-sm text-ink-muted">
              {failure?.reason ? copy.reason[failure.reason] : copy.detail.none}
            </p>
            {failure?.simulated && (
              <p className="mt-2">
                <Badge tone="caution">{copy.badge.simulated}</Badge>
              </p>
            )}
            <Button href={`#${TAB_PATHS.ruta}`} variant="dark" className="mt-5">
              {copy.results.back}
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
