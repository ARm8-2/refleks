
export function HistoryPage() {
  return (
    <div className="flex-1 overflow-auto text-sm">
      <div className="sticky top-0 z-10 bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">History</h1>
      </div>

      <div className="p-6 grid gap-6">
        {/* Placeholder content - will be replaced with actual progress tracking components */}
        <div className="bg-card rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Skill Progress</h2>
          <p className="text-muted-foreground">Track your improvement over time across different skills.</p>
        </div>

        <div className="bg-card rounded-xl p-6">
          <h2 className="text-lg font-medium mb-4">Progress Charts</h2>
          <p className="text-muted-foreground">Visualize your training progress with detailed charts.</p>
        </div>
      </div>
    </div>
  )
}
