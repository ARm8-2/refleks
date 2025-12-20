import { useMemo } from 'react';
import { AccuracyVsSpeedChart } from '../../../components/scenarios/AccuracyVsSpeedChart';
import { AccuracyVsSpeedDetails } from '../../../components/scenarios/AccuracyVsSpeedDetails';
import { EventsOverTimeChart } from '../../../components/scenarios/EventsOverTimeChart';
import { EventsOverTimeDetails } from '../../../components/scenarios/EventsOverTimeDetails';
import { TTKMovingAverageChart } from '../../../components/scenarios/TTKMovingAverageChart';
import { TTKMovingAverageDetails } from '../../../components/scenarios/TTKMovingAverageDetails';
import { computeScenarioAnalysis } from '../../../lib/analysis/scenario';
import type { ScenarioRecord } from '../../../types/ipc';

type ScenariosAnalysisTabProps = { item: ScenarioRecord }

export function AnalysisTab({ item }: ScenariosAnalysisTabProps) {
  const computed = useMemo(() => computeScenarioAnalysis(item), [item])
  const { labels, timeSec, accOverTime, realTTK, cumKills, perKillAcc, kpm, summary, movingAvg, scatter } = computed

  return (
    <div className="space-y-3">
      <div>
        <EventsOverTimeChart timeSec={timeSec} accOverTime={accOverTime} realTTK={realTTK} cumKills={cumKills} summary={summary} />
        <EventsOverTimeDetails summary={summary} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <TTKMovingAverageChart labels={labels} realTTK={realTTK} ma5={movingAvg.ma5} movingAvg={movingAvg} />
          <TTKMovingAverageDetails movingAvg={movingAvg} />
        </div>

        <div>
          <AccuracyVsSpeedChart points={kpm.map((x, i) => ({ x, y: perKillAcc[i], i }))} scatter={scatter} />
          <AccuracyVsSpeedDetails scatter={scatter} />
        </div>
      </div>
    </div>
  )
}
