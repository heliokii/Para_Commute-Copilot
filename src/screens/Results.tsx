import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { duration, peso } from '../lib/format'
import { isMockRoute, MODES } from '../lib/modes'
import { go, OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import { daysSince, isFareStale } from '../lib/proof'
import type { Intent, RouteResult } from '../router/types.ts'
import { FavoriteToggle } from '../components/FavoriteToggle'
import { landmarkName, setPlan, usePlan } from '../state/plan'
import { useSettings } from '../state/settings'

const rideCount = (result: RouteResult) => result.legs.filter((leg) => leg.mode !== 'walk').length

function OptionCard({ result, index, chosen, intent }: { result: RouteResult; index: number; chosen: boolean; intent: Intent | null }) {
  const rides = rideCount(result)
  const { pack } = usePlan()
  return (
    <div className="relative">
    <button
      type="button"
      data-testid="route-option"
      onClick={() => {
        setPlan({ selectedIndex: index, detailBack: OVERLAY_PATHS.results })
        go(OVERLAY_PATHS.detail)
      }}
      className="surface w-full rounded-card bg-surface-cream p-4 text-left text-ink-dark shadow-card"
    >
      <span className="flex flex-wrap items-center gap-2 pr-11">
        <Badge>{copy.pref[result.preference]}</Badge>
        {chosen && <Badge tone="strong">{copy.badge.chosen}</Badge>}
        {result.legs.some((leg) => isMockRoute(leg.routeId)) && <Badge tone="caution">{copy.badge.mock}</Badge>}
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
    {intent && (
      <FavoriteToggle intent={{ ...intent, preference: result.preference }} pack={pack} className="absolute top-2 right-2 text-ink-dark" />
    )}
    </div>
  )
}

export function Results() {
  const plan = usePlan()
  useSettings()
  const intent = plan.searched
  const found = plan.options.filter((option) => option.status === 'ok')
  const failure = plan.options.find((option) => option.status === 'no_route')
  // Oldest fare date among the options shown, if it is past the freshness limit.
  const staleDate = found
    .map((option) => option.fareAsOf)
    .filter((date): date is string => isFareStale(date))
    .sort()[0]

  return (
    <div className="backdrop min-h-dvh xl:min-h-full pb-10">
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

        {plan.pack && (
          <p data-testid="pack-version" className="px-1 text-xs text-on-deep/80 tabular-nums">
            {copy.about.packVersion(plan.pack.id, plan.pack.version)}
          </p>
        )}
        {staleDate && (
          <p data-testid="stale-warning" className="rounded-2xl border border-line-on-deep bg-black/15 px-4 py-2.5 text-sm">
            {copy.stale.long(staleDate, daysSince(staleDate) ?? 0)}
          </p>
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
            intent={intent}
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
