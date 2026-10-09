import { copy } from '../copy'
import { TAB_PATHS, type Tab } from '../lib/nav'
import { Icon, type IconName } from './Icon'

const ITEMS: { tab: Tab; icon: IconName; label: string }[] = [
  { tab: 'home', icon: 'home', label: copy.nav.home },
  { tab: 'ruta', icon: 'route', label: copy.nav.ruta },
  { tab: 'mapa', icon: 'map', label: copy.nav.mapa },
  { tab: 'paborito', icon: 'star', label: copy.nav.paborito },
  { tab: 'higit', icon: 'menu', label: copy.nav.higit },
]

export function BottomNav({ active }: { active: Tab }) {
  return (
    <nav
      aria-label={copy.nav.label}
      className="surface fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-card bg-surface-cream px-2 pb-[env(safe-area-inset-bottom)] text-ink-dark shadow-[0_-6px_20px_-10px_rgb(0_0_0/0.4)]"
    >
      <ul className="flex">
        {ITEMS.map((item) => {
          const current = item.tab === active
          return (
            <li key={item.tab} className="flex-1">
              <a
                href={`#${TAB_PATHS[item.tab]}`}
                aria-current={current ? 'page' : undefined}
                className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.7rem] font-medium"
              >
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${current ? 'bg-accent-amber' : ''}`}
                >
                  <Icon name={item.icon} className="size-5.5" />
                </span>
                <span className={current ? 'font-semibold' : 'text-ink-muted'}>{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
