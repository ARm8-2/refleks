import { Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer } from '@/shared/components/ui/chart'
import { CHART_SERIES_COLORS, CHART_STYLE } from '@/shared/lib'
import { Flame } from 'lucide-react'
import { Area, AreaChart } from 'recharts'
import { useDailyPlaytime } from '../../hooks/useDailyPlaytime'
import { useRecentSessionSnapshot } from '../../hooks/useRecentSessionSnapshot'
import { EmptyMetricWidget } from './shared'

const playtimeConfig: ChartConfig = {
  minutes: { label: 'Playtime', color: CHART_SERIES_COLORS.accuracy },
}

export function StreakPlaytimeWidget() {
  const { currentSession, streakLabel, streakDetail } = useRecentSessionSnapshot()
  const points = useDailyPlaytime(7)
  const hasData = points.some(p => p.minutes > 0)
  const chartData = hasData ? points : points.map(p => ({ ...p, minutes: 0.5 }))

  if (!currentSession) return <EmptyMetricWidget icon={Flame} label="Streak & Playtime" />

  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-[color:var(--streak)]" />Streak & Playtime</span>}
      className="px-4 py-3"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-[color:var(--streak)]">{streakLabel}</span>
        <span className="text-xs text-surface-muted-foreground">{streakDetail}</span>
      </div>
      <ChartContainer config={playtimeConfig} className="mt-1 aspect-auto h-[20px] w-full">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="streakPlaytimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-minutes)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-minutes)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="minutes"
            stroke="var(--color-minutes)"
            fill="url(#streakPlaytimeFill)"
            strokeWidth={CHART_STYLE.linePrimaryWidth}
          />
        </AreaChart>
      </ChartContainer>
    </Widget>
  )
}
