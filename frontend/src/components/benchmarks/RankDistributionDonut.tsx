import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { useChartTheme } from '../../hooks/useChartTheme'
import { usePageState } from '../../hooks/usePageState'
import type { Benchmark } from '../../types/ipc'
import { ChartBox } from '../shared/ChartBox'
import { buildRankDefs } from './utils'

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

  // Build metadata + normalized mapping like BenchmarkProgress to resolve scenario lists per scope
  const metaDefs = useMemo(() => {
    const defs: Array<{
      catName: string
      catColor?: string
      subDefs: Array<{ name: string; count: number; color?: string }>
    }> = []
    for (const c of difficulty?.categories || []) {
      const catName = String((c as any)?.categoryName ?? '')
      const catColor = (c as any)?.color as string | undefined
      const subs = Array.isArray((c as any)?.subcategories) ? (c as any).subcategories : []
      const subDefs = subs.map((s: any) => ({
        name: String(s?.subcategoryName ?? ''),
        count: Number(s?.scenarioCount ?? 0),
        color: s?.color as string | undefined,
      }))
      defs.push({ catName, catColor, subDefs })
    }
    return defs
  }, [difficulty])

  const normalized = useMemo(() => {
    type ScenarioEntry = [string, any]
    const categories = progress?.categories as Record<string, any> | undefined
    const result: Array<{
      catName: string
      catColor?: string
      groups: Array<{ name: string; color?: string; scenarios: ScenarioEntry[] }>
    }> = []

    const flat: ScenarioEntry[] = []
    if (categories) {
      for (const cat of Object.values(categories)) {
        const scenEntries = Object.entries((cat as any)?.scenarios || {}) as ScenarioEntry[]
        flat.push(...scenEntries)
      }
    }

    let pos = 0
    for (let i = 0; i < metaDefs.length; i++) {
      const { catName, catColor, subDefs } = metaDefs[i]
      const groups: Array<{ name: string; color?: string; scenarios: ScenarioEntry[] }> = []

      if (subDefs.length > 0) {
        for (const sd of subDefs) {
          const take = Math.max(0, Math.min(sd.count, flat.length - pos))
          const scenarios = take > 0 ? flat.slice(pos, pos + take) : []
          pos += take
          groups.push({ name: sd.name, color: sd.color, scenarios })
        }
      } else {
        groups.push({ name: '', color: undefined, scenarios: [] })
      }

      if (i === metaDefs.length - 1 && pos < flat.length) {
        groups.push({ name: '', color: undefined, scenarios: flat.slice(pos) })
        pos = flat.length
      }

      result.push({ catName, catColor, groups })
    }

    return result
  }, [progress, metaDefs])

  const scopeScenarios = useMemo(() => {
    if (level === 'all') {
      return normalized.flatMap(c => c.groups.flatMap(g => g.scenarios))
    }
    const c = normalized[Math.min(Math.max(0, catIdx), Math.max(0, normalized.length - 1))]
    if (!c) return []
    if (level === 'category') return c.groups.flatMap(g => g.scenarios)
    const g = c.groups[Math.min(Math.max(0, subIdx), Math.max(0, c.groups.length - 1))]
    return g ? g.scenarios : []
  }, [normalized, level, catIdx, subIdx])

  const counts = useMemo(() => {
    const n = rankDefs.length
    const arr = Array.from({ length: n }, () => 0)
    let below = 0
    for (const [_, s] of scopeScenarios) {
      const r = Number(s?.scenario_rank || 0)
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
