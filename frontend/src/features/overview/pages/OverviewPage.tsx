import { BenchmarkOverviewWidget } from '../components/BenchmarkOverviewWidget'
import {
  CurrentScenarioAttemptsWidget,
  CurrentScenarioSessionAverageWidget,
} from '../components/CurrentScenarioTrendWidgets'

export function OverviewPage() {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden text-sm isolate">
      <div className="sticky top-0 z-20 bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Overview</h1>
      </div>

      <div className="grid min-w-0 gap-6 p-6">
        <BenchmarkOverviewWidget />

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
          <CurrentScenarioSessionAverageWidget />
          <CurrentScenarioAttemptsWidget />
        </div>
      </div>
    </div>
  )
}
