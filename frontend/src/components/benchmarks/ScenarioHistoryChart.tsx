import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { useChartTheme } from '../../hooks/useChartTheme'
import { KovaaksLastScore, RankDef } from '../../types/ipc'
import { useChartBoxContext } from '../shared/ChartBox'

type ScenarioHistoryChartProps = {
  scores: KovaaksLastScore[]
  ranks?: RankDef[]
  thresholds?: number[]
}

export function ScenarioHistoryChart({ scores, ranks, thresholds }: ScenarioHistoryChartProps) {
  const colors = useChartTheme()
  const { isExpanded } = useChartBoxContext()

  const data = useMemo(() => {
    // Sort by date ascending for the chart (API returns newest first usually)
    // We want oldest to newest left to right
    const sorted = [...scores].reverse()

    const labels = sorted.map(s => {
      if (!s.attributes.challengeStart) return 'Unknown'
      const d = new Date(s.attributes.challengeStart)
      return isNaN(d.getTime()) ? s.attributes.challengeStart : d.toLocaleDateString()
    })
    const scoreData = sorted.map(s => s.attributes.score)

    return {
      labels,
      datasets: [
        {
          label: 'Score',
          data: scoreData,
          borderColor: colors.success,
          backgroundColor: colors.successSoft,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    }
  }, [scores, colors])

  const plugins = useMemo(() => {
    if (!ranks || !thresholds) return []
    return [{
      id: 'rankBackgrounds',
      beforeDraw: (chart: any) => {
        const { ctx, chartArea, scales: { y } } = chart
        if (!y) return

        ctx.save()
        // Clip to chart area so we don't draw over axes
        ctx.beginPath()
        ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height)
        ctx.clip()

        ranks.forEach((rank, i) => {
          const startVal = thresholds[i]
          // For the last rank, extend to the top of the chart (or max value)
          // We use a sufficiently large number to cover the visible area
          const endVal = (i < thresholds.length - 1) ? thresholds[i + 1] : Math.max(y.max, startVal * 2)

          const yTop = y.getPixelForValue(endVal)
          const yBottom = y.getPixelForValue(startVal)

          ctx.globalAlpha = 0.15
          ctx.fillStyle = rank.color
          // yTop is visually higher (smaller pixel value) than yBottom
          ctx.fillRect(chartArea.left, yTop, chartArea.width, yBottom - yTop)
        })

        ctx.restore()
      }
    }]
  }, [ranks, thresholds])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (items: any[]) => {
            if (!items.length) return ''
            // Use the original date string if possible or formatted
            return items[0].label
          }
        }
      },
    },
    scales: {
      x: {
        display: true, // Always show dates
        grid: { display: false },
        ticks: {
          color: colors.textSecondary,
          maxTicksLimit: isExpanded ? 20 : 5
        }
      },
      y: {
        grid: { color: colors.grid },
        ticks: { color: colors.textSecondary }
      }
    }
  }), [colors, isExpanded])

  return <Line data={data} options={options} plugins={plugins} />
}
