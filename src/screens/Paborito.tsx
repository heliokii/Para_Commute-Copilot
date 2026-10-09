import { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { HeartButton } from '../components/HeartButton'
import { Icon } from '../components/Icon'
import { LandmarkPicker } from '../components/LandmarkPicker'
import { TopBar } from '../components/TopBar'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { FavoriteToggle } from '../components/FavoriteToggle'
import { go, OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import type { Intent, RoutePack } from '../router/types.ts'
import {
  asPlaceFavorite,
  asRouteFavorite,
  toggleRoute,
  togglePlaceFavorite,
  useFavorites,
  type RouteFavorite,
} from '../state/favorites'
import { ensurePack, landmarkName, openIntent, setPlan, usePlan } from '../state/plan'
import { useRecents } from '../state/recents'
import { showToast } from '../state/toast'

const hasAvoid = (intent: Intent) =>
  intent.avoid.landmarkIds.length + intent.avoid.routeIds.length + intent.avoid.modes.length + intent.avoid.tags.length > 0

function knows(pack: RoutePack | null, intent: Intent) {
  return Boolean(
    pack?.landmarks.some((landmark) => landmark.id === intent.originId) &&
      pack.landmarks.some((landmark) => landmark.id === intent.destinationId),
  )
}

/** Runs the router again for a saved or recent trip, then shows the results. */
async function openTrip(intent: Intent) {
  await openIntent(intent)
  go(OVERLAY_PATHS.results)
}

function TripLine({ pack, intent }: { pack: RoutePack | null; intent: Intent }) {
  return (
    <>
      {landmarkName(pack, intent.originId)}
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> papuntang </span>
      {landmarkName(pack, intent.destinationId)}
    </>
  )
}

function RouteRow({ favorite, pack }: { favorite: RouteFavorite; pack: RoutePack | null }) {
  const { intent } = favorite
  const known = knows(pack, intent)
  const savedOn = pack && favorite.packId === pack.id && favorite.packVersion !== pack.version
  return (
    <li className="flex items-center gap-1 py-2 pl-4 pr-2" data-testid="fav-route">
      <button
        type="button"
        disabled={!known}
        onClick={() => void openTrip(intent)}
        className="min-h-12 min-w-0 flex-1 text-left disabled:opacity-60"
      >
        <span className="block font-semibold">
          <TripLine pack={pack} intent={intent} />
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge>{copy.pref[intent.preference]}</Badge>
          {hasAvoid(intent) && <Badge tone="caution">{copy.badge.simulated}</Badge>}
        </span>
        {!known && <span className="mt-1 block text-xs text-ink-muted">{copy.paborito.missing}</span>}
        {known && savedOn && <span className="mt-1 block text-xs text-ink-muted">{copy.paborito.otherPack(favorite.packVersion)}</span>}
      </button>
      <HeartButton
        saved
        testId="fav-route-remove"
        label={copy.fav.removeRoute}
        onToggle={() => void toggleRoute(intent, pack)}
      />
    </li>
  )
}

function AddressTab({ pack }: { pack: RoutePack | null }) {
  const favorites = useFavorites()
  const [picked, setPicked] = useState('')
  const places = favorites.flatMap((favorite) => {
    const place = favorite.kind === 'place' ? asPlaceFavorite(favorite.payload) : null
    return place ? [place] : []
  })

  function chooseFor(field: 'originId' | 'destinationId', landmarkId: string) {
    setPlan({ [field]: landmarkId })
    go(TAB_PATHS.ruta)
  }

  return (
    <>
      <p className="px-4 pt-3 text-xs text-ink-muted">{copy.paborito.addressNote}</p>
      {pack && (
        <div className="px-4 pt-2 pb-3">
          <LandmarkPicker
            label={copy.paborito.addLabel}
            testId="fav-place-picker"
            landmarks={pack.landmarks}
            value={picked}
            onChange={(id) => {
              setPicked(id)
              void togglePlaceFavorite(id, pack.id).then((saved) => {
                if (saved) showToast(copy.fav.saved, 'love')
                setPicked('')
              })
            }}
          />
        </div>
      )}
      {places.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-muted">{copy.paborito.emptyAddress}</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {places.map((place) => {
            const name = landmarkName(pack, place.landmarkId)
            const known = pack?.landmarks.some((landmark) => landmark.id === place.landmarkId)
            return (
              <li key={place.landmarkId} data-testid="fav-place" className="flex items-center gap-1 py-2 pl-4 pr-2">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Icon name="pin" className="size-4.5 shrink-0 text-brown-mid" />
                    {name}
                  </span>
                  {known ? (
                    <span className="mt-1 flex flex-wrap gap-2">
                      <button type="button" onClick={() => chooseFor('originId', place.landmarkId)} className="min-h-11 rounded-full border border-line px-3 text-sm font-medium">
                        {copy.paborito.from}
                      </button>
                      <button type="button" onClick={() => chooseFor('destinationId', place.landmarkId)} className="min-h-11 rounded-full border border-line px-3 text-sm font-medium">
                        {copy.paborito.to}
                      </button>
                    </span>
                  ) : (
                    <span className="block text-xs text-ink-muted">{copy.paborito.missing}</span>
                  )}
                </span>
                <HeartButton
                  saved
                  testId="fav-place-remove"
                  label={copy.fav.removePlace(name)}
                  onToggle={() => void togglePlaceFavorite(place.landmarkId, place.packId)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export function Paborito() {
  const plan = usePlan()
  const favorites = useFavorites()
  const recents = useRecents()
  const [tab, setTab] = useState<'routes' | 'address'>('routes')

  useEffect(() => {
    void ensurePack()
  }, [])

  const routes = favorites.flatMap((favorite) => {
    const route = favorite.kind === 'route' ? asRouteFavorite(favorite.payload) : null
    return route ? [{ id: favorite.id, route }] : []
  })

  const tabClass = (active: boolean) =>
    `min-h-11 flex-1 rounded-full px-3 font-display font-semibold ${active ? 'bg-accent-amber text-ink-dark' : 'text-on-deep'}`

  return (
    <div>
      <TopBar title={copy.paborito.title} />
      <div className="flex flex-col gap-3 px-4 pt-2">
        <div role="tablist" aria-label={copy.paborito.tabsLabel} className="flex gap-1 rounded-full border border-line-on-deep bg-black/15 p-1">
          <button type="button" role="tab" id="fav-tab-routes" aria-selected={tab === 'routes'} aria-controls="fav-panel" data-testid="fav-tab-routes" onClick={() => setTab('routes')} className={tabClass(tab === 'routes')}>
            {copy.paborito.tabRoutes}
          </button>
          <button type="button" role="tab" id="fav-tab-address" aria-selected={tab === 'address'} aria-controls="fav-panel" data-testid="fav-tab-address" onClick={() => setTab('address')} className={tabClass(tab === 'address')}>
            {copy.paborito.tabAddress}
          </button>
        </div>

        <Card>
          <div role="tabpanel" id="fav-panel" aria-labelledby={tab === 'routes' ? 'fav-tab-routes' : 'fav-tab-address'}>
            {tab === 'routes' ? (
              routes.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-8 text-center" data-testid="fav-routes-empty">
                  <Tsupher state="love" size="lg" decorative />
                  <p className="mt-2 text-sm text-ink-muted">{copy.paborito.emptyRoutes}</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {routes.map(({ id, route }) => (
                    <RouteRow key={id} favorite={route} pack={plan.pack} />
                  ))}
                </ul>
              )
            ) : (
              <AddressTab pack={plan.pack} />
            )}
          </div>
        </Card>

        <h2 className="mt-1 px-1 font-display text-lg font-semibold">{copy.paborito.recent}</h2>
        <p className="-mt-2 px-1 text-xs text-on-deep/80">{copy.paborito.recentNote}</p>
        <Card>
          {recents.length === 0 ? (
            <p data-testid="recents-empty" className="px-4 py-4 text-sm text-ink-muted">
              {copy.paborito.recentEmpty}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recents.map((recent) => (
                <li key={recent.key} data-testid="recent" className="flex items-center gap-1 py-1 pl-4 pr-2">
                  <button type="button" disabled={!knows(plan.pack, recent.intent)} onClick={() => void openTrip(recent.intent)} className="min-h-12 min-w-0 flex-1 text-left disabled:opacity-60">
                    <span className="block font-semibold">
                      <TripLine pack={plan.pack} intent={recent.intent} />
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge>{copy.pref[recent.intent.preference]}</Badge>
                      {hasAvoid(recent.intent) && <Badge tone="caution">{copy.badge.simulated}</Badge>}
                    </span>
                  </button>
                  <FavoriteToggle intent={recent.intent} pack={plan.pack} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
