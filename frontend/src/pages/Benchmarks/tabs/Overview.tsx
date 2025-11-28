import { BenchmarkProgress } from "../../../components";
import type { Benchmark, BenchmarkProgress as BenchProgress } from '../../../types/ipc';

type BenchmarksOverviewTabProps = {
  bench?: Benchmark
  difficultyIndex: number
  loading: boolean
  error: string | null
  progress: BenchProgress | null
}

export function OverviewTab({ bench, loading, error, progress }: BenchmarksOverviewTabProps) {
  return (
    <div className="space-y-3">
      {loading && <div className="text-sm text-[var(--text-secondary)]">Loading progress…</div>}
      {error && <div className="text-sm text-red-400">{error}</div>}
      {progress && bench && !loading && !error && (
        <BenchmarkProgress progress={progress} />
      )}
    </div>
  )
}
