import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { db } from './db/db'
import { installNetMeter } from './lib/netMeter'

installNetMeter()
registerSW({ immediate: true })

// Open early so the sample seed runs on first load.
db.open().catch((error) => console.error('ParaDB failed to open', error))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
