import { lazy, Suspense } from 'react'
import { useHashRoute } from './lib/hooks'
import { About } from './screens/About'
import { Home } from './screens/Home'

// Dev-only screen. The DEV check is static, so production builds drop the import.
const RouterHarness = import.meta.env.DEV ? lazy(() => import('./dev/RouterHarness')) : null

export default function App() {
  const route = useHashRoute()
  if (route === '/dev/router' && RouterHarness) {
    return (
      <Suspense fallback={null}>
        <RouterHarness />
      </Suspense>
    )
  }
  return route === '/about' ? <About /> : <Home />
}
