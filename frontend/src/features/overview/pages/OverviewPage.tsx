
export function OverviewPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">Overview</h1>
      </div>

      <div className="grid gap-6">
        {/* Placeholder content - will be replaced with actual overview components */}
        <div className="bg-surface-2 rounded-lg border border-primary p-6">
          <h2 className="text-lg font-medium mb-4">Recent Sessions</h2>
          <p className="text-secondary">Your recent training sessions will appear here.</p>
        </div>

        <div className="bg-surface-2 rounded-lg border border-primary p-6">
          <h2 className="text-lg font-medium mb-4">Quick Stats</h2>
          <p className="text-secondary">Training statistics and insights will be displayed here.</p>
        </div>
      </div>
    </div>
  )
}
