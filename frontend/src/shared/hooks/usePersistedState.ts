import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Drop-in replacement for `useState` that persists the value to localStorage.
 *
 * - Reads the initial value from storage (falls back to `defaultValue`).
 * - Writes every update synchronously inside the state updater (no stale writes).
 * - Handles dynamic key changes by re-reading from the new key.
 *
 * @param key Unique localStorage key (e.g. `'refleks.benchmarks.sortBy'`).
 * @param defaultValue Fallback when the key doesn't exist in storage.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, rawSetValue] = useState<T>(() =>
    readStorage(key, defaultValue),
  );
  const keyRef = useRef(key);
  const defaultValueRef = useRef(defaultValue);

  defaultValueRef.current = defaultValue;

  // When the key changes (rare – e.g. dynamic key from props), re-read from the new key.
  // Keep this in an effect to avoid scheduling state updates during render.
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    rawSetValue(readStorage(key, defaultValueRef.current));
  }, [key]);

  // Wrap setter: persist synchronously inside the state updater so the value
  // written to localStorage is always consistent with React state.
  const setValue: Dispatch<SetStateAction<T>> = useCallback((action) => {
    rawSetValue((prev) => {
      const next =
        typeof action === "function" ? (action as (p: T) => T)(prev) : action;
      try {
        localStorage.setItem(keyRef.current, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);

  return [value, setValue];
}
