
export function OverviewPage() {
  return (
    <div className="flex-1 overflow-auto text-sm">
      <div className="sticky top-0 z-10 bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Overview</h1>
      </div>

      <div className="p-6 grid gap-6">
        {/* Placeholder content - will be replaced with actual overview components */}
        <div className="bg-card rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Recent Sessions</h2>
          <p className="text-muted-foreground">Your recent training sessions will appear here.</p>
        </div>

        <div className="bg-card rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Quick Stats</h2>
          <p className="text-muted-foreground">Training statistics and insights will be displayed here.</p>
        </div>
      </div>
    </div>
  )
}
