import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { BottomNav } from './components/BottomNav'
import { SideNav } from './components/SideNav'
import { Toast } from './components/Toast'
import { copy } from './copy'
import { useWide } from './lib/hooks'
import { useRoute, type Overlay, type Tab } from './lib/nav'
import { useUpdateReady } from './lib/swUpdate'
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
import { Paborito } from './screens/Paborito'
import { Settings } from './screens/Settings'
import { Splash } from './screens/Splash'
import { Trip } from './screens/Trip'

// Dev-only screens. The DEV check is static, so production builds drop the imports.
const RouterHarness = import.meta.env.DEV ? lazy(() => import('./dev/RouterHarness')) : null
const ComponentGallery = import.meta.env.DEV ? lazy(() => import('./dev/ComponentGallery')) : null
const Bench = import.meta.env.DEV ? lazy(() => import('./dev/Bench')) : null

const TABS: Record<Tab, ReactNode> = {
  home: <Home />,
  ruta: <Ruta />,
  mapa: <Mapa />,
  paborito: <Paborito />,
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
    case 'settings':
      return <Settings />
    case 'dev-router':
      return RouterHarness ? <RouterHarness /> : null
    case 'dev-components':
      return ComponentGallery ? <ComponentGallery /> : null
    case 'dev-bench':
      return Bench ? <Bench /> : null
  }
}

// Dashboard columns on wide screens: Home, then Ruta (or whatever is open), then Mapa.
const COLUMN: Record<Tab, string> = {
  home: 'xl:col-start-1',
  ruta: 'xl:col-start-2 xl:border-l xl:border-line',
  mapa: 'xl:col-start-3 xl:border-l xl:border-line',
  paborito: 'xl:col-start-2 xl:border-l xl:border-line',
  higit: 'xl:col-start-2 xl:border-l xl:border-line',
}

// Module scope: the splash shows once per cold start, not on every navigation.
let splashSeen = false

export default function App() {
  const { tab, overlay } = useRoute()
  const wide = useWide()
  const [showSplash, setShowSplash] = useState(!splashSeen)
  const hideSplash = useCallback(() => {
    splashSeen = true
    setShowSplash(false)
  }, [])

  const overlayContent = overlay ? overlayScreen(overlay) : null
  const applyUpdate = useUpdateReady()
  // Never offer a reload on top of a conversation; it waits until the rider leaves the chat.
  const showUpdate = applyUpdate !== null && overlay !== 'chat'
  // Wide: Home and Mapa always show; the middle column holds the overlay or one other tab.
  const center: Tab = tab === 'paborito' || tab === 'higit' ? tab : 'ruta'
  const shown = (key: Tab) =>
    wide
      ? key === 'home' || key === 'mapa' || (key === center && overlayContent === null)
      : key === tab && overlayContent === null

  return (
    <div className="backdrop relative mx-auto min-h-full max-w-md xl:flex xl:h-dvh xl:max-w-none xl:gap-4 xl:p-4">
      {wide && <SideNav active={tab} />}

      <div className="panel xl:grid xl:min-w-0 xl:flex-1 xl:grid-cols-[1.15fr_1fr_1fr] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden xl:rounded-card">
        {/* Every tab stays mounted so its state survives tab switches. */}
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <main
            key={key}
            hidden={!shown(key)}
            className={`pb-24 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto xl:pb-6 ${COLUMN[key]}`}
          >
            {TABS[key]}
          </main>
        ))}

        {overlayContent !== null && (
          <div className="min-h-dvh xl:col-start-2 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto xl:border-l xl:border-line">
            <Suspense fallback={null}>{overlayContent}</Suspense>
          </div>
        )}
      </div>

      {overlayContent === null && !wide && <BottomNav active={tab} />}

      {showUpdate && (
        <div
          role="status"
          data-testid="update-banner"
          className="surface fixed inset-x-0 top-0 z-30 mx-auto flex max-w-md items-center gap-3 rounded-b-card bg-surface-warm px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-ink-dark shadow-card"
        >
          <span className="min-w-0 flex-1 text-sm font-semibold">{copy.update.title}</span>
          <button
            type="button"
            onClick={() => void applyUpdate()}
            className="min-h-11 rounded-full bg-brown-mid px-4 text-sm font-semibold text-surface-cream"
          >
            {copy.update.action}
          </button>
        </div>
      )}

      <Toast />

      {showSplash && <Splash onDone={hideSplash} />}
    </div>
  )
}
