import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
} from 'chart.js'
import { Info } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { useChartTheme } from '../../hooks/useChartTheme'
import { Dropdown } from './Dropdown'
import { SegmentedControl } from './SegmentedControl'
import { Toggle } from './Toggle'

// Register common chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  // Added for bar & doughnut charts used in benchmark stats
  BarElement,
  ArcElement,
)

type DropdownOption = { label: string; value: string }

export type ChartBoxControls = {
  dropdown?: {
    label?: string
    value: string
    options: DropdownOption[]
    onChange: (value: string) => void
  }
  toggle?: {
    label?: string
    checked: boolean
    onChange: (checked: boolean) => void
  }
  segment?: {
    label?: string
    value: string
    options: DropdownOption[]
    onChange: (value: string) => void
  }
}

type ChartBoxProps = {
  title: ReactNode
  info?: ReactNode
  children: ReactNode
  controls?: ChartBoxControls
  height?: number
}

export function ChartBox({
  title,
  info,
  children,
  controls,
  height = 280,
}: ChartBoxProps) {
  const [showInfo, setShowInfo] = useState(false)
  const bodyStyle: CSSProperties = useMemo(() => ({ height: height - 44 }), [height]) // 44px header
  const titleText = typeof title === 'string' ? title : undefined

  return (
    <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)]" style={{ height }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="text-sm font-medium text-[var(--text-primary)] truncate" title={titleText}>{title}</div>
        <div className="flex items-center gap-2">
          {controls?.dropdown && (
            <Dropdown
              size="sm"
              label={controls.dropdown.label}
              value={controls.dropdown.value}
              onChange={(v) => controls.dropdown!.onChange(v)}
              options={controls.dropdown.options}
            />
          )}
          {controls?.segment && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              {controls.segment.label && <span>{controls.segment.label}</span>}
              <SegmentedControl
                size="sm"
                options={controls.segment.options}
                value={controls.segment.value}
                onChange={(v) => controls.segment!.onChange(v)}
              />
            </div>
          )}
          {controls?.toggle && (
            <Toggle
              size="sm"
              label={controls.toggle.label ?? 'Auto'}
              checked={controls.toggle.checked}
              onChange={(v) => controls.toggle!.onChange(v)}
            />
          )}
          <button
            aria-label="Info"
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
            onClick={() => setShowInfo(prev => !prev)}
            title={showInfo ? 'Show chart' : 'Show info'}
          >
            <Info size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden" style={bodyStyle}>
        {showInfo ? (
          <div className="h-full overflow-y-auto text-sm text-[var(--text-primary)] p-3">
            {info ?? <div>No additional info.</div>}
          </div>
        ) : (
          <div className="h-full p-3">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

// Convenience line chart component
type LineChartProps = { labels: string[]; data: number[]; color?: string }

export function LineChart({
  labels,
  data,
  color = 'rgb(16, 185, 129)',
}: LineChartProps) {
  const theme = useChartTheme()
  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Score',
        data,
        borderColor: color,
        backgroundColor: color.replace('rgb(', 'rgba(').replace(')', ', 0.25)'),
        tension: 0.25,
        pointRadius: 2,
      },
    ],
  }), [labels, data, color])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        intersect: false,
        mode: 'index' as const,
        backgroundColor: theme.tooltipBg,
        titleColor: theme.textPrimary,
        bodyColor: theme.textSecondary,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary } },
      y: { grid: { color: theme.grid }, ticks: { color: theme.textSecondary } },
    },
  }), [theme])

  return <Line options={options as any} data={chartData} />
}
