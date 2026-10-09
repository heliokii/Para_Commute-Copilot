import { copy } from '../copy'
import type { Intent, RoutePack } from '../router/types.ts'
import { hasAvoid, knows, landmarkName, openTrip } from '../state/plan'
import type { Recent } from '../state/recents'
import { Badge } from './Badge'
import { FavoriteToggle } from './FavoriteToggle'

export function TripLine({ pack, intent }: { pack: RoutePack | null; intent: Intent }) {
  return (
    <>
      {landmarkName(pack, intent.originId)}
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> papuntang </span>
      {landmarkName(pack, intent.destinationId)}
    </>
  )
}

interface RecentTripsProps {
  pack: RoutePack | null
  recents: Recent[]
  /** Row test id. Set on one screen only, so the e2e counts stay honest. */
  testId?: string
}

/** "Kamakailang Hinanap" rows, shared by Home and Paborito. */
export function RecentTrips({ pack, recents, testId }: RecentTripsProps) {
  return (
    <ul className="divide-y divide-line">
      {recents.map((recent) => (
        <li key={recent.key} data-testid={testId} className="flex items-center gap-1 py-1 pl-4 pr-2">
          <button type="button" disabled={!knows(pack, recent.intent)} onClick={() => void openTrip(recent.intent)} className="min-h-12 min-w-0 flex-1 text-left disabled:opacity-60">
            <span className="block font-semibold">
              <TripLine pack={pack} intent={recent.intent} />
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge>{copy.pref[recent.intent.preference]}</Badge>
              {hasAvoid(recent.intent) && <Badge tone="caution">{copy.badge.simulated}</Badge>}
            </span>
          </button>
          <FavoriteToggle intent={recent.intent} pack={pack} />
        </li>
      ))}
    </ul>
  )
}
