import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { useChartTheme } from '../../hooks/useChartTheme';
import { CHART_DECIMALS } from '../../lib/constants';
import { extractChartValue, formatNumber, formatPct, formatSeconds, formatUiValueForLabel } from '../../lib/utils';
import { useChartBoxContext } from '../shared/ChartBox';

type MetricsLineChartProps = {
  labels: string[]
  score: number[]
  acc: number[]
  ttk: number[]
}

export function MetricsLineChart({ labels, score, acc, ttk }: MetricsLineChartProps) {
  const colors = useChartTheme()
  const { isExpanded } = useChartBoxContext()

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Score',
        data: score,
        yAxisID: 'yScore',
        borderColor: colors.success,
        backgroundColor: colors.successSoft,
        tension: 0.25,
        pointRadius: 2,
      },
      {
        label: 'Accuracy (%)',
        data: acc,
        yAxisID: 'yAcc',
        borderColor: colors.accent,
        backgroundColor: colors.accentSoft,
        tension: 0.25,
        pointRadius: 2,
      },
      {
        label: 'Real Avg TTK (s)',
        data: ttk,
        yAxisID: 'yTTK',
        borderColor: colors.danger,
        backgroundColor: colors.dangerSoft,
        tension: 0.25,
        pointRadius: 2,
        hidden: true
      },
    ]
  }), [labels, score, acc, ttk, colors])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' as const, labels: { color: colors.textPrimary } },
      tooltip: {
        intersect: false,
        mode: 'index' as const,
        backgroundColor: colors.tooltipBg,
        titleColor: colors.textPrimary,
        bodyColor: colors.textSecondary,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const dsLabel = ctx.dataset && ctx.dataset.label ? String(ctx.dataset.label) : ''
            const n = extractChartValue(ctx)
            const decimals = dsLabel.includes('Score') ? CHART_DECIMALS.numTooltip : dsLabel.includes('Accuracy') ? CHART_DECIMALS.pctTooltip : dsLabel.includes('TTK') ? CHART_DECIMALS.ttkTooltip : undefined
            return `${dsLabel || ''}: ${formatUiValueForLabel(n, dsLabel, decimals)}`
          }
        },
      },
    },
    scales: {
      x: {
        grid: { color: colors.grid },
        ticks: { color: colors.textSecondary },
        title: { display: isExpanded, text: 'Session History', color: colors.textSecondary }
      },
      yScore: {
        type: 'linear' as const,
        position: 'left' as const,
        grid: { color: colors.grid },
        ticks: { color: colors.textSecondary, callback: (v: any) => formatNumber(v, CHART_DECIMALS.numTick) },
        title: { display: isExpanded, text: 'Score', color: colors.textSecondary }
      },
      yAcc: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: colors.textSecondary, callback: (v: any) => formatPct(v, CHART_DECIMALS.pctTick) },
        title: { display: isExpanded, text: 'Accuracy', color: colors.textSecondary }
      },
      yTTK: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: colors.textSecondary, callback: (v: any) => formatSeconds(v, CHART_DECIMALS.ttkTick) },
        title: { display: isExpanded, text: 'Real Avg TTK', color: colors.textSecondary }
      },
    },
  }), [colors, isExpanded])

  return <Line data={data as any} options={options as any} />
}
