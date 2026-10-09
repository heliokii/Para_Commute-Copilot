import { useEffect, useState, type FormEvent } from 'react'
import { peekModel, useModel } from '../ai/modelManager'
import { Banner } from '../components/Banner'
import { Card } from '../components/Card'
import { Icon, type IconName } from '../components/Icon'
import { StatusPill } from '../components/StatusPill'
import { Tsupher } from '../components/Tsupher'
import { copy } from '../copy'
import { go, OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import { sendMessage } from '../state/chat'

interface TileProps {
  icon: IconName
  title: string
  sub: string
  href?: string
  onClick?: () => void
}

function Tile({ icon, title, sub, href, onClick }: TileProps) {
  const content = (
    <>
      <span className="flex size-11 items-center justify-center rounded-full bg-brown-mid text-surface-cream">
        <Icon name={icon} className="size-5.5" />
      </span>
      <span className="mt-3 block font-display text-lg leading-tight font-semibold">{title}</span>
      <span className="mt-0.5 block text-xs text-ink-muted">{sub}</span>
    </>
  )
  const classes =
    'surface block w-full rounded-card bg-surface-cream p-4 text-left text-ink-dark shadow-card'
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

  useEffect(() => {
    void peekModel()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const text = query.trim()
    if (!text) return
    setQuery('')
    go(OVERLAY_PATHS.chat)
    void sendMessage(text)
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <img src="/icons/pwa-192.png" alt="" className="size-12 rounded-2xl shadow-card" />
        <div className="min-w-0 flex-1 leading-none">
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
        <Tsupher state="hero" size="lg" eager decorative bob className="-mb-2" />
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
            type="button"
            aria-disabled="true"
            aria-label={copy.home.micDisabled}
            title={copy.home.micDisabled}
            className="flex size-12 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-brown-mid text-surface-cream opacity-50"
          >
            <Icon name="mic" />
          </button>
          <button type="submit" className="sr-only">
            {copy.home.promptSubmit}
          </button>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          icon="pin"
          title={copy.home.planTitle}
          sub={copy.home.planSub}
          href={`#${TAB_PATHS.ruta}`}
        />
        <Tile
          icon="chat"
          title={copy.home.voiceTitle}
          sub={`${copy.home.voiceSub}. ${copy.home.voiceSoon}.`}
          href={`#${OVERLAY_PATHS.chat}`}
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

      <Banner
        title={copy.home.offlineTitle}
        body={copy.home.offlineBody}
        href={`#${OVERLAY_PATHS.offline}`}
        art={<Tsupher state="thumbs-up" size="md" decorative />}
      />

    </div>
  )
}
