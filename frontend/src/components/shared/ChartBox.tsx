import {
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
import React, { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'

// Register common chart.js components once
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, RadialLinearScale, Title, Tooltip, Legend, Filler)

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
}

export function ChartBox({
  title,
  info,
  children,
  controls,
  height = 280,
}: {
  title: string
  info?: React.ReactNode
  children: React.ReactNode
  controls?: ChartBoxControls
  height?: number
}) {
  const [showInfo, setShowInfo] = useState(false)
  const bodyStyle: React.CSSProperties = useMemo(() => ({ height: height - 44 }), [height]) // 44px header

  return (
    <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)]" style={{ height }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="text-sm font-medium text-[var(--text-primary)] truncate" title={title}>{title}</div>
        <div className="flex items-center gap-2">
          {controls?.dropdown && (
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              {controls.dropdown.label && <span>{controls.dropdown.label}</span>}
              <select
                className="bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded px-2 py-1 border border-[var(--border-primary)]"
                value={controls.dropdown.value}
                onChange={(e) => controls.dropdown!.onChange(e.target.value)}
              >
                {controls.dropdown.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          )}
          {controls?.toggle && (
            <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)] select-none">
              <input
                type="checkbox"
                className="accent-[var(--accent-primary)]"
                checked={controls.toggle.checked}
                onChange={(e) => controls.toggle!.onChange(e.target.checked)}
              />
              <span>{controls.toggle.label ?? 'Auto'}</span>
            </label>
          )}
          <button
            aria-label="Info"
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
            onClick={() => setShowInfo(v => !v)}
            title={showInfo ? 'Show chart' : 'Show info'}
          >
            <Info size={16} />
          </button>
        </div>
      </div>
      <div className="p-3 overflow-hidden" style={bodyStyle}>
        {showInfo ? (
          <div className="h-full overflow-y-auto text-sm text-[var(--text-primary)] pr-1">
            {info ?? <div>No additional info.</div>}
          </div>
        ) : (
          <div className="h-full">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

// Convenience line chart component
export function LineChart({
  labels,
  data,
  color = 'rgb(16, 185, 129)',
}: {
  labels: string[]
  data: number[]
  color?: string
}) {
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
      tooltip: { intersect: false, mode: 'index' as const },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' } },
    },
  }), [])

  return <Line options={options as any} data={chartData} />
}
