import { removeModel } from '../ai/modelManager'
import { db } from '../db/db.ts'
import { resetChat } from './chat'
import { resetPlan } from './plan'
import { clearRecents } from './recents'
import { resetSettingsInMemory } from './settings'

/** Forgets the conversation, the form, the last result and the recent searches. Saved things are not touched. */
export function resetSession() {
  resetChat()
  resetPlan()
  clearRecents()
}

/** Keys the app keeps in localStorage. They only remember the chosen models. */
const LOCAL_KEYS_PREFIX = 'para.'

export interface EraseOptions {
  /** Also delete the downloaded AI model. Off by default: they are large and need internet to get back. */
  models: boolean
}

/**
 * "Burahin lahat ng data": Paborito, saved settings and the contribution queue,
 * plus the session. The route pack and the offline copy of the app are not
 * personal data and stay, so the app keeps working.
 */
export async function eraseAllData({ models }: EraseOptions): Promise<void> {
  await db.transaction('rw', db.favorites, db.settings, db.contributions, async () => {
    await Promise.all([db.favorites.clear(), db.settings.clear(), db.contributions.clear()])
  })
  if (models) {
    await removeModel()
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(LOCAL_KEYS_PREFIX))
        .forEach((key) => localStorage.removeItem(key))
    } catch {
      // Storage blocked: nothing was stored there.
    }
  }
  resetSettingsInMemory()
  resetSession()
}
