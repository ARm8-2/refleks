import { useMemo } from 'react'
import { AccuracyVsSpeedChart, EventsOverTimeChart, TTKMovingAverageChart } from '../../../components'
import { computeScenarioAnalysis } from '../../../lib/analysis/scenario'
import type { ScenarioRecord } from '../../../types/ipc'

type ScenariosAnalysisTabProps = { item: ScenarioRecord }

export function AnalysisTab({ item }: ScenariosAnalysisTabProps) {
  const computed = useMemo(() => computeScenarioAnalysis(item), [item])
  const { labels, timeSec, accOverTime, realTTK, cumKills, perKillAcc, kpm, summary, movingAvg, scatter } = computed

  return (
    <div className="space-y-3">
      <EventsOverTimeChart timeSec={timeSec} accOverTime={accOverTime} realTTK={realTTK} cumKills={cumKills} summary={summary} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TTKMovingAverageChart labels={labels} realTTK={realTTK} ma5={movingAvg.ma5} movingAvg={movingAvg} />

        <AccuracyVsSpeedChart points={kpm.map((x, i) => ({ x, y: perKillAcc[i], i }))} scatter={scatter} />
      </div>
    </div>
  )
}
