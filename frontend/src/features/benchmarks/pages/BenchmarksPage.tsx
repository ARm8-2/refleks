
export function BenchmarksPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">Benchmarks</h1>
      </div>

      <div className="grid gap-6">
        {/* Placeholder content - will be replaced with actual benchmark components */}
        <div className="bg-surface-2 rounded-lg border border-primary p-6">
          <h2 className="text-lg font-medium mb-4">Available Benchmarks</h2>
          <p className="text-secondary">Browse and select benchmarks to track your scores.</p>
        </div>

        <div className="bg-surface-2 rounded-lg border border-primary p-6">
          <h2 className="text-lg font-medium mb-4">Your Rankings</h2>
          <p className="text-secondary">View your rankings and progress in each benchmark.</p>
        </div>
      </div>
    </div>
  )
}
