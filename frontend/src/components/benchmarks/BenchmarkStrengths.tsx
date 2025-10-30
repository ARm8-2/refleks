import { useMemo, useState } from 'react'
import { Bar, Radar } from 'react-chartjs-2'
import { useChartTheme } from '../../hooks/useChartTheme'
import type { Benchmark } from '../../types/ipc'
import { ChartBox } from '../shared/ChartBox'
import { buildRankDefs, hexToRgba, normalizedRankProgress } from './utils'

export function BenchmarkStrengths({ bench, progress, difficultyIndex, height = 360 }:
  { bench: Benchmark; progress: Record<string, any>; difficultyIndex: number; height?: number }) {
  const difficulty = bench.difficulties[Math.min(Math.max(0, difficultyIndex), bench.difficulties.length - 1)]
  const rankDefs = useMemo(() => buildRankDefs(difficulty, progress), [difficulty, progress])
  const theme = useChartTheme()

  type Level = 'category' | 'subcategory' | 'scenario'
  const [level, setLevel] = useState<Level>('category')
  type Mode = 'bar' | 'radar'
  const [mode, setMode] = useState<Mode>('bar')

  // Build metadata from difficulty
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

  // Map API progress to metadata strictly by order and counts (same logic as BenchmarkProgress)
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

  // Aggregate normalized strength per level
  const strength = useMemo(() => {
    const N = Math.max(1, rankDefs.length)
    if (level === 'category') {
      const items = normalized.map(cat => {
        const allScenarios = cat.groups.flatMap(g => g.scenarios)
        const vals: number[] = allScenarios.map(([_, s]) => {
          const raw = Number(s?.score || 0)
          const score = raw / 100
          const r = Number(s?.scenario_rank || 0)
          const maxes: number[] = Array.isArray(s?.rank_maxes) ? s.rank_maxes : []
          return normalizedRankProgress(r, score, maxes)
        })
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        // Pick color by nearest achieved avg rank
        const idx = Math.max(0, Math.min(N - 1, Math.floor(avg * N)))
        return { label: cat.catName, value: Math.round(avg * 100), color: rankDefs[idx]?.color || cat.catColor || '#4b5563' }
      })
      items.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      return items
    }
    if (level === 'subcategory') {
      const rows: Array<{ label: string; value: number; color: string }> = []
      for (const cat of normalized) {
        for (const g of cat.groups) {
          const vals = g.scenarios.map(([_, s]) => {
            const raw = Number(s?.score || 0)
            const score = raw / 100
            const r = Number(s?.scenario_rank || 0)
            const maxes: number[] = Array.isArray(s?.rank_maxes) ? s.rank_maxes : []
            return normalizedRankProgress(r, score, maxes)
          })
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
          const idx = Math.max(0, Math.min(N - 1, Math.floor(avg * N)))
          const label = g.name ? `${cat.catName}: ${g.name}` : `${cat.catName}`
          rows.push({ label, value: Math.round(avg * 100), color: rankDefs[idx]?.color || g.color || cat.catColor || '#4b5563' })
        }
      }
      rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      return rows
    }
    // scenario level
    const rows: Array<{ label: string; value: number; color: string }> = []
    for (const cat of normalized) {
      for (const g of cat.groups) {
        for (const [name, s] of g.scenarios) {
          const raw = Number(s?.score || 0)
          const score = raw / 100
          const r = Number(s?.scenario_rank || 0)
          const maxes: number[] = Array.isArray(s?.rank_maxes) ? s.rank_maxes : []
          const prog = normalizedRankProgress(r, score, maxes)
          const idx = Math.max(0, Math.min(N - 1, Math.floor(prog * N)))
          rows.push({ label: String(name), value: Math.round(prog * 100), color: rankDefs[idx]?.color || '#60a5fa' })
        }
      }
    }
    // Show strongest first; limit to top N for readability
    rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    const TOP_N = 18
    return rows.slice(0, TOP_N)
  }, [normalized, level, rankDefs])

  const labels = strength.map(r => r.label)
  const values = strength.map(r => r.value)

  // Bar chart config with per-bar colors
  const barData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Strength (avg progress to max rank) %',
        data: values,
        backgroundColor: strength.map(r => hexToRgba(r.color, 0.35)),
        borderColor: strength.map(r => r.color),
        borderWidth: 1,
      }
    ]
  }), [labels, values, strength])

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => `${ctx.raw}%`,
        },
      },
    },
    scales: {
      x: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary } },
      y: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary }, suggestedMin: 0, suggestedMax: 100 }
    }
  }), [theme])

  const radarData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Strength %',
        data: values,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.25)',
        pointRadius: 2,
        pointBackgroundColor: strength.map(r => r.color),
      }
    ]
  }), [labels, values, strength])

  const radarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => `${ctx.raw}%`,
        }
      }
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { color: theme.textSecondary, backdropColor: 'transparent', showLabelBackdrop: false },
        grid: { color: theme.grid },
        angleLines: { color: theme.grid },
      }
    }
  }), [theme])

  return (
    <ChartBox
      title="Strengths and weaknesses"
      info={<div>
        <div className="mb-2">Shows your average progress toward the maximum rank across the selected grouping.</div>
        <ul className="list-disc pl-5 text-[var(--text-secondary)]">
          <li>0% = below first rank; 100% = at or beyond the highest rank.</li>
          <li>Group by Category (e.g. Tracking, Clicking), Subcategory, or individual Scenario.</li>
          <li>Bar colors reflect the approximate rank color for that group.</li>
        </ul>
      </div>}
      controls={{
        dropdown: {
          label: 'Group by',
          value: level,
          onChange: (v: string) => setLevel((v as Level) || 'category'),
          options: [
            { label: 'Category', value: 'category' },
            { label: 'Subcategory', value: 'subcategory' },
            { label: 'Scenario', value: 'scenario' },
          ]
        },
        segment: {
          label: 'View',
          value: mode,
          onChange: (v: string) => setMode((v as Mode) || 'bar'),
          options: [
            { label: 'Bar', value: 'bar' },
            { label: 'Radar', value: 'radar' },
          ]
        }
      }}
      height={height}
    >
      {labels.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">No data.</div>
      ) : mode === 'bar' ? (
        <Bar data={barData as any} options={barOptions as any} />
      ) : (
        <Radar data={radarData as any} options={radarOptions as any} />
      )}
    </ChartBox>
  )
}
