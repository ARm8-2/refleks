import { useEffect, useState } from 'react'
import { getLastScenarioScores } from '../../lib/internal'
import type { KovaaksLastScore, RankDef } from '../../types/ipc'
import { ChartBox } from '../shared/ChartBox'
import { Loading } from '../shared/Loading'
import { ScenarioHistoryChart } from './ScenarioHistoryChart'

type ScenarioHistoryModalProps = {
  isOpen: boolean
  onClose: () => void
  scenarioName: string
  ranks?: RankDef[]
  thresholds?: number[]
}

export function ScenarioHistoryModal({ isOpen, onClose, scenarioName, ranks, thresholds }: ScenarioHistoryModalProps) {
  const [scores, setScores] = useState<KovaaksLastScore[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && scenarioName) {
      setLoading(true)
      setError(null)
      setScores([])
      getLastScenarioScores(scenarioName)
        .then(setScores)
        .catch(err => setError(err.message || 'Failed to fetch scores'))
        .finally(() => setLoading(false))
    }
  }, [isOpen, scenarioName])

  if (!isOpen) return null

  return (
    <ChartBox
      title={`Last 10 Scores: ${scenarioName}`}
      expandable={true}
      isExpanded={true}
      onExpandChange={(expanded) => !expanded && onClose()}
      modalControls={null}
    >
      <div className="h-full w-full">
        {loading && <Loading />}
        {error && <div className="text-center text-red-500 py-8">{error}</div>}
        {!loading && !error && scores.length === 0 && (
          <div className="text-center text-secondary py-8">No scores found.</div>
        )}
        {!loading && !error && scores.length > 0 && (
          <ScenarioHistoryChart scores={scores} ranks={ranks} thresholds={thresholds} />
        )}
      </div>
    </ChartBox>
  )
}
