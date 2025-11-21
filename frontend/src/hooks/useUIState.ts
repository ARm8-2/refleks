import { useEffect, useRef, useState } from 'react'

// Centralized UI-state persistence for the app.
// Use this for view-layer preferences (selected tabs, panel sizes, toggles).
// Domain data (scenarios, sessions, etc.) stays in store/store.tsx.

export function useUIState<T>(key: string | undefined | null, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (!key) return initial
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) return JSON.parse(raw) as T
    } catch { }
    return initial
  })
  const prevKeyRef = useRef(key)

  useEffect(() => {
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch { }
  }, [key, state])

  // If the key changes (dynamic keys), reinitialize from storage (or initial)
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key
      if (key) {
        try {
          const raw = localStorage.getItem(key)
          if (raw != null) setState(JSON.parse(raw) as T)
          else setState(initial)
        } catch { /* ignore */ }
      } else {
        // If key becomes null, we might want to reset to initial or keep current.
        // Keeping current is safer for UI stability, but resetting to initial matches "new state".
        // Let's keep current state to avoid jarring jumps, or we could reset.
        // For now, let's just not force a reset if key disappears, effectively detaching persistence.
      }
    }
  }, [key, initial])

  return [state, setState] as const
}
