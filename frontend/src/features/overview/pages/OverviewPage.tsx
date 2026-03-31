import { PerformanceVsSensWidget } from '@/features/history/components/PerformanceVsSensWidget'
import { SessionScenarioRadarWidget } from '@/features/history/components/SessionScenarioRadarWidget'
import { BenchmarkOverviewWidget } from '../components/BenchmarkOverviewWidget'
import {
  LastRunWidget,
  RecentScoresWidget,
  SessionPerformanceWidget,
  SessionProgressWidget,
  SessionTimeWidget,
  StreakPlaytimeWidget,
} from '../components/SessionWidgets'

export function OverviewPage() {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden text-sm isolate">
      <div className="grid min-w-0 gap-4 p-5">
        {/* Row 1: Session metrics (2×2) + progress & performance */}
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Left: 4 metric widgets in a 2×2 grid */}
          <div className="col-span-1 md:col-span-2 xl:col-span-2 grid grid-cols-2 gap-4 min-w-0">
            <SessionTimeWidget />
            <StreakPlaytimeWidget />
            <LastRunWidget />
            <SessionPerformanceWidget />
          </div>

          {/* Right: session progress + recent scores */}
          <div className="col-span-1 md:col-span-2 xl:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2 min-w-0">
            <SessionProgressWidget />
            <RecentScoresWidget />
          </div>
        </div>

        <BenchmarkOverviewWidget />

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <PerformanceVsSensWidget allowScopeSelection />
          <SessionScenarioRadarWidget />
        </div>
      </div>
    </div>
  )
}
