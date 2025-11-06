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
        <>
          <BenchmarkProgress progress={progress} />
          {/* Context/help under BenchmarkProgress, focused on the Recom column */}
          <div className="text-xs text-[var(--text-secondary)]">
            <div className="mb-2">Recom indicates how strongly we suggest playing a scenario now versus rotating. Higher is better; negative means “switch/rotate”.</div>
            <ul className="list-disc pl-5">
              <li>Built from recent trends in your Score, Accuracy, and Real Avg TTK (recent runs weigh more).</li>
              <li>Gets a boost when you’re close to the next rank threshold and for weaker-achieved ranks.</li>
              <li>Penalizes very recent repeats and overlong streaks in your last session; nudges toward the estimated optimal runs.</li>
              <li>Light bonus for under-practiced scenarios to balance your training.</li>
              <li>Arrow shows direction: ▲ positive (push) · ▼ negative (rotate). Around 0 is neutral.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
