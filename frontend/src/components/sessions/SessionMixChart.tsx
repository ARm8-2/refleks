import { useMemo } from 'react'
import { groupByScenario } from '../../lib/analysis/metrics'
import type { Session } from '../../types/domain'
import { ChartBox } from '../shared/ChartBox'
import { ScenarioMixRadarChart } from './ScenarioMixRadarChart'

type SessionMixChartProps = {
  items: Session['items']
  height?: number
}

export function SessionMixChart({ items, height = 300 }: SessionMixChartProps) {
  const byName = useMemo(() => groupByScenario(items), [items])

  const radar = useMemo(() => {
    const rows = Array.from(byName.entries()).map(([name, v]) => ({ name, count: v.score.length }))
    rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    const TOP_N = 12
    const top = rows.slice(0, TOP_N)
    return {
      labels: top.map(r => r.name),
      counts: top.map(r => r.count),
      total: items.length,
      shown: top.length,
    }
  }, [byName, items.length])

  const infoContent = (
    <div>
      <div className="mb-2">Number of runs per scenario name within this session. Useful to see what you’ve been practicing.</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>Shows up to the top 12 scenarios by frequency for readability.</li>
        <li>Values start at zero and reflect raw counts.</li>
      </ul>
    </div>
  )

  return (
    <ChartBox
      title="Session mix (scenarios played)"
      expandable={true}
      info={infoContent}
      height={height}
    >
      {radar.labels.length > 0 ? (
        <ScenarioMixRadarChart labels={radar.labels} counts={radar.counts} />
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-secondary">No scenarios in this session.</div>
      )}
    </ChartBox>
  )
}
