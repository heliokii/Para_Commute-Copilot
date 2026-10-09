import { Card } from '../components/Card'
import { Icon, type IconName } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { copy } from '../copy'
import { OVERLAY_PATHS } from '../lib/nav'

interface Item {
  icon: IconName
  label: string
  sub: string
  /** Absent while the screen does not exist yet. */
  href?: string
}

const ITEMS: Item[] = [
  { icon: 'sliders', ...copy.higit.modes, href: `#${OVERLAY_PATHS.modes}` },
  { icon: 'wifi-off', ...copy.higit.offline, href: `#${OVERLAY_PATHS.offline}` },
  { icon: 'chat', label: copy.setup.title, sub: copy.setup.homeBody, href: `#${OVERLAY_PATHS.setup}` },
  { icon: 'globe', ...copy.higit.settings, href: `#${OVERLAY_PATHS.settings}` },
  { icon: 'info', ...copy.higit.about, href: `#${OVERLAY_PATHS.about}` },
  ...(import.meta.env.DEV
    ? [
        { icon: 'tools' as const, ...copy.higit.devRouter, href: `#${OVERLAY_PATHS['dev-router']}` },
        { icon: 'tools' as const, ...copy.higit.devComponents, href: `#${OVERLAY_PATHS['dev-components']}` },
        { icon: 'tools' as const, label: 'Model benchmark', sub: 'Dev only', href: `#${OVERLAY_PATHS['dev-bench']}` },
        { icon: 'tools' as const, label: 'Voice benchmark', sub: 'Dev only', href: `#${OVERLAY_PATHS['dev-voice']}` },
      ]
    : []),
]

function Row({ item }: { item: Item }) {
  const content = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-warm text-brown-mid">
        <Icon name={item.icon} className="size-5.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{item.label}</span>
        <span className="block text-sm text-ink-muted">{item.sub}</span>
      </span>
      {item.href ? (
        <Icon name="chevron-right" className="size-5 shrink-0 text-ink-muted" />
      ) : (
        <span className="shrink-0 rounded-full bg-surface-warm px-2.5 py-1 text-xs font-semibold">
          {copy.higit.soon}
        </span>
      )}
    </>
  )
  const classes = 'flex min-h-16 items-center gap-3 px-4 py-3'
  return item.href ? (
    <a href={item.href} className={classes}>
      {content}
    </a>
  ) : (
    <div aria-disabled="true" className={classes}>
      {content}
    </div>
  )
}

export function HigitPa() {
  return (
    <div>
      <TopBar title={copy.higit.title} />
      <div className="px-4 pt-2">
        <Card>
          <ul className="divide-y divide-line">
            {ITEMS.map((item) => (
              <li key={item.label}>
                <Row item={item} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
