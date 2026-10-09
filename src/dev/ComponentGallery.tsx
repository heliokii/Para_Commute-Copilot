import { useState, type ReactNode } from 'react'
import { Banner } from '../components/Banner'
import { BottomSheet } from '../components/BottomSheet'
import { Bubble } from '../components/Bubble'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Chip } from '../components/Chip'
import { ProgressBar } from '../components/ProgressBar'
import { StatusPill } from '../components/StatusPill'
import { TopBar } from '../components/TopBar'
import { Tsupher, type TsupherState } from '../components/Tsupher'
import { backHref } from '../lib/nav'

// Dev-only: every shared component on one page, for review and screenshots.

const STATES: TsupherState[] = [
  'happy', 'thinking', 'map', 'thumbs-up', 'confused', 'sad',
  'sign', 'driving', 'luggage', 'jumping', 'love', 'excited',
]

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-sm font-semibold tracking-wide text-on-deep/80 uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function ComponentGallery() {
  const [chip, setChip] = useState('a')
  const [sheet, setSheet] = useState(false)

  return (
    <div className="backdrop min-h-full pb-10">
      <TopBar title="Components (dev only)" backHref={backHref()} right={<StatusPill />} />
      <div className="flex flex-col gap-5 px-4 pt-2">
        <Group title="Tsupher">
          <Card className="grid grid-cols-4 gap-2 p-3">
            {STATES.map((state) => (
              <figure key={state} className="flex flex-col items-center text-[0.65rem] text-ink-muted">
                <Tsupher state={state} size="md" />
                <figcaption>{state}</figcaption>
              </figure>
            ))}
          </Card>
        </Group>

        <Group title="Button">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
          <Card className="flex flex-wrap gap-2 p-3">
            <Button variant="dark">Dark</Button>
            <Button disabled>Disabled</Button>
          </Card>
        </Group>

        <Group title="Chip">
          <Card className="flex flex-wrap gap-2 p-3">
            {['a', 'b', 'c'].map((value) => (
              <Chip key={value} selected={chip === value} onClick={() => setChip(value)}>
                Chip {value.toUpperCase()}
              </Chip>
            ))}
          </Card>
        </Group>

        <Group title="Banner">
          <Banner title="Banner title" body="SAMPLE text for the banner body." art={<Tsupher state="sign" size="md" decorative />} />
        </Group>

        <Group title="ProgressBar">
          <Card className="p-4">
            <ProgressBar value={60} label="Sample progress" />
          </Card>
        </Group>

        <Group title="Bubble">
          <div className="flex flex-col gap-2">
            <Bubble from="user">SAMPLE: tanong ng user.</Bubble>
            <Bubble from="tsupher">SAMPLE: sagot ni Tsupher.</Bubble>
          </div>
        </Group>

        <Group title="BottomSheet">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open sheet
          </Button>
          <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Sheet title">
            <p className="mt-2 text-sm">SAMPLE sheet content.</p>
          </BottomSheet>
        </Group>
      </div>
    </div>
  )
}
