import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import { saveSessionNote } from '../lib/internal'
import type { Session } from '../types/domain'
import type { ScenarioRecord } from '../types/ipc'

type State = {
  scenarios: ScenarioRecord[]
  newScenarios: number
  sessions: Session[]
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

const initial: State = { scenarios: [], newScenarios: 0, sessions: [], sessionGapMinutes: 30, sessionNotes: {} }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return { ...state, scenarios: action.items ?? [], sessions: groupSessions(action.items ?? [], state.sessionGapMinutes, state.sessionNotes) }
    case 'add': {
      const next = [action.item, ...state.scenarios]
      return { ...state, scenarios: next, sessions: groupSessions(next, state.sessionGapMinutes, state.sessionNotes) }
    }
    case 'update': {
      const idx = state.scenarios.findIndex(s => s.filePath === action.item.filePath)
      if (idx === -1) {
        // if unknown, append without incrementing newScenarios
        const next = [action.item, ...state.scenarios]
        return { ...state, scenarios: next, sessions: groupSessions(next, state.sessionGapMinutes, state.sessionNotes) }
      }
      const next = [...state.scenarios]
      next[idx] = action.item
      return { ...state, scenarios: next, sessions: groupSessions(next, state.sessionGapMinutes, state.sessionNotes) }
    }
    case 'incNew':
      return { ...state, newScenarios: state.newScenarios + 1 }
    case 'resetNew':
      return { ...state, newScenarios: 0 }
    case 'setGap':
      return { ...state, sessionGapMinutes: Math.max(1, Math.floor(action.minutes)), sessions: groupSessions(state.scenarios, Math.max(1, Math.floor(action.minutes)), state.sessionNotes) }
    case 'setSessionNotes':
      return { ...state, sessionNotes: action.notes, sessions: groupSessions(state.scenarios, state.sessionGapMinutes, action.notes) }
    case 'updateSessionNote': {
      const nextNotes = { ...state.sessionNotes, [action.id]: { name: action.name, notes: action.notes } }
      return { ...state, sessionNotes: nextNotes, sessions: groupSessions(state.scenarios, state.sessionGapMinutes, nextNotes) }
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
  // Skipping the sort saves O(N log N) and many Date.parse calls.
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
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups.map(group => {
    // group is sorted newest first
    const newest = group[0]
    const oldest = group[group.length - 1]

    // ID based on oldest run (start of session)
    const id = `sess-${startTs(oldest)}`

    const note = notes[id]

    return {
      id,
      start: startIso(oldest),
      end: endIso(newest),
      items: group,
      name: note?.name,
      notes: note?.notes
    }
  })
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
  // Reuse timezone suffix from endIso (e.g. "+07:00" or "Z") so the constructed
  // start timestamp uses the same timezone context instead of forcing UTC.
  const tzMatch = String(end).match(/([+-]\d{2}:\d{2}|Z)$/)
  const tz = tzMatch ? tzMatch[0] : 'Z'
  return `${datePart}T${time}${tz}`
}
function startTs(s: ScenarioRecord): number {
  return Date.parse(startIso(s))
}
