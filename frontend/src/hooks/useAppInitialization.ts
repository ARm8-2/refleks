import { useEffect } from 'react'
import { EventsOn } from '../../wailsjs/runtime'
import { getRecentScenarios, getSettings } from '../lib/internal'
import { useStore } from './useStore'

export function useAppInitialization() {
  const addScenario = useStore(s => s.addScenario)
  const updateScenario = useStore(s => s.updateScenario)
  const incNew = useStore(s => s.incNew)
  const resetNew = useStore(s => s.resetNew)
  const setScenarios = useStore(s => s.setScenarios)
  const setSessionGap = useStore(s => s.setSessionGap)
  const setSessionNotes = useStore(s => s.setSessionNotes)

  // Startup effect: run once to load initial data
  useEffect(() => {

    getRecentScenarios()
      .then((arr) => { setScenarios(arr) })
      .catch((err: unknown) => console.warn('GetRecentScenarios failed:', err))

    // Initialize session gap and notes
    getSettings()
      .then((s) => {
        if (s) {
          if (typeof s.sessionGapMinutes === 'number') setSessionGap(s.sessionGapMinutes)
          if (s.sessionNotes) setSessionNotes(s.sessionNotes)
        }
      })
      .catch(() => { })
  }, [setScenarios, setSessionGap, setSessionNotes])

  // Subscriptions effect: keep separate so it can cleanup/re-subscribe if handlers change
  useEffect(() => {
    const off = EventsOn('scenario:added', (data: any) => {
      const rec = data && data.filePath && data.stats ? data : null
      if (rec) {
        addScenario(rec)
        incNew()
      }
    })

    const offUpd = EventsOn('scenario:updated', (data: any) => {
      const rec = data && data.filePath && data.stats ? data : null
      if (rec) {
        updateScenario(rec)
      }
    })

    const offWatcher = EventsOn('watcher:started', (_data: any) => {
      // Clear current scenarios so re-parsed existing files don't duplicate entries
      setScenarios([])
      resetNew()
    })

    return () => {
      try { off() } catch (e) { /* ignore */ }
      try { offUpd() } catch (e) { /* ignore */ }
      try { offWatcher() } catch (e) { /* ignore */ }
    }
  }, [addScenario, updateScenario, incNew, setScenarios, resetNew])
}
