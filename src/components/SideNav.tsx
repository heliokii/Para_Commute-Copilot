import { copy } from '../copy'
import { NAV_ITEMS, OVERLAY_PATHS, TAB_PATHS, type Tab } from '../lib/nav'
import { Icon } from './Icon'
import { Tsupher } from './Tsupher'

/** Dashboard sidebar. Replaces the bottom nav on wide screens. */
export function SideNav({ active }: { active: Tab }) {
  return (
    <nav
      aria-label={copy.nav.label}
      className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto text-on-deep"
    >
      <div className="px-3 pt-2 leading-none">
        {/* Wordmark placeholder: live text until the wordmark art is exported. */}
        <p className="font-display text-5xl font-bold tracking-tight">{copy.app.name}</p>
        <p className="mt-1 font-display font-medium text-on-deep/85">{copy.app.subtitle}</p>
      </div>

      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const current = item.tab === active
          return (
            <li key={item.tab}>
              <a
                href={`#${TAB_PATHS[item.tab]}`}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-2xl px-4 font-display font-semibold ${current ? 'bg-accent-amber text-ink-dark' : ''}`}
              >
                <Icon name={item.icon} className="size-5.5" />
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>

      <a
        href={`#${OVERLAY_PATHS.offline}`}
        className="rounded-card border border-line-on-deep bg-black/15 p-4"
      >
        <span className="flex items-center gap-2 font-display font-semibold">
          <Icon name="wifi-off" className="size-5" />
          {copy.home.offlineTitle}
        </span>
        <span className="mt-1 block text-sm text-on-deep/85">{copy.home.offlineBody}</span>
      </a>

      <Tsupher state="hero" size="xl" eager decorative className="mt-auto self-center" />
    </nav>
  )
}
