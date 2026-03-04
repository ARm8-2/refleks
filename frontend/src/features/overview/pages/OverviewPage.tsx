
import { OverviewScenarioWidget } from '../components/OverviewScenarioWidget'

export function OverviewPage() {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden text-sm isolate">
      <div className="sticky top-0 z-20 bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Overview</h1>
      </div>

      <div className="grid min-w-0 gap-6 p-6">
        <div className="min-w-0">
          <OverviewScenarioWidget />
        </div>

        <div className="min-w-0 rounded-xl bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Recent Sessions</h2>
          <p className="text-muted-foreground">Your recent training sessions will appear here.</p>
        </div>

        <div className="min-w-0 rounded-xl bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Quick Stats</h2>
          <p className="text-muted-foreground">Training statistics and insights will be displayed here.</p>
        </div>
      </div>
    </div>
  )
}
