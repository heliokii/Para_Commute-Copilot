import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
// Imported for its side effect: seeds the sample pack on first load.
import './db/seed'
import { installNetMeter } from './lib/netMeter'

installNetMeter()
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
