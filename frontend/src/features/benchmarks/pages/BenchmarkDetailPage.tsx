import { ArrowLeft, Play, Star } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Loading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/components'
import { useBenchmarks } from '../../../shared/hooks'
import { launchPlaylist } from '../../../shared/lib'
import { BenchmarkProgressTable } from '../components/detail/BenchmarkProgressTable'
import { RankDistributionWidget } from '../components/detail/RankDistributionWidget'
import { StrengthWidget } from '../components/detail/StrengthWidget'
import { useBenchmarkDetailProgress } from '../hooks/useBenchmarkDetailProgress'

export function BenchmarkDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { getBenchmarkByName, selectBenchmark, loading, isFavorite, toggleFavorite } = useBenchmarks()

  const name = id ? decodeURIComponent(id) : ''

  useEffect(() => {
    if (name) selectBenchmark(name)
  }, [name, selectBenchmark])

  const handleBack = () => {
    selectBenchmark(null)
    navigate('/benchmarks')
  }

  if (loading) return <Loading />

  const benchmark = name ? getBenchmarkByName(name) : null
  const { progress, loading: progressLoading, error, difficultyIndex, setDifficultyIndex } = useBenchmarkDetailProgress(benchmark ?? undefined)

  const difficulty = benchmark?.difficulties?.[difficultyIndex]
  const favorite = benchmark ? isFavorite(benchmark.benchmarkName) : false

  return (
    <div className="flex-1 overflow-auto text-sm">
      <div className="sticky top-0 z-10 bg-background px-6 py-4">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>

          <h1 className="min-w-0 truncate text-lg font-semibold text-foreground">
            {benchmark?.abbreviation
              ? `${benchmark.abbreviation} ${benchmark.benchmarkName}`
              : (benchmark?.benchmarkName ?? id)}
          </h1>

          {benchmark?.difficulties?.length ? (
            <Select value={String(difficultyIndex)} onValueChange={value => setDifficultyIndex(Number(value) || 0)}>
              <SelectTrigger className="h-8 w-auto min-w-0 max-w-[240px] px-2.5 text-xs sm:text-sm">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                {benchmark.difficulties.map((item, index) => (
                  <SelectItem key={`${item.kovaaksBenchmarkId}-${index}`} value={String(index)}>
                    {item.difficultyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => difficulty?.sharecode && launchPlaylist(difficulty.sharecode)}
            disabled={!difficulty?.sharecode}
            title="Play benchmark playlist in Kovaak's"
          >
            <Play className="h-4 w-4" />
          </Button>

          {benchmark && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(benchmark.benchmarkName)}
              title={favorite ? 'Unfavorite benchmark' : 'Favorite benchmark'}
            >
              <Star className="h-4 w-4" fill={favorite ? 'currentColor' : 'none'} />
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {!benchmark && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Benchmark not found.
          </div>
        )}

        {benchmark && progressLoading && <Loading />}

        {benchmark && !progressLoading && error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {benchmark && !progressLoading && !error && progress && (
          <>
            <BenchmarkProgressTable
              benchmark={benchmark}
              difficultyName={difficulty?.difficultyName || 'Unknown difficulty'}
              progress={progress}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <StrengthWidget progress={progress} />
              <RankDistributionWidget progress={progress} />
            </div>
          </>
        )}

        {benchmark && !progressLoading && !error && !progress && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No progress data available yet for this difficulty.
          </div>
        )}
      </div>
    </div>
  )
}
