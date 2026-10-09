import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { OVERLAY_PATHS } from '../lib/nav'

/** Placeholder. Trip mode is built in Phase 8. */
export function Trip() {
  const backHref = `#${OVERLAY_PATHS.detail}`
  return (
    <div className="backdrop min-h-dvh">
      <TopBar title={copy.trip.title} backHref={backHref} />
      <div className="px-4 pt-2">
        <Card className="flex flex-col items-center px-6 py-10 text-center">
          <Tsupher state="luggage" size="lg" decorative />
          <h2 className="mt-4 font-display text-xl font-semibold">{copy.stub.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{copy.trip.body}</p>
          <Button href={backHref} variant="dark" className="mt-5">
            {copy.trip.back}
          </Button>
        </Card>
      </div>
    </div>
  )
}
