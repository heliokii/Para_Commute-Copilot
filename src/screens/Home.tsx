import { useEffect, useState, type FormEvent } from 'react'
import { peekModel, useModel } from '../ai/modelManager'
import { Banner } from '../components/Banner'
import { Card } from '../components/Card'
import { Chip } from '../components/Chip'
import { Icon, type IconName } from '../components/Icon'
import { RecentTrips } from '../components/RecentTrips'
import { StatusPill } from '../components/StatusPill'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { go, OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import { sendMessage } from '../state/chat'
import { asPlaceFavorite, useFavorites } from '../state/favorites'
import { landmarkName, setPlan, usePlan } from '../state/plan'
import { useRecents } from '../state/recents'

interface TileProps {
  icon: IconName
  title: string
  sub: string
  href?: string
  onClick?: () => void
  className?: string
}

function Tile({ icon, title, sub, href, onClick, className = '' }: TileProps) {
  const content = (
    <>
      <span className="flex size-11 items-center justify-center rounded-full bg-brown-mid text-surface-cream">
        <Icon name={icon} className="size-5.5" />
      </span>
      <span className="mt-3 block font-display text-lg leading-tight font-semibold">{title}</span>
      <span className="mt-0.5 block text-xs text-ink-muted">{sub}</span>
    </>
  )
  const classes = `surface block w-full rounded-card bg-surface-cream p-4 text-left text-ink-dark shadow-card ${className}`
  return href ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  )
}

export function Home() {
  const [query, setQuery] = useState('')
  const model = useModel()
  const plan = usePlan()
  const recents = useRecents()
  // Saved landmarks that the loaded route pack still has.
  const places = useFavorites().flatMap((favorite) => {
    const place = favorite.kind === 'place' ? asPlaceFavorite(favorite.payload) : null
    return place && plan.pack?.landmarks.some((landmark) => landmark.id === place.landmarkId) ? [place] : []
  })

  useEffect(() => {
    void peekModel()
  }, [])

  function ask(text: string) {
    go(OVERLAY_PATHS.chat)
    void sendMessage(text)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const text = query.trim()
    if (!text) return
    setQuery('')
    ask(text)
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* Wraps so the status pill drops below the wordmark when text is scaled up. */}
      {/* The dashboard sidebar carries the wordmark on wide screens. */}
      <header className="flex flex-wrap items-center gap-3 xl:justify-end">
        <img src="/icons/pwa-192.png" alt="" className="size-[48px] rounded-2xl border-2 border-white xl:hidden" />
        <div className="flex-1 leading-none xl:hidden">
          {/* Wordmark placeholder: live text until the wordmark art is exported. */}
          <p className="font-display text-3xl font-bold tracking-tight">{copy.app.name}</p>
          <p className="mt-0.5 font-display text-sm font-medium text-on-deep/85">
            {copy.app.subtitle}
          </p>
        </div>
        <StatusPill />
      </header>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold">{copy.home.greeting}</h1>
          <p className="mt-1 text-[0.95rem] leading-snug text-on-deep/90">{copy.home.intro}</p>
        </div>
        <Tsupher state="hero" size="lg" eager decorative bob className="-mb-2 xl:hidden" />
      </div>

      <Card className="p-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="ask" className="sr-only">
            {copy.home.promptLabel}
          </label>
          <textarea
            id="ask"
            rows={2}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder={copy.home.promptPlaceholder}
            enterKeyHint="go"
            className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-base text-ink-dark outline-none placeholder:text-ink-muted"
          />
          <button
            type="submit"
            aria-label={copy.home.promptSubmit}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brown-mid text-surface-cream"
          >
            <Icon name="send" />
          </button>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Tile
          icon="pin"
          title={copy.home.planTitle}
          sub={copy.home.planSub}
          href={`#${TAB_PATHS.ruta}`}
        />
        <Tile
          icon="chat"
          title={copy.home.chatTitle}
          sub={copy.home.chatSub}
          href={`#${OVERLAY_PATHS.chat}`}
        />
        <Tile
          icon="star"
          title={copy.home.savedTitle}
          sub={copy.home.savedSub}
          href={`#${TAB_PATHS.paborito}`}
          // Dashboard only: on a phone Paborito is one tap away in the bottom nav.
          className="hidden xl:block"
        />
      </div>

      {model.status === 'absent' && (
        <Banner
          title={copy.setup.homeTitle}
          body={copy.setup.homeBody}
          href={`#${OVERLAY_PATHS.setup}`}
          art={<Tsupher state="driving" size="md" decorative />}
        />
      )}

      {/* The dashboard sidebar carries this card on wide screens. */}
      <div className="xl:hidden">
        <Banner
          title={copy.home.offlineTitle}
          body={copy.home.offlineBody}
          href={`#${OVERLAY_PATHS.offline}`}
          art={<Tsupher state="thumbs-up" size="md" decorative />}
        />
      </div>

      <Banner
        title={copy.home.tipTitle}
        body={copy.home.tipBody}
        href={`#${OVERLAY_PATHS.modes}`}
        art={<Tsupher state="happy" size="md" decorative />}
      />

      {places.length > 0 && (
        <section>
          <h2 className="px-1 font-display text-lg font-semibold">{copy.home.placesTitle}</h2>
          <Card className="mt-2 flex flex-wrap gap-2 p-3">
            {places.map((place) => (
              <Chip
                key={place.landmarkId}
                onClick={() => {
                  setPlan({ destinationId: place.landmarkId })
                  go(TAB_PATHS.ruta)
                }}
              >
                <Icon name="pin" className="size-4.5 text-brown-mid" />
                {landmarkName(plan.pack, place.landmarkId)}
              </Chip>
            ))}
          </Card>
        </section>
      )}

      {recents.length > 0 && (
        <section>
          <h2 className="px-1 font-display text-lg font-semibold">{copy.paborito.recent}</h2>
          <p className="px-1 text-xs text-on-deep/80">{copy.paborito.recentNote}</p>
          <Card className="mt-2">
            <RecentTrips pack={plan.pack} recents={recents} />
          </Card>
        </section>
      )}
    </div>
  )
}
