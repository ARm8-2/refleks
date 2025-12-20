import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { useChartTheme } from '../../hooks/useChartTheme';
import { usePageState } from '../../hooks/usePageState';
import { CHART_DECIMALS } from '../../lib/constants';
import { formatNumber } from '../../lib/utils';
import type { Benchmark, BenchmarkProgress } from '../../types/ipc';
import { ChartBox } from '../shared/ChartBox';
import { Dropdown } from '../shared/Dropdown';

type RankDistributionDonutProps = {
  bench: Benchmark
  progress: BenchmarkProgress
  difficultyIndex: number
  height?: number
}

export function RankDistributionDonut({ bench, progress, difficultyIndex, height = 360 }: RankDistributionDonutProps) {
  const rankDefs = progress?.ranks || []
  const theme = useChartTheme()

  type ScopeLevel = 'all' | 'category' | 'subcategory'
  const [level, setLevel] = usePageState<ScopeLevel>('bench:ranks:level', 'all')
  const [catIdx, setCatIdx] = usePageState<number>('bench:ranks:catIdx', 0)
  const [subIdx, setSubIdx] = usePageState<number>('bench:ranks:subIdx', 0)

  const categories = progress?.categories || []

  const scopeScenarios = useMemo(() => {
    const normCatIdx = Math.min(Math.max(0, catIdx), Math.max(0, categories.length - 1))
    const cat = categories[normCatIdx]
    if (level === 'all') return categories.flatMap(c => c.groups.flatMap(g => g.scenarios))
    if (!cat) return []
    if (level === 'category') return cat.groups.flatMap(g => g.scenarios)
    const normSubIdx = Math.min(Math.max(0, subIdx), Math.max(0, (cat.groups?.length || 1) - 1))
    const g = cat.groups?.[normSubIdx]
    return g?.scenarios || []
  }, [categories, level, catIdx, subIdx])

  const counts = useMemo(() => {
    const n = rankDefs.length
    const arr = Array.from({ length: n }, () => 0)
    let below = 0
    for (const s of scopeScenarios) {
      const r = Number(s?.scenarioRank || 0)
      if (r <= 0) below++
      else arr[Math.min(n, r) - 1]++
    }
    return { byRank: arr, below }
  }, [scopeScenarios, rankDefs])

  const labels = useMemo(() => {
    const names = rankDefs.map(r => r.name)
    return counts.below > 0 ? ['Below R1', ...names] : names
  }, [rankDefs, counts.below])

  const bgColors = useMemo(() => {
    const cols = rankDefs.map(r => r.color)
    const below = theme.neutral
    return counts.below > 0 ? [below, ...cols] : cols
  }, [rankDefs, counts.below, theme.neutral])

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Scenarios by achieved rank',
        data: counts.below > 0 ? [counts.below, ...counts.byRank] : counts.byRank,
        backgroundColor: bgColors,
        borderColor: bgColors,
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
        callbacks: {
          label: (ctx: any) => {
            const v = ctx.parsed ?? ctx.raw ?? ctx.raw?.y ?? 0
            return `${ctx.label}: ${formatNumber(Number(v ?? 0), CHART_DECIMALS.numTooltip)}`
          }
        }
      },
    },
  }), [theme])

  // Build controls for scope selection
  const catOptions = categories.map((c, i) => ({ label: c.name || `Category ${i + 1}`, value: String(i) }))
  const subOptions = (() => {
    const c = categories[Math.min(Math.max(0, catIdx), Math.max(0, categories.length - 1))]
    return (c?.groups || []).map((g, i) => ({ label: g.name || `Group ${i + 1}`, value: String(i) }))
  })()

  const infoContent = (
    <div>
      <div className="mb-2">Distribution of achieved ranks across the selected scope.</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>Colors match rank colors for the opened difficulty.</li>
        <li>“Below R1” indicates scenarios not yet at the first rank.</li>
      </ul>
    </div>
  )

  return (
    <ChartBox
      title="Rank distribution"
      expandable={true}
      info={infoContent}
      actions={
        <Dropdown
          size="sm"
          label="Scope"
          value={level}
          onChange={(v) => setLevel((v as ScopeLevel) || 'all')}
          options={[
            { label: 'All scenarios', value: 'all' },
            { label: 'Category', value: 'category' },
            { label: 'Subcategory', value: 'subcategory' },
          ]}
        />
      }
      height={height}
    >
      <div className="h-full flex flex-col">
        {/* Reserve fixed space for secondary selectors to avoid layout shift */}
        <div className="mb-2 min-h-[34px] flex items-center gap-2 text-sm">
          {level !== 'all' && (
            <>
              <select
                className="px-2 py-1 rounded bg-surface-3 border border-primary"
                value={String(catIdx)}
                onChange={e => setCatIdx(Number(e.target.value))}
              >
                {catOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {level === 'subcategory' && (
                <select
                  className="px-2 py-1 rounded bg-surface-3 border border-primary"
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
            <div className="h-full flex items-center justify-center text-sm text-secondary">No data.</div>
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
