import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { useChartTheme } from '../../hooks/useChartTheme'
import { usePageState } from '../../hooks/usePageState'
import { buildMetaDefs, buildRankDefs, computeRankCounts, computeScopeScenarios, normalizeProgress } from '../../lib/benchmarks/utils'
import type { Benchmark } from '../../types/ipc'
import { ChartBox } from '../shared/ChartBox'

export function RankDistributionDonut({ bench, progress, difficultyIndex, height = 360 }:
  { bench: Benchmark; progress: Record<string, any>; difficultyIndex: number; height?: number }) {
  const difficulty = bench.difficulties[Math.min(Math.max(0, difficultyIndex), bench.difficulties.length - 1)]
  const rankDefs = useMemo(() => buildRankDefs(difficulty, progress), [difficulty, progress])
  const theme = useChartTheme()

  type ScopeLevel = 'all' | 'category' | 'subcategory'
  const benchKey = `${bench.abbreviation}-${bench.benchmarkName}`
  const [level, setLevel] = usePageState<ScopeLevel>(`bench:${benchKey}:diff:${difficultyIndex}:ranks:level`, 'all')
  const [catIdx, setCatIdx] = usePageState<number>(`bench:${benchKey}:diff:${difficultyIndex}:ranks:catIdx`, 0)
  const [subIdx, setSubIdx] = usePageState<number>(`bench:${benchKey}:diff:${difficultyIndex}:ranks:subIdx`, 0)

  const metaDefs = useMemo(() => buildMetaDefs(difficulty), [difficulty])
  const normalized = useMemo(() => normalizeProgress(progress, metaDefs), [progress, metaDefs])

  const scopeScenarios = useMemo(() => computeScopeScenarios(normalized, level, catIdx, subIdx), [normalized, level, catIdx, subIdx])

  const counts = useMemo(() => computeRankCounts(scopeScenarios, rankDefs), [scopeScenarios, rankDefs])

  const labels = useMemo(() => {
    const names = rankDefs.map(r => r.name)
    return counts.below > 0 ? ['Below R1', ...names] : names
  }, [rankDefs, counts.below])

  const bgColors = useMemo(() => {
    const cols = rankDefs.map(r => r.color)
    const below = 'rgba(148, 163, 184, 0.6)' // slate-400 with alpha
    return counts.below > 0 ? [below, ...cols] : cols
  }, [rankDefs, counts.below])

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Scenarios by achieved rank',
        data: counts.below > 0 ? [counts.below, ...counts.byRank] : counts.byRank,
        backgroundColor: bgColors,
        borderColor: bgColors.map(c => c.replace('0.6', '1')),
        borderWidth: 1,
      }
    ]
  }), [labels, counts, bgColors])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' as const, labels: { color: theme.textSecondary } },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
      },
    },
  }), [theme])

  // Build controls for scope selection
  const catOptions = normalized.map((c, i) => ({ label: c.catName || `Category ${i + 1}`, value: String(i) }))
  const subOptions = (() => {
    const c = normalized[Math.min(Math.max(0, catIdx), Math.max(0, normalized.length - 1))]
    return (c?.groups || []).map((g, i) => ({ label: g.name || `Group ${i + 1}`, value: String(i) }))
  })()

  return (
    <ChartBox
      title="Rank distribution"
      info={<div>
        <div className="mb-2">Distribution of achieved ranks across the selected scope.</div>
        <ul className="list-disc pl-5 text-[var(--text-secondary)]">
          <li>Colors match rank colors for the opened difficulty.</li>
          <li>“Below R1” indicates scenarios not yet at the first rank.</li>
        </ul>
      </div>}
      controls={{
        dropdown: {
          label: 'Scope',
          value: level,
          onChange: (v: string) => setLevel((v as ScopeLevel) || 'all'),
          options: [
            { label: 'All scenarios', value: 'all' },
            { label: 'Category', value: 'category' },
            { label: 'Subcategory', value: 'subcategory' },
          ]
        }
      }}
      height={height}
    >
      <div className="h-full flex flex-col">
        {/* Reserve fixed space for secondary selectors to avoid layout shift */}
        <div className="mb-2 min-h-[34px] flex items-center gap-2 text-sm">
          {level !== 'all' && (
            <>
              <select
                className="px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                value={String(catIdx)}
                onChange={e => setCatIdx(Number(e.target.value))}
              >
                {catOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {level === 'subcategory' && (
                <select
                  className="px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                  value={String(subIdx)}
                  onChange={e => setSubIdx(Number(e.target.value))}
                >
                  {subOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </>
          )}
        </div>
        <div className="flex-1 min-h-0">
          {labels.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">No data.</div>
          ) : (
            <div className="h-full pb-4">
              <Doughnut data={data as any} options={options as any} />
            </div>
          )}
        </div>
      </div>
    </ChartBox>
  )
}
