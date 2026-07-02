import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import { saveSessionNote } from '../lib/api'
import type { Session } from '../types/domain'
import type { RunRecord } from '../types/ipc'

type State = {
  sessions: Session[]
  sessionGapMinutes: number
  sessionNotes: Record<string, { name: string; notes: string }>
  runHydration: {
    loading: boolean
    loaded: number
    total: number
    complete: boolean
  }
}

type Action =
  | { type: 'set'; items: RunRecord[] }
  | { type: 'setGap'; minutes: number }
  | { type: 'setSessionNotes'; notes: Record<string, { name: string; notes: string }> }
  | { type: 'updateRunHydration'; hydration: Partial<State['runHydration']> }
  | { type: 'updateSessionNote'; id: string; name: string; notes: string }

const initial: State = {
  sessions: [],
  sessionGapMinutes: 30,
  sessionNotes: {},
  runHydration: {
    loading: false,
    loaded: 0,
    total: 0,
    complete: false,
  },
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return { ...state, sessions: groupSessions(action.items ?? [], state.sessionGapMinutes, state.sessionNotes) }
    case 'setGap': {
      const currentRuns = state.sessions.flatMap(s => s.items)
      const gap = Math.max(1, Math.floor(action.minutes))
      return { ...state, sessionGapMinutes: gap, sessions: groupSessions(currentRuns, gap, state.sessionNotes) }
    }
    case 'setSessionNotes': {
      const currentRuns = state.sessions.flatMap(s => s.items)
      return { ...state, sessionNotes: action.notes, sessions: groupSessions(currentRuns, state.sessionGapMinutes, action.notes) }
    }
    case 'updateRunHydration':
      return { ...state, runHydration: { ...state.runHydration, ...action.hydration } }
    case 'updateSessionNote': {
      const nextNotes = { ...state.sessionNotes, [action.id]: { name: action.name, notes: action.notes } }
      const currentRuns = state.sessions.flatMap(s => s.items)
      return { ...state, sessionNotes: nextNotes, sessions: groupSessions(currentRuns, state.sessionGapMinutes, nextNotes) }
    }
    default:
      return state
  }
}

type Ctx = State & {
  setRuns: (items: RunRecord[]) => void
  setSessionGap: (minutes: number) => void
  setSessionNotes: (notes: Record<string, { name: string; notes: string }>) => void
  updateRunHydration: (hydration: Partial<State['runHydration']>) => void
  saveSessionNote: (id: string, name: string, notes: string) => Promise<void>
  isInSession: boolean
}

const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)

  // Stable callbacks so consumers can safely depend on their identity
  const setRuns = useCallback((items: RunRecord[]) => dispatch({ type: 'set', items }), [dispatch])
  const setSessionGap = useCallback((minutes: number) => dispatch({ type: 'setGap', minutes }), [dispatch])
  const setSessionNotes = useCallback((notes: Record<string, { name: string; notes: string }>) => dispatch({ type: 'setSessionNotes', notes }), [dispatch])
  const updateRunHydration = useCallback((hydration: Partial<State['runHydration']>) => dispatch({ type: 'updateRunHydration', hydration }), [dispatch])

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
    setRuns,
    setSessionGap,
    setSessionNotes,
    updateRunHydration,
    saveSessionNote: saveSessionNoteAction,
    isInSession,
  }), [state, setRuns, setSessionGap, setSessionNotes, updateRunHydration, saveSessionNoteAction, isInSession])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore<T>(selector: (s: Ctx) => T): T {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('StoreProvider missing')
  return selector(ctx)
}

// --- Helpers ---
function groupSessions(items: RunRecord[], gapMinutes = 30, notes: Record<string, { name: string; notes: string }> = {}): Session[] {
  if (!Array.isArray(items) || items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    const diff = endTs(b) - endTs(a)
    if (diff !== 0) return diff
    return a.filePath.localeCompare(b.filePath)
  })

  const groups: RunRecord[][] = []
  let currentGroup: RunRecord[] = []
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

  const sessions = groups.map((group) => {
    const items = [...group].sort((a, b) => {
      const diff = endTs(b) - endTs(a)
      if (diff !== 0) return diff
      return a.filePath.localeCompare(b.filePath)
    })
    const timestamps = items.map(endTs)
    const minTs = Math.min(...timestamps)
    const maxTs = Math.max(...timestamps)
    const id = `session-${minTs}`
    const savedNote = notes[id]
    return {
      id,
      start: new Date(minTs).toISOString(),
      end: new Date(maxTs).toISOString(),
      items,
      name: savedNote?.name,
      notes: savedNote?.notes,
      sortTs: maxTs,
    }
  })

  sessions.sort((a, b) => b.sortTs - a.sortTs || a.id.localeCompare(b.id))

  return sessions.map(({ sortTs: _sortTs, ...session }) => session)
}

function endTs(it: RunRecord): number {
  const raw = it.stats?.summary.datePlayed
  if (!raw) return 0
  return Date.parse(String(raw)) || 0
}
