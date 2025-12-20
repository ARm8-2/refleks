import { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import { useChartTheme } from '../../hooks/useChartTheme';
import { usePageState } from '../../hooks/usePageState';
import { CHART_DECIMALS } from '../../lib/constants';
import { formatNumber, formatPct, formatUiValueForLabel } from '../../lib/utils';
import { ChartBox } from '../shared/ChartBox';

type AccuracyVsSpeedChartProps = {
  points: Array<{ x: number; y: number; i: number }>
  scatter: {
    corrKpmAcc: number
    meanBinStdAcc: number
    binsUsed: number
    medianNNDist: number
    centroidKPM?: number
    centroidAcc?: number
    clusterCompactness?: number
  }
}

export function AccuracyVsSpeedChart({ points, scatter }: AccuracyVsSpeedChartProps) {
  const colors = useChartTheme()
  const [isExpanded, setIsExpanded] = usePageState('analysis:acc-vs-speed:expanded', false)
  const data = useMemo(() => ({
    datasets: [
      {
        label: 'Accuracy vs Speed (KPM)',
        data: points,
        parsing: false,
        showLine: false,
        borderColor: colors.accent,
        backgroundColor: colors.accentSoft,
        pointRadius: 3,
        pointHoverRadius: 4,
        pointHitRadius: 8,
      },
    ],
  }), [points])

  const maxX = useMemo(() => points.reduce((m, p) => Math.max(m, p.x), 0), [points])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.tooltipBg,
        titleColor: colors.textPrimary,
        bodyColor: colors.textSecondary,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          title: () => 'Kill',
          label: (ctx: any) => {
            const p = ctx.raw as { x: number; y: number; i: number }
            return [`#${(p.i + 1)}`, `KPM: ${formatUiValueForLabel(p.x, 'KPM', CHART_DECIMALS.kpmTooltip)}`, `Acc: ${formatUiValueForLabel(p.y, 'Accuracy', CHART_DECIMALS.pctTooltip)}`]
          },
        }
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        ticks: { color: colors.textSecondary, callback: (v: any) => formatNumber(Number(v), CHART_DECIMALS.kpmTick) },
        grid: { color: colors.grid },
        suggestedMin: 0,
        suggestedMax: Math.max(60, Math.ceil(maxX / 10) * 10),
        title: { display: isExpanded, text: 'Speed (KPM)', color: colors.textSecondary }
      },
      y: {
        suggestedMin: 0,
        suggestedMax: 1,
        ticks: { color: colors.textSecondary, callback: (v: any) => formatPct(v, CHART_DECIMALS.pctTick) },
        grid: { color: colors.grid },
        title: { display: isExpanded, text: 'Accuracy (%)', color: colors.textSecondary }
      },
    },
  }), [colors, maxX, isExpanded])

  const infoContent = (
    <div className="text-sm">
      <div className="mb-2">Each point is a kill: X is speed (kills per minute - KPM), Y is per-kill accuracy (hits/shots). Tooltips show exact KPM and accuracy percentages for each point.</div>
      <div className="mb-2 font-medium">How to interpret</div>
      <ul className="list-disc pl-5 text-secondary">
        <li>Clusters at high KPM and high accuracy indicate effective play at both speed and accuracy.</li>
        <li>A descending trend (accuracy drops as KPM increases) reveals a speed/accuracy trade-off - consider practicing at lower speeds for accuracy, and vice versa.</li>
        <li>Tight, compact clusters indicate consistent performance; scattered points indicate variability.</li>
        <li>The centroid (See details above) shows your typical playing point; try training slightly above it to expand your margin at higher speeds.</li>
        <li>Short TTKs are clamped to avoid infinite KPM values - treat those as very fast plays rather than exact KPM values.</li>
      </ul>
    </div>
  )

  return (
    <ChartBox
      title="Accuracy vs Speed (per kill)"
      expandable={true}
      isExpanded={isExpanded}
      onExpandChange={setIsExpanded}
      info={infoContent}
      height={320}
    >
      <div className="h-full">
        <Scatter data={data as any} options={options as any} />
      </div>
    </ChartBox>
  )
}
