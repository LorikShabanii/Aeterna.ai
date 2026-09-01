import { useState } from 'react'

// Long enough for the envelope-seal animation (fold, wax, stamp) to finish
// playing before the overlay can be dismissed, even on an instant save.
const MIN_DISPLAY_MS = 1600

// Runs an async action while showing the sealing animation for at least
// MIN_DISPLAY_MS, even if the actual save finishes faster — otherwise a
// fast network round-trip makes it flash instead of read as a moment.
export function useSealing() {
  const [sealing, setSealing] = useState(false)

  async function runSealed<T>(action: () => Promise<T>): Promise<T> {
    setSealing(true)
    const started = Date.now()
    try {
      return await action()
    } finally {
      const elapsed = Date.now() - started
      const remaining = MIN_DISPLAY_MS - elapsed
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
      setSealing(false)
    }
  }

  return { sealing, runSealed }
}
