import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { BottomNav } from './components/BottomNav'
import { copy } from './copy'
import { useRoute, type Overlay, type Tab } from './lib/nav'
import { About } from './screens/About'
import { Chat } from './screens/Chat'
import { Detail } from './screens/Detail'
import { HigitPa } from './screens/HigitPa'
import { Home } from './screens/Home'
import { Mapa } from './screens/Mapa'
import { Modes } from './screens/Modes'
import { OfflineMode } from './screens/OfflineMode'
import { Results } from './screens/Results'
import { Ruta } from './screens/Ruta'
import { Setup } from './screens/Setup'
import { Splash } from './screens/Splash'
import { StubScreen } from './screens/StubScreen'
import { Trip } from './screens/Trip'

// Dev-only screens. The DEV check is static, so production builds drop the imports.
const RouterHarness = import.meta.env.DEV ? lazy(() => import('./dev/RouterHarness')) : null
const ComponentGallery = import.meta.env.DEV ? lazy(() => import('./dev/ComponentGallery')) : null
const Bench = import.meta.env.DEV ? lazy(() => import('./dev/Bench')) : null

const TABS: Record<Tab, ReactNode> = {
  home: <Home />,
  ruta: <Ruta />,
  mapa: <Mapa />,
  paborito: <StubScreen title={copy.nav.paborito} body={copy.stub.paborito} sprite="love" />,
  higit: <HigitPa />,
}

function overlayScreen(overlay: Overlay): ReactNode {
  switch (overlay) {
    case 'results':
      return <Results />
    case 'detail':
      return <Detail />
    case 'trip':
      return <Trip />
    case 'modes':
      return <Modes />
    case 'chat':
      return <Chat />
    case 'setup':
      return <Setup />
    case 'offline':
      return <OfflineMode />
    case 'about':
      return <About />
    case 'dev-router':
      return RouterHarness ? <RouterHarness /> : null
    case 'dev-components':
      return ComponentGallery ? <ComponentGallery /> : null
    case 'dev-bench':
      return Bench ? <Bench /> : null
  }
}

// Module scope: the splash shows once per cold start, not on every navigation.
let splashSeen = false

export default function App() {
  const { tab, overlay } = useRoute()
  const [showSplash, setShowSplash] = useState(!splashSeen)
  const hideSplash = useCallback(() => {
    splashSeen = true
    setShowSplash(false)
  }, [])

  const overlayContent = overlay ? overlayScreen(overlay) : null

  return (
    <div className="backdrop relative mx-auto min-h-full max-w-md">
      {/* Every tab stays mounted so its state survives tab switches. */}
      {(Object.keys(TABS) as Tab[]).map((key) => (
        <main key={key} hidden={key !== tab || overlayContent !== null} className="pb-24">
          {TABS[key]}
        </main>
      ))}

      {overlayContent !== null ? (
        <div className="min-h-dvh">
          <Suspense fallback={null}>{overlayContent}</Suspense>
        </div>
      ) : (
        <BottomNav active={tab} />
      )}

      {showSplash && <Splash onDone={hideSplash} />}
    </div>
  )
}
