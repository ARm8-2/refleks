
export function HistoryPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">History</h1>
      </div>

      <div className="grid gap-6">
        {/* Placeholder content - will be replaced with actual progress tracking components */}
        <div className="bg-surface-2 rounded-lg border border-primary p-6">
          <h2 className="text-lg font-medium mb-4">Skill Progress</h2>
          <p className="text-secondary">Track your improvement over time across different skills.</p>
        </div>

        <div className="bg-surface-2 rounded-lg border border-primary p-6">
          <h2 className="text-lg font-medium mb-4">Progress Charts</h2>
          <p className="text-secondary">Visualize your training progress with detailed charts.</p>
        </div>
      </div>
    </div>
  )
}
