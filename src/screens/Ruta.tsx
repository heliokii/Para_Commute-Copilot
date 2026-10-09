import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Chip } from '../components/Chip'
import { Icon } from '../components/Icon'
import { LandmarkPicker } from '../components/LandmarkPicker'
import { TopBar } from '../components/TopBar'
import { copy } from '../copy'
import { go, OVERLAY_PATHS } from '../lib/nav'
import { ensurePack, searchRoutes, setPlan, usePlan, type StandardPreference } from '../state/plan'

const PREFERENCES: StandardPreference[] = ['cheapest', 'fastest', 'fewest_transfers']

export function Ruta() {
  const plan = usePlan()
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void ensurePack()
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!plan.originId || !plan.destinationId) {
      setNotice(copy.plan.needBoth)
      return
    }
    setNotice('')
    await searchRoutes()
    go(OVERLAY_PATHS.results)
  }

  return (
    <div>
      <TopBar
        title={copy.plan.title}
        right={
          <a
            href={`#${OVERLAY_PATHS.modes}`}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
          >
            <Icon name="sliders" className="size-5" />
            {copy.plan.modesLink}
          </a>
        }
      />
      <div className="px-4 pt-2">
        {plan.packError && <Card className="p-4 text-sm">{copy.plan.packError}</Card>}
        {!plan.pack && !plan.packError && (
          <p className="px-1 text-sm text-on-deep/85">{copy.plan.loading}</p>
        )}
        {plan.pack && (
          <Card className="p-4">
            {plan.pack.note && (
              <p className="mb-3">
                <Badge tone="caution">{copy.app.sampleData}</Badge>
              </p>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <LandmarkPicker
                    label={copy.plan.origin}
                    testId="origin"
                    landmarks={plan.pack.landmarks}
                    value={plan.originId}
                    onChange={(originId) => setPlan({ originId })}
                  />
                  <LandmarkPicker
                    label={copy.plan.destination}
                    testId="destination"
                    landmarks={plan.pack.landmarks}
                    value={plan.destinationId}
                    onChange={(destinationId) => setPlan({ destinationId })}
                  />
                </div>
                <button
                  type="button"
                  aria-label={copy.plan.swap}
                  onClick={() =>
                    setPlan({ originId: plan.destinationId, destinationId: plan.originId })
                  }
                  className="mb-8 flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-warm text-brown-mid"
                >
                  <Icon name="swap" className="size-5" />
                </button>
              </div>

              <fieldset>
                <legend className="text-sm font-semibold">{copy.plan.preference}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PREFERENCES.map((preference) => (
                    <Chip
                      key={preference}
                      selected={!plan.customEnabled && plan.preference === preference}
                      onClick={() => setPlan({ preference, customEnabled: false })}
                    >
                      {copy.pref[preference]}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              {(plan.avoidEdsa || plan.customEnabled) && (
                <p className="flex flex-wrap gap-2">
                  {plan.customEnabled && <Badge>{copy.plan.activeCustom}</Badge>}
                  {plan.avoidEdsa && <Badge tone="caution">{copy.plan.activeAvoid}</Badge>}
                </p>
              )}

              <Button type="submit" disabled={plan.status === 'searching'} className="w-full">
                {plan.status === 'searching' ? copy.plan.searching : copy.plan.search}
              </Button>
              <p aria-live="polite" className="text-sm text-ink-muted empty:hidden">
                {notice}
              </p>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
