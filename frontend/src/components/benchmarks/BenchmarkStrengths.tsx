import { useMemo } from 'react';
import { Bar, Radar } from 'react-chartjs-2';
import { useChartTheme } from '../../hooks/useChartTheme';
import { usePageState } from '../../hooks/usePageState';
import { normalizedRankProgress } from '../../lib/benchmarks/ui';
import { CHART_DECIMALS } from '../../lib/constants';
import { formatNumber, formatPct } from '../../lib/utils';
import type { Benchmark, BenchmarkProgress, ProgressScenario, RankDef } from '../../types/ipc';
import { ChartBox } from '../shared/ChartBox';
import { Dropdown } from '../shared/Dropdown';
import { SegmentedControl } from '../shared/SegmentedControl';

type BenchmarkStrengthsProps = {
  bench: Benchmark
  progress: BenchmarkProgress
  difficultyIndex: number
  height?: number
}

function hexToRgba(hex: string, alpha: number) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function calculateStrength(scenarios: ProgressScenario[], rankDefs: RankDef[]) {
  const vals = scenarios.map((s) => {
    const score = Number(s?.score || 0)
    const r = Number(s?.scenarioRank || 0)
    const maxes: number[] = Array.isArray(s?.thresholds) ? s.thresholds : []
    return normalizedRankProgress(r, score, maxes)
  })
  const scores = scenarios.map(s => Number(s?.score || 0))
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const N = Math.max(1, rankDefs.length)
  const idx = Math.max(0, Math.min(N - 1, Math.floor(avg * N)))

  return {
    value: Math.round(avg * 100),
    rankDef: rankDefs[idx],
    avgScore
  }
}

export function BenchmarkStrengths({ bench, progress, difficultyIndex, height = 360 }: BenchmarkStrengthsProps) {
  const rankDefs = progress?.ranks || []
  const theme = useChartTheme()

  type Level = 'category' | 'subcategory' | 'scenario'
  const [level, setLevel] = usePageState<Level>('bench:strengths:level', 'category')
  type Mode = 'bar' | 'radar'
  const [mode, setMode] = usePageState<Mode>('bench:strengths:mode', 'bar')

  const categories = progress?.categories || []

  // Aggregate normalized strength per level
  const strength = useMemo(() => {
    if (level === 'category') {
      const items = categories.map(cat => {
        const allScenarios = cat.groups.flatMap(g => g.scenarios)
        const { value, rankDef, avgScore } = calculateStrength(allScenarios, rankDefs)
        return {
          label: cat.name,
          value,
          color: rankDef?.color || cat.color || theme.neutral,
          rankName: rankDef?.name || 'Unranked',
          score: avgScore
        }
      })
      items.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      return items
    }
    if (level === 'subcategory') {
      const rows: Array<{ label: string; value: number; color: string; rankName: string; score: number }> = []
      for (const cat of categories) {
        for (const g of cat.groups) {
          const { value, rankDef, avgScore } = calculateStrength(g.scenarios, rankDefs)
          const label = g.name ? `${cat.name}: ${g.name}` : `${cat.name}`
          rows.push({
            label,
            value,
            color: rankDef?.color || g.color || cat.color || theme.neutral,
            rankName: rankDef?.name || 'Unranked',
            score: avgScore
          })
        }
      }
      rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      return rows
    }
    // scenario level
    const rows: Array<{ label: string; value: number; color: string; rankName: string; score: number }> = []
    for (const cat of categories) {
      for (const g of cat.groups) {
        for (const s of g.scenarios) {
          const { value, rankDef, avgScore } = calculateStrength([s], rankDefs)
          rows.push({
            label: s.name,
            value,
            color: rankDef?.color || theme.accent,
            rankName: rankDef?.name || 'Unranked',
            score: avgScore
          })
        }
      }
    }
    rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    return rows
  }, [categories, level, rankDefs, theme.accent, theme.neutral])

  const labels = strength.map(r => r.label)
  const values = strength.map(r => r.value)

  // Bar chart config with per-bar colors
  const barData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Strength (avg progress to max rank) %',
        data: values,
        backgroundColor: strength.map(r => r.color),
        borderColor: strength.map(r => r.color),
        borderWidth: 1,
      }
    ]
  }), [labels, values, strength])

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const item = strength[ctx.dataIndex]
            if (!item) return `${formatPct(ctx.raw, CHART_DECIMALS.pctTooltip)}`
            const scoreLabel = level === 'scenario' ? 'Score' : 'Avg Score'
            return `${item.rankName} (${scoreLabel}: ${formatNumber(item.score, 1)})`
          },
        },
      },
    },
    scales: {
      x: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary } },
      y: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary, callback: (v: any) => formatNumber(v, CHART_DECIMALS.numTick) }, suggestedMin: 0, suggestedMax: 100 }
    }
  }), [theme, strength, level])

  const radarData = useMemo(() => {
    return {
      labels,
      datasets: [
        {
          label: 'Strength %',
          data: values,
          pointRadius: 3,
          pointBackgroundColor: strength.map(r => r.color),
          pointBorderColor: theme.contrast,
          borderWidth: 2,
          borderColor: (context: any) => {
            const chart = context.chart
            const { ctx, chartArea } = chart
            if (!chartArea || !strength.length) return theme.accent
            if (!ctx.createConicGradient) return theme.accent

            const centerX = (chartArea.left + chartArea.right) / 2
            const centerY = (chartArea.top + chartArea.bottom) / 2
            const gradient = ctx.createConicGradient(-Math.PI / 2, centerX, centerY)

            strength.forEach((item, i) => {
              gradient.addColorStop(i / strength.length, item.color)
            })
            gradient.addColorStop(1, strength[0].color)
            return gradient
          },
          backgroundColor: (context: any) => {
            const chart = context.chart
            const { ctx, chartArea } = chart
            if (!chartArea || !strength.length) return 'rgba(59, 130, 246, 0.25)'
            if (!ctx.createConicGradient) return 'rgba(59, 130, 246, 0.25)'

            const centerX = (chartArea.left + chartArea.right) / 2
            const centerY = (chartArea.top + chartArea.bottom) / 2
            const gradient = ctx.createConicGradient(-Math.PI / 2, centerX, centerY)

            strength.forEach((item, i) => {
              gradient.addColorStop(i / strength.length, hexToRgba(item.color, 0.25))
            })
            gradient.addColorStop(1, hexToRgba(strength[0].color, 0.25))
            return gradient
          },
        }
      ]
    }
  }, [labels, values, strength])

  const radarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const item = strength[ctx.dataIndex]
            if (!item) return `${formatPct(ctx.raw, CHART_DECIMALS.pctTooltip)}`
            const scoreLabel = level === 'scenario' ? 'Score' : 'Avg Score'
            return `${item.rankName} (${scoreLabel}: ${formatNumber(item.score, 1)})`
          },
        }
      }
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          color: theme.textSecondary,
          backdropColor: 'transparent',
          showLabelBackdrop: false,
          callback: (value: any, index: number, values: any[]) => {
            if (typeof value !== 'number') return value
            if (value === 0) return ''
            if (!rankDefs.length) return value
            const N = rankDefs.length

            const getRankName = (v: number) => {
              if (v === 0) return ''
              const idx = Math.max(0, Math.min(N - 1, Math.ceil((v / 100) * N) - 1))
              return rankDefs[idx]?.name
            }

            const currentRank = getRankName(value)

            if (index > 0) {
              const prevValue = values[index - 1].value
              const prevRank = getRankName(prevValue)
              if (currentRank === prevRank) return ''
            }

            return currentRank
          }
        },
        grid: { color: theme.grid },
        angleLines: { color: theme.grid },
      }
    }
  }), [theme, strength, rankDefs, level])

  const infoContent = (
    <div>
      <div className="mb-2">Shows your average progress toward the maximum rank across the selected grouping.</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>The chart scale represents your Rank progress.</li>
        <li>Outer edge (100%) = Max Rank. Center (0%) = Unranked.</li>
        <li>Group by Category (e.g. Tracking, Clicking), Subcategory, or individual Scenario.</li>
      </ul>
    </div>
  )

  return (
    <ChartBox
      title="Strengths and weaknesses"
      expandable={true}
      info={infoContent}
      actions={
        <>
          <Dropdown
            size="sm"
            label="Group by"
            value={level}
            onChange={(v) => setLevel((v as Level) || 'category')}
            options={[
              { label: 'Category', value: 'category' },
              { label: 'Subcategory', value: 'subcategory' },
              { label: 'Scenario', value: 'scenario' },
            ]}
          />
          <div className="flex items-center gap-2 text-xs text-secondary">
            <span>View</span>
            <SegmentedControl
              size="sm"
              value={mode}
              onChange={(v) => setMode((v as Mode) || 'bar')}
              options={[
                { label: 'Bar', value: 'bar' },
                { label: 'Radar', value: 'radar' },
              ]}
            />
          </div>
        </>
      }
      height={height}
    >
      {labels.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-secondary">No data.</div>
      ) : mode === 'bar' ? (
        <Bar data={barData as any} options={barOptions as any} />
      ) : (
        <Radar data={radarData as any} options={radarOptions as any} />
      )}
    </ChartBox>
  )
}
