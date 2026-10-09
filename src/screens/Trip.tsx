import { useMemo } from 'react'
import { Banner } from '../components/Banner'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ProgressBar } from '../components/ProgressBar'
import { TopBar } from '../components/TopBar'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import { selectedResult, usePlan } from '../state/plan'
import { SIM_SPEEDS, buildTripLegs, distanceM } from '../trip/trip'
import { useTrip } from '../trip/useTrip'

const t = copy.trip

export function Trip() {
  const plan = usePlan()
  const result = selectedResult(plan)
  const legs = useMemo(
    () => (plan.pack && result ? buildTripLegs(plan.pack, result.legs) : []),
    [plan.pack, result],
  )
  const trip = useTrip(legs)
  const backHref = `#${OVERLAY_PATHS.detail}`

  if (legs.length === 0) {
    return (
      <div className="backdrop min-h-dvh">
        <TopBar title={t.title} backHref={`#${TAB_PATHS.ruta}`} />
        <div className="px-4 pt-2">
          <Card className="flex flex-col items-center px-6 py-8 text-center">
            <Tsupher state="map" size="lg" decorative />
            <p className="mt-3 text-sm text-ink-muted">{t.none}</p>
          </Card>
        </div>
      </div>
    )
  }

  if (trip.source === 'ask') {
    return (
      <div className="backdrop min-h-dvh">
        <TopBar title={t.title} backHref={backHref} />
        <div className="flex flex-col gap-3 px-4 pt-2">
          <Card className="flex flex-col items-center px-6 py-8 text-center">
            <Tsupher state="luggage" size="lg" decorative />
            <h2 className="mt-4 font-display text-xl font-semibold">{t.consentTitle}</h2>
            <p className="mt-2 text-sm">{t.consentBody}</p>
            <p className="mt-2 text-sm text-ink-muted">{t.consentLimit}</p>
            {trip.problem && (
              <p role="alert" data-testid="trip-problem" className="mt-3 text-sm font-semibold">
                {t[trip.problem]}
              </p>
            )}
            <Button className="mt-5 w-full" data-testid="trip-use-gps" onClick={() => trip.start('gps')}>
              {t.useGps}
            </Button>
            <Button variant="dark" className="mt-2 w-full" data-testid="trip-use-sim" onClick={() => trip.start('sim')}>
              {t.useSim}
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  if (trip.state.done) {
    return (
      <div className="backdrop min-h-dvh">
        <TopBar title={t.title} />
        <div className="flex flex-col gap-3 px-4 pt-2">
          {trip.source === 'sim' && <SimBanner />}
          <Card className="flex flex-col items-center px-6 py-8 text-center" data-testid="trip-done">
            <Tsupher state="excited" size="lg" decorative bob />
            <h2 className="mt-4 font-display text-xl font-semibold">{t.doneTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t.doneBody}</p>
            <Button variant="dark" className="mt-5" onClick={trip.stop}>
              {t.finish}
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  const { legIndex, stopIndex } = trip.state
  const leg = legs[legIndex]
  const straight = distanceM(leg.board, leg.alight)
  const legFraction = trip.distanceM === null || straight === 0 ? 0 : 1 - trip.distanceM / straight
  const percent = ((legIndex + Math.min(Math.max(legFraction, 0), 1)) / legs.length) * 100
  const alertLeg = trip.alert ? legs[trip.alert.legIndex] : null
  const status = trip.weakAccuracy !== null ? t.weakSignal(trip.weakAccuracy) : trip.distanceM === null ? t.waiting : null

  return (
    <div className="backdrop min-h-dvh pb-10">
      <TopBar title={t.title} />
      <div className="flex flex-col gap-3 px-4 pt-2">
        {trip.source === 'sim' && <SimBanner />}

        <Card className="p-4">
          <p className="text-sm font-semibold text-ink-muted">{t.leg(legIndex + 1, legs.length)}</p>
          <h2 className="mt-0.5 font-display text-xl leading-tight font-semibold" data-testid="trip-leg">
            {leg.mode === 'walk' ? t.walkTo(leg.alightName) : t.alightAt(leg.alightName)}
          </h2>
          <p className="mt-1 text-sm">
            {t.board}: {leg.boardName}
          </p>
          <p className="text-sm" data-testid="trip-next">
            {t.nextLandmark}: {leg.stops[stopIndex].name}
          </p>
          <p className="mt-3 text-sm text-ink-muted">{t.toAlight}</p>
          <p className="font-display text-4xl font-semibold tabular-nums" data-testid="trip-distance">
            {trip.distanceM === null ? '—' : t.meters(trip.distanceM)}
          </p>
          {status && (
            <p role="status" className="mt-1 text-sm text-ink-muted">
              {status}
            </p>
          )}
          <ProgressBar className="mt-3" value={percent} label={t.progress} />
          <Button className="mt-4 w-full" data-testid="trip-alighted" onClick={trip.nakababa}>
            {t.alighted}
          </Button>
        </Card>

        {trip.source === 'sim' && (
          <Card tone="warm" className="p-4">
            <p className="text-sm font-semibold">{t.simSpeed}</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t.simSpeed}>
              {SIM_SPEEDS.map((kmh) => (
                <button
                  key={kmh}
                  type="button"
                  role="radio"
                  aria-checked={trip.simKmh === kmh}
                  data-testid={`trip-speed-${kmh}`}
                  onClick={() => trip.setSimKmh(kmh)}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
                    trip.simKmh === kmh ? 'bg-brown-mid text-surface-cream' : 'border-2 border-brown-mid text-ink-dark'
                  }`}
                >
                  {t.simSpeedLabel(kmh)}
                </button>
              ))}
            </div>
          </Card>
        )}

        <p className="px-1 text-xs text-on-deep/80" data-testid="trip-awake">
          {trip.awake === false ? t.awakeOff : trip.awake ? t.awake : ''}
        </p>
        <Button variant="secondary" onClick={trip.stop}>
          {t.stop}
        </Button>
      </div>

      {trip.alert && alertLeg && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="trip-alert-title"
          data-testid="trip-alert"
          className="backdrop fixed inset-0 z-40 mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
        >
          {trip.source === 'sim' && <SimBanner />}
          <h2 id="trip-alert-title" className="font-display text-3xl font-semibold text-on-deep">
            {t.alertTitle}
          </h2>
          <p className="text-on-deep" data-testid="trip-alert-distance">
            {t.alertDistance(t.meters(trip.alert.meters), alertLeg.alightName)}
          </p>
          <div className="flex items-end gap-2">
            <Tsupher state="jumping" size="xl" decorative bob />
            <div className="surface mb-10 rounded-3xl rounded-bl-lg bg-surface-cream px-4 py-2 font-display text-xl font-semibold text-ink-dark shadow-card">
              {t.bubble}
            </div>
          </div>
          <Button className="w-full" autoFocus data-testid="trip-dismiss" onClick={trip.dismissAlert}>
            {t.dismiss}
          </Button>
        </div>
      )}
    </div>
  )
}

function SimBanner() {
  return (
    <div role="status" data-testid="sim-banner" className="w-full">
      <Banner title="Simulated GPS" body={t.simBanner} />
    </div>
  )
}
