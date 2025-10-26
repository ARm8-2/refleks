import { BenchmarkProgress } from "../../../components";
import type { Benchmark } from '../../../types/ipc';

export function OverviewTab({ bench, difficultyIndex, loading, error, progress }:
  { bench?: Benchmark; difficultyIndex: number; loading: boolean; error: string | null; progress: Record<string, any> | null }) {
  return (
    <div className="space-y-3">
      {loading && <div className="text-sm text-[var(--text-secondary)]">Loading progress…</div>}
      {error && <div className="text-sm text-red-400">{error}</div>}
      {progress && bench && !loading && !error && (
        <BenchmarkProgress bench={bench} difficultyIndex={difficultyIndex} progress={progress} />
      )}
    </div>
  )
}
