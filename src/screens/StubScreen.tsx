import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { Tsupher, type TsupherState } from '../components/Tsupher'
import { copy } from '../copy'

interface StubScreenProps {
  title: string
  body: string
  sprite: TsupherState
}

/** Placeholder for tabs whose screens arrive in a later phase. */
export function StubScreen({ title, body, sprite }: StubScreenProps) {
  return (
    <div>
      <TopBar title={title} />
      <div className="px-4 pt-2">
        <Card className="flex flex-col items-center px-6 py-10 text-center">
          <Tsupher state={sprite} size="lg" decorative />
          <h2 className="mt-4 font-display text-xl font-semibold">{copy.stub.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{body}</p>
        </Card>
      </div>
    </div>
  )
}
