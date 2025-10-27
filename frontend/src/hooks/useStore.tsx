import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import type { Session } from '../types/domain'
import type { ScenarioRecord } from '../types/ipc'

type State = {
  scenarios: ScenarioRecord[]
  newScenarios: number
  sessions: Session[]
  sessionGapMinutes: number
}

type Action =
  | { type: 'set'; items: ScenarioRecord[] }
  | { type: 'add'; item: ScenarioRecord }
  | { type: 'update'; item: ScenarioRecord }
  | { type: 'incNew' }
  | { type: 'resetNew' }
  | { type: 'setGap'; minutes: number }

const initial: State = { scenarios: [], newScenarios: 0, sessions: [], sessionGapMinutes: 30 }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return { ...state, scenarios: action.items ?? [], sessions: groupSessions(action.items ?? [], state.sessionGapMinutes) }
    case 'add':
      return { ...state, scenarios: [action.item, ...state.scenarios], sessions: groupSessions([action.item, ...state.scenarios], state.sessionGapMinutes) }
    case 'update': {
      const idx = state.scenarios.findIndex(s => s.filePath === action.item.filePath)
      if (idx === -1) {
        // if unknown, append without incrementing newScenarios
        const next = [action.item, ...state.scenarios]
        return { ...state, scenarios: next, sessions: groupSessions(next, state.sessionGapMinutes) }
      }
      const next = [...state.scenarios]
      next[idx] = action.item
      return { ...state, scenarios: next, sessions: groupSessions(next, state.sessionGapMinutes) }
    }
    case 'incNew':
      return { ...state, newScenarios: state.newScenarios + 1 }
    case 'resetNew':
      return { ...state, newScenarios: 0 }
    case 'setGap':
      return { ...state, sessionGapMinutes: Math.max(1, Math.floor(action.minutes)), sessions: groupSessions(state.scenarios, Math.max(1, Math.floor(action.minutes))) }
    default:
      return state
  }
}

type Ctx = State & {
  setScenarios: (items: ScenarioRecord[]) => void
  addScenario: (item: ScenarioRecord) => void
  updateScenario: (item: ScenarioRecord) => void
  incNew: () => void
  resetNew: () => void
  setSessionGap: (minutes: number) => void
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)

  // Stable callbacks so consumers can safely depend on their identity
  const setScenarios = useCallback((items: ScenarioRecord[]) => dispatch({ type: 'set', items }), [dispatch])
  const addScenario = useCallback((item: ScenarioRecord) => dispatch({ type: 'add', item }), [dispatch])
  const updateScenario = useCallback((item: ScenarioRecord) => dispatch({ type: 'update', item }), [dispatch])
  const incNew = useCallback(() => dispatch({ type: 'incNew' }), [dispatch])
  const resetNew = useCallback(() => dispatch({ type: 'resetNew' }), [dispatch])
  const setSessionGap = useCallback((minutes: number) => dispatch({ type: 'setGap', minutes }), [dispatch])

  const value = useMemo<Ctx>(() => ({
    ...state,
    setScenarios,
    addScenario,
    updateScenario,
    incNew,
    resetNew,
    setSessionGap,
  }), [state, setScenarios, addScenario, updateScenario, incNew, resetNew, setSessionGap])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore<T>(selector: (s: Ctx) => T): T {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('StoreProvider missing')
  return selector(ctx)
}

// --- Helpers ---
function groupSessions(items: ScenarioRecord[], gapMinutes = 30): Session[] {
  if (!Array.isArray(items) || items.length === 0) return []
  // Ensure newest first
  const sorted = [...items].sort((a, b) => endTs(b) - endTs(a))
  const sessions: Session[] = []
  let current: Session | null = null
  for (const it of sorted) {
    const t = endTs(it)
    if (!current) {
      current = { id: `sess-${t}`, start: startIso(it), end: endIso(it), items: [it] }
      sessions.push(current)
      continue
    }
    const last = current.items[current.items.length - 1]
    const dt = Math.abs(endTs(last) - t)
    if (dt <= gapMinutes * 60 * 1000) {
      current.items.push(it)
      // Maintain session bounds: start = earliest scenario start, end = latest scenario end
      const curStartMs = Date.parse(current.start)
      const curEndMs = Date.parse(current.end)
      const itStartMs = startTs(it)
      const itEndMs = endTs(it)
      current.start = curStartMs <= itStartMs ? current.start : startIso(it)
      current.end = curEndMs >= itEndMs ? current.end : endIso(it)
    } else {
      current = { id: `sess-${t}`, start: startIso(it), end: endIso(it), items: [it] }
      sessions.push(current)
    }
  }
  return sessions
}

// --- Timestamp helpers (simplified: fixed keys, no fallbacks) ---
function endIso(s: ScenarioRecord): string {
  return s.stats['Date Played'] as string
}
function endTs(s: ScenarioRecord): number {
  return Date.parse(endIso(s))
}
function startIso(s: ScenarioRecord): string {
  const end = endIso(s)
  const datePart = end.split('T')[0]
  const time = s.stats['Challenge Start'] as string
  return `${datePart}T${time}Z`
}
function startTs(s: ScenarioRecord): number {
  return Date.parse(startIso(s))
}
