import { useEffect, useRef, useState } from 'react'

// Centralized UI-state persistence for the app.
// Use this for view-layer preferences (selected tabs, panel sizes, toggles).
// Domain data (scenarios, sessions, etc.) stays in store/store.tsx.

export function useUIState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) return JSON.parse(raw) as T
    } catch { }
    return initial
  })
  const prevKeyRef = useRef(key)

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch { }
  }, [key, state])

  // If the key changes (dynamic keys), reinitialize from storage (or initial)
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key
      try {
        const raw = localStorage.getItem(key)
        if (raw != null) setState(JSON.parse(raw) as T)
        else setState(initial)
      } catch { /* ignore */ }
    }
  }, [key, initial])

  return [state, setState] as const
}
