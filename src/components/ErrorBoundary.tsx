import { Component, type ErrorInfo, type ReactNode } from 'react'
import { copy } from '../copy'
import { Button } from './Button'
import { Tsupher } from './Tsupher'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Catches render errors anywhere below it and offers a retry instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Local console only. Nothing is reported anywhere.
    console.error('Screen crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alert"
        className="backdrop flex min-h-dvh flex-col items-center justify-center px-8 text-center text-on-deep"
      >
        <Tsupher state="sad" size="lg" eager />
        <h1 className="mt-4 font-display text-2xl font-semibold">{copy.crash.title}</h1>
        <p className="mt-1 text-on-deep/90">{copy.crash.body}</p>
        <Button className="mt-6" onClick={() => this.setState({ failed: false })}>
          {copy.crash.retry}
        </Button>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => {
            location.hash = '#/'
            location.reload()
          }}
        >
          {copy.crash.home}
        </Button>
      </div>
    )
  }
}
