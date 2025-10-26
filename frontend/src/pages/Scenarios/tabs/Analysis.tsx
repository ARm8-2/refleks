import { useMemo } from 'react'
import { AccuracyVsSpeedChart, EventsOverTimeChart, TTKMovingAverageChart } from '../../../components'
import { computeScenarioAnalysis } from '../../../lib/compute'
import type { ScenarioRecord } from '../../../types/ipc'

export function AnalysisTab({ item }: { item: ScenarioRecord }) {
  const computed = useMemo(() => computeScenarioAnalysis(item), [item])
  const { labels, timeSec, accOverTime, realTTK, cumKills, perKillAcc, kpm, summary, movingAvg, scatter } = computed

  // Resolve theme colors from CSS variables (canvas can't use var() directly reliably)
  const colors = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        textPrimary: 'rgba(255,255,255,0.9)',
        textSecondary: 'rgba(255,255,255,0.7)',
        grid: 'rgba(255,255,255,0.05)',
        tooltipBg: 'rgba(17,24,39,0.95)', // gray-900
        tooltipBorder: 'rgba(255,255,255,0.1)',
      }
    }
    const css = getComputedStyle(document.documentElement)
    const get = (name: string, fb: string) => (css.getPropertyValue(name).trim() || fb)
    return {
      textPrimary: get('--text-primary', 'rgba(255,255,255,0.9)'),
      textSecondary: get('--text-secondary', 'rgba(255,255,255,0.7)'),
      grid: 'rgba(255,255,255,0.05)',
      tooltipBg: get('--bg-tertiary', 'rgba(17,24,39,0.95)'),
      tooltipBorder: 'rgba(255,255,255,0.1)'
    }
  }, [])

  return (
    <div className="space-y-3">
      <EventsOverTimeChart timeSec={timeSec} accOverTime={accOverTime} realTTK={realTTK} cumKills={cumKills} colors={colors} summary={summary} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TTKMovingAverageChart labels={labels} realTTK={realTTK} ma5={movingAvg.ma5} colors={colors} movingAvg={movingAvg} />

        <AccuracyVsSpeedChart points={kpm.map((x, i) => ({ x, y: perKillAcc[i], i }))} colors={colors} scatter={scatter} />
      </div>
    </div>
  )
}
