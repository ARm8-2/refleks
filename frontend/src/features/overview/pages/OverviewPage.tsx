import { BenchmarkOverviewWidget } from '../components/BenchmarkOverviewWidget'
import {
  CurrentScenarioAttemptsWidget,
  CurrentScenarioSessionAverageWidget,
} from '../components/CurrentScenarioTrendWidgets'
import {
  ActivePlaytimeWidget,
  DailyStreakWidget,
  PlaytimeHistoryWidget,
  SessionLengthWidget,
  SessionPerformanceWidget,
  SessionProgressWidget,
} from '../components/SessionWidgets'

export function OverviewPage() {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden text-sm isolate">
      <div className="grid min-w-0 gap-4 p-5">
        {/* Row 1: Session metric cards + radial progress */}
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Left: 4 small metric widgets in a 2×2 grid */}
          <div className="col-span-1 md:col-span-2 xl:col-span-2 grid grid-cols-2 gap-4 min-w-0">
            <SessionLengthWidget />
            <ActivePlaytimeWidget />
            <DailyStreakWidget />
            <PlaytimeHistoryWidget />
          </div>

          {/* Right: session progress + performance */}
          <div className="col-span-1 md:col-span-2 xl:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2 min-w-0">
            <SessionProgressWidget />
            <SessionPerformanceWidget />
          </div>
        </div>

        <BenchmarkOverviewWidget />

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <CurrentScenarioSessionAverageWidget />
          <CurrentScenarioAttemptsWidget />
        </div>
      </div>
    </div>
  )
}
