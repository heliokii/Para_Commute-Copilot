import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
// Imported for its side effect: seeds the sample pack on first load.
import './db/seed'
import { installNetMeter } from './lib/netMeter'
import { watchCrossOriginRequests } from './lib/proof'
import { registerServiceWorker } from './lib/swUpdate'
import { loadSettings } from './state/settings'

installNetMeter()
watchCrossOriginRequests()
registerServiceWorker()
void loadSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
