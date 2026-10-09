import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

/**
 * Re-reads an IndexedDB query whenever its tables change, here or in another tab.
 * `query` must be a stable function (declare it at module level).
 */
export function useLive<T>(query: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (error) => console.error('Local data query failed', error),
    })
    return () => subscription.unsubscribe()
  }, [query])
  return value
}
