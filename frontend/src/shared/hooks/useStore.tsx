import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import { saveSessionNote } from '../lib/api'
import type { Session } from '../types/domain'
import type { ScenarioRecord } from '../types/ipc'

type State = {
  sessions: Session[]
  newScenarios: number
  sessionGapMinutes: number
  sessionNotes: Record<string, { name: string; notes: string }>
}

type Action =
  | { type: 'set'; items: ScenarioRecord[] }
  | { type: 'add'; item: ScenarioRecord }
  | { type: 'update'; item: ScenarioRecord }
  | { type: 'incNew' }
  | { type: 'resetNew' }
  | { type: 'setGap'; minutes: number }
  | { type: 'setSessionNotes'; notes: Record<string, { name: string; notes: string }> }
  | { type: 'updateSessionNote'; id: string; name: string; notes: string }

const initial: State = { sessions: [], newScenarios: 0, sessionGapMinutes: 30, sessionNotes: {} }

// Helper to extract all scenarios from sessions (newest first)
function getAllScenariosFromSessions(sessions: Session[]): ScenarioRecord[] {
  return sessions.flatMap(s => s.items)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return { ...state, sessions: groupSessions(action.items ?? [], state.sessionGapMinutes, state.sessionNotes) }
    case 'add': {
      // Get current scenarios, prepend new one, regroup
      const currentScenarios = getAllScenariosFromSessions(state.sessions)
      const next = [action.item, ...currentScenarios]
      return { ...state, sessions: groupSessions(next, state.sessionGapMinutes, state.sessionNotes) }
    }
    case 'update': {
      const currentScenarios = getAllScenariosFromSessions(state.sessions)
      const idx = currentScenarios.findIndex(s => s.filePath === action.item.filePath)
      if (idx === -1) {
        // if unknown, prepend without incrementing newScenarios
        const next = [action.item, ...currentScenarios]
        return { ...state, sessions: groupSessions(next, state.sessionGapMinutes, state.sessionNotes) }
      }
      const next = [...currentScenarios]
      next[idx] = action.item
      return { ...state, sessions: groupSessions(next, state.sessionGapMinutes, state.sessionNotes) }
    }
    case 'incNew':
      return { ...state, newScenarios: state.newScenarios + 1 }
    case 'resetNew':
      return { ...state, newScenarios: 0 }
    case 'setGap': {
      const currentScenarios = getAllScenariosFromSessions(state.sessions)
      const gap = Math.max(1, Math.floor(action.minutes))
      return { ...state, sessionGapMinutes: gap, sessions: groupSessions(currentScenarios, gap, state.sessionNotes) }
    }
    case 'setSessionNotes': {
      const currentScenarios = getAllScenariosFromSessions(state.sessions)
      return { ...state, sessionNotes: action.notes, sessions: groupSessions(currentScenarios, state.sessionGapMinutes, action.notes) }
    }
    case 'updateSessionNote': {
      const nextNotes = { ...state.sessionNotes, [action.id]: { name: action.name, notes: action.notes } }
      const currentScenarios = getAllScenariosFromSessions(state.sessions)
      return { ...state, sessionNotes: nextNotes, sessions: groupSessions(currentScenarios, state.sessionGapMinutes, nextNotes) }
    }
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
  setSessionNotes: (notes: Record<string, { name: string; notes: string }>) => void
  saveSessionNote: (id: string, name: string, notes: string) => Promise<void>
  isInSession: boolean
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)

  // Stable callbacks so consumers can safely depend on their identity
  const setScenarios = useCallback((items: ScenarioRecord[]) => dispatch({ type: 'set', items }), [dispatch])
  const addScenario = useCallback((item: ScenarioRecord) => dispatch({ type: 'add', item }), [dispatch])
  const updateScenario = useCallback((item: ScenarioRecord) => dispatch({ type: 'update', item }), [dispatch])
  const incNew = useCallback(() => dispatch({ type: 'incNew' }), [dispatch])
  const resetNew = useCallback(() => dispatch({ type: 'resetNew' }), [dispatch])
  const setSessionGap = useCallback((minutes: number) => dispatch({ type: 'setGap', minutes }), [dispatch])
  const setSessionNotes = useCallback((notes: Record<string, { name: string; notes: string }>) => dispatch({ type: 'setSessionNotes', notes }), [dispatch])

  const saveSessionNoteAction = useCallback(async (id: string, name: string, notes: string) => {
    await saveSessionNote(id, name, notes)
    dispatch({ type: 'updateSessionNote', id, name, notes })
  }, [dispatch])

  const isInSession = useMemo(() => {
    if (state.sessions.length === 0) return false
    // sessions are sorted newest first
    const lastSession = state.sessions[0]
    const lastEnd = new Date(lastSession.end).getTime()
    const now = Date.now()
    return (now - lastEnd) < (state.sessionGapMinutes * 60 * 1000)
  }, [state.sessions, state.sessionGapMinutes])

  const value = useMemo<Ctx>(() => ({
    ...state,
    setScenarios,
    addScenario,
    updateScenario,
    incNew,
    resetNew,
    setSessionGap,
    setSessionNotes,
    saveSessionNote: saveSessionNoteAction,
    isInSession,
  }), [state, setScenarios, addScenario, updateScenario, incNew, resetNew, setSessionGap, setSessionNotes, saveSessionNoteAction, isInSession])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore<T>(selector: (s: Ctx) => T): T {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('StoreProvider missing')
  return selector(ctx)
}

// --- Helpers ---
function groupSessions(items: ScenarioRecord[], gapMinutes = 30, notes: Record<string, { name: string; notes: string }> = {}): Session[] {
  if (!Array.isArray(items) || items.length === 0) return []

  // Optimization: Items are maintained in sorted order (newest first) by the store.
  const sorted = items

  const groups: ScenarioRecord[][] = []
  let currentGroup: ScenarioRecord[] = []
  let lastTs = 0

  for (const it of sorted) {
    const t = endTs(it)

    if (currentGroup.length === 0) {
      currentGroup.push(it)
      lastTs = t
      continue
    }

    // Compare with the oldest item in the current group (which was the last one added)
    const dt = Math.abs(lastTs - t)

    if (dt <= gapMinutes * 60 * 1000) {
      currentGroup.push(it)
      lastTs = t
    } else {
      groups.push(currentGroup)
      currentGroup = [it]
      lastTs = t
    }
  }

  if (currentGroup.length) groups.push(currentGroup)

  return groups.map((g) => {
    const timestamps = g.map(endTs)
    const minTs = Math.min(...timestamps)
    const maxTs = Math.max(...timestamps)
    const id = `session-${minTs}`
    const savedNote = notes[id]
    return {
      id,
      start: new Date(minTs).toISOString(),
      end: new Date(maxTs).toISOString(),
      items: g,
      name: savedNote?.name,
      notes: savedNote?.notes,
    }
  })
}

function endTs(it: ScenarioRecord): number {
  const raw = it.stats?.['Date Played']
  if (!raw) return 0
  return Date.parse(String(raw)) || 0
}
