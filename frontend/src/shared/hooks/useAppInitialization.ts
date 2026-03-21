import { EventsOn } from '@wails/runtime'
import { startTransition, useCallback, useEffect, useRef } from 'react'
import { getRecentScenarios, getSettings } from '../lib/api'
import { useStore } from './useStore'

const DEFAULT_RECENT_RUNS_LIMIT = 1000
const PROGRESSIVE_BATCH_LIMITS = [8, 16, 32, 64, 128, 256, 512]
const PROGRESSIVE_BATCH_DELAYS_MS = [50, 70, 100, 140, 200, 280, 360]

export function useAppInitialization() {
  const setScenarios = useStore(s => s.setScenarios)
  const setSessionGap = useStore(s => s.setSessionGap)
  const setSessionNotes = useStore(s => s.setSessionNotes)

  const refreshSeq = useRef(0)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshRunning = useRef(false)
  const refreshDirty = useRef(false)
  const loadedCount = useRef(0)
  const hasLoadedAll = useRef(false)
  const maxRecentRuns = useRef(DEFAULT_RECENT_RUNS_LIMIT)

  const sleep = useCallback((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)), [])

  const normalizeRecentRunsLimit = useCallback((value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_RECENT_RUNS_LIMIT
    return Math.floor(n)
  }, [])

  const buildBatchPlan = useCallback((minimumCount: number): number[] => {
    const maxLimit = maxRecentRuns.current
    if (hasLoadedAll.current) {
      return [maxLimit]
    }

    const floor = Math.max(0, minimumCount)
    const plan: number[] = []

    if (floor > 0) {
      plan.push(floor)
    }

    for (const limit of PROGRESSIVE_BATCH_LIMITS) {
      if (limit <= floor) continue
      if (!plan.includes(limit)) {
        plan.push(limit)
      }
    }
    if (maxLimit > floor && !plan.includes(maxLimit)) {
      plan.push(maxLimit)
    }
    return plan
  }, [])

  const loadScenariosProgressively = useCallback(async () => {
    const seq = ++refreshSeq.current
    const batchPlan = buildBatchPlan(loadedCount.current)

    for (let index = 0; index < batchPlan.length; index++) {
      const limit = batchPlan[index]
      try {
        const arr = await getRecentScenarios(limit)
        if (seq !== refreshSeq.current) return

        loadedCount.current = arr.length
        if (limit >= maxRecentRuns.current) {
          hasLoadedAll.current = true
        }

        const apply = () => setScenarios(arr)
        if (index === 0) {
          apply()
        } else {
          startTransition(apply)
        }

        if (limit > 0 && arr.length < limit) {
          hasLoadedAll.current = true
          break
        }

        if (index < PROGRESSIVE_BATCH_DELAYS_MS.length) {
          await sleep(PROGRESSIVE_BATCH_DELAYS_MS[index])
          if (seq !== refreshSeq.current) return
        }
      } catch (err: unknown) {
        console.warn('GetRecentScenarios failed:', err)
        break
      }
    }
  }, [buildBatchPlan, setScenarios, sleep])

  const flushRefreshQueue = useCallback(async function flushRefreshQueue() {
    if (refreshRunning.current || !refreshDirty.current) return

    refreshRunning.current = true
    refreshDirty.current = false
    try {
      await loadScenariosProgressively()
    } finally {
      refreshRunning.current = false
      if (refreshDirty.current && !refreshTimer.current) {
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null
          void flushRefreshQueue()
        }, 280)
      }
    }
  }, [loadScenariosProgressively])

  const requestRefresh = useCallback((delayMs = 120) => {
    refreshDirty.current = true
    if (refreshRunning.current || refreshTimer.current) return

    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      void flushRefreshQueue()
    }, delayMs)
  }, [flushRefreshQueue])

  // Startup effect: run once to load initial data
  useEffect(() => {
    requestRefresh(0)

    // Initialize session gap and notes
    getSettings()
      .then((s) => {
        if (s) {
          if (typeof s.sessionGapMinutes === 'number') setSessionGap(s.sessionGapMinutes)
          if (s.sessionNotes) setSessionNotes(s.sessionNotes)
          const nextMax = normalizeRecentRunsLimit(s.recentRunsLimit)
          if (nextMax !== maxRecentRuns.current) {
            maxRecentRuns.current = nextMax
            hasLoadedAll.current = false
            if (loadedCount.current > nextMax) {
              loadedCount.current = nextMax
            }
            requestRefresh(40)
          }
        }
      })
      .catch(() => { })
    return () => {
      refreshSeq.current++
      refreshRunning.current = false
      hasLoadedAll.current = false
      loadedCount.current = 0
      maxRecentRuns.current = DEFAULT_RECENT_RUNS_LIMIT
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
        refreshTimer.current = null
      }
      refreshDirty.current = false
    }
  }, [normalizeRecentRunsLimit, requestRefresh, setSessionGap, setSessionNotes])

  // Subscriptions effect: keep separate so it can cleanup/re-subscribe if handlers change
  useEffect(() => {
    const off = EventsOn('scenario:added', () => {
      requestRefresh()
    })

    const offUpd = EventsOn('scenario:updated', () => {
      requestRefresh()
    })

    const offWatcher = EventsOn('watcher:started', () => {
      requestRefresh(180)
    })

    return () => {
      try { off() } catch { /* ignore */ }
      try { offUpd() } catch { /* ignore */ }
      try { offWatcher() } catch { /* ignore */ }
    }
  }, [requestRefresh])
}
