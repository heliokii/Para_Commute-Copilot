import type { ReactNode } from 'react'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon, type IconName } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { copy } from '../copy'
import { backHref, OVERLAY_PATHS } from '../lib/nav'
import type { Weights } from '../router/types.ts'
import { setPlan, usePlan } from '../state/plan'

interface ToggleRowProps {
  icon: IconName
  label: string
  sub: string
  checked: boolean
  onChange: (checked: boolean) => void
  testId: string
  children?: ReactNode
}

function ToggleRow({ icon, label, sub, checked, onChange, testId, children }: ToggleRowProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-warm text-brown-mid">
          <Icon name={icon} className="size-5.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
          <p className="text-sm text-ink-muted">{sub}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          data-testid={testId}
          onClick={() => onChange(!checked)}
          className="flex h-11 w-14 shrink-0 items-center"
        >
          <span
            className={`flex h-7 w-full items-center rounded-full px-0.5 transition-colors ${checked ? 'bg-ok-green' : 'bg-ink-muted/50'}`}
          >
            <span
              className={`size-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-7' : ''}`}
            />
          </span>
          <span className="sr-only">{checked ? copy.modes.on : copy.modes.off}</span>
        </button>
      </div>
      {children}
    </Card>
  )
}

const SLIDERS: { key: keyof Weights; label: string }[] = [
  { key: 'fare', label: copy.modes.custom.fare },
  { key: 'minutes', label: copy.modes.custom.minutes },
  { key: 'transfers', label: copy.modes.custom.transfers },
]

export function Modes() {
  const plan = usePlan()
  const cheapOn = !plan.customEnabled && plan.preference === 'cheapest'

  return (
    <div className="backdrop min-h-dvh pb-10">
      <TopBar title={copy.modes.title} backHref={backHref()} />
      <div className="flex flex-col gap-3 px-4 pt-2">
        <p className="px-1 text-sm text-on-deep/90">{copy.modes.intro}</p>

        <ToggleRow
          icon="coins"
          testId="mode-cheap"
          {...copy.modes.cheap}
          checked={cheapOn}
          onChange={(on) =>
            setPlan(on ? { preference: 'cheapest', customEnabled: false } : { preference: 'fastest' })
          }
        />

        <ToggleRow
          icon="route"
          testId="mode-avoid-edsa"
          label={copy.modes.avoidEdsa.label}
          sub={copy.modes.avoidEdsa.sub}
          checked={plan.avoidEdsa}
          onChange={(avoidEdsa) => setPlan({ avoidEdsa })}
        >
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Badge tone="caution">{copy.badge.simulated}</Badge>
            {copy.modes.avoidEdsa.note}
          </p>
        </ToggleRow>

        <ToggleRow
          icon="sliders"
          testId="mode-custom"
          label={copy.modes.custom.label}
          sub={copy.modes.custom.sub}
          checked={plan.customEnabled}
          onChange={(customEnabled) => setPlan({ customEnabled })}
        >
          {plan.customEnabled && (
            <div className="mt-3 flex flex-col gap-3">
              {SLIDERS.map(({ key, label }) => (
                <label key={key} className="block text-sm font-medium">
                  <span className="flex justify-between">
                    {label}
                    <span className="text-ink-muted tabular-nums">
                      {copy.modes.custom.scale(plan.weights[key])}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={plan.weights[key]}
                    data-testid={`weight-${key}`}
                    onChange={(event) =>
                      setPlan({ weights: { ...plan.weights, [key]: Number(event.target.value) } })
                    }
                    className="mt-1 h-11 w-full accent-brown-mid"
                  />
                </label>
              ))}
            </div>
          )}
        </ToggleRow>

        <Card>
          <a href={`#${OVERLAY_PATHS.settings}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <Icon name="globe" className="size-5.5 text-brown-mid" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{copy.higit.settings.label}</span>
              <span className="block text-sm text-ink-muted">{copy.higit.settings.sub}</span>
            </span>
            <Icon name="chevron-right" className="size-5 shrink-0 text-ink-muted" />
          </a>
        </Card>

        <Button href={backHref()} className="mt-2">
          {copy.modes.done}
        </Button>
      </div>
    </div>
  )
}
