import { BenchmarkStrengths } from '../../../components/benchmarks/BenchmarkStrengths';
import { RankDistributionDonut } from '../../../components/benchmarks/RankDistributionDonut';
import { Loading } from '../../../components/shared/Loading';
import type { Benchmark, BenchmarkProgress } from '../../../types/ipc';

type BenchmarksAnalysisTabProps = { bench?: Benchmark; difficultyIndex: number; loading: boolean; error: string | null; progress: BenchmarkProgress | null }

export function AnalysisTab({ bench, difficultyIndex, loading, error, progress }: BenchmarksAnalysisTabProps) {
  if (loading) return <Loading />
  if (error) return <div className="text-sm text-red-400">{error}</div>
  if (!bench || !progress) return <div className="text-sm text-secondary">No data.</div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <BenchmarkStrengths bench={bench} difficultyIndex={difficultyIndex} progress={progress} height={400} />
      <RankDistributionDonut bench={bench} difficultyIndex={difficultyIndex} progress={progress} height={400} />
    </div>
  )
}
