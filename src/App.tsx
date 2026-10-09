import { useHashRoute } from './lib/hooks'
import { About } from './screens/About'
import { Home } from './screens/Home'

export default function App() {
  const route = useHashRoute()
  return route === '/about' ? <About /> : <Home />
}
