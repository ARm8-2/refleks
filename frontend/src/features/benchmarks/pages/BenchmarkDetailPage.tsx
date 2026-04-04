import {
  Button,
  Loading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components'
import { useBenchmarks } from '@/shared/hooks'
import { launchPlaylist } from '@/shared/lib'
import { ArrowLeft, Check, Play, Share2, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BenchmarkProgressTable } from '../components/detail/BenchmarkProgressTable'
import { RankDistributionWidget } from '../components/detail/RankDistributionWidget'
import { StrengthWidget } from '../components/detail/StrengthWidget'
import { useBenchmarkDetailProgress } from '../hooks/useBenchmarkDetailProgress'

export function BenchmarkDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { getBenchmarkByName, selectBenchmark, loading, isFavorite, toggleFavorite } = useBenchmarks()
  const shareCaptureRef = useRef<HTMLDivElement | null>(null)
  const [isCopyingShare, setIsCopyingShare] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const name = id ? decodeURIComponent(id) : ''

  useEffect(() => {
    if (name) selectBenchmark(name)
  }, [name, selectBenchmark])

  const handleBack = () => {
    selectBenchmark(null)
    navigate('/benchmarks')
  }

  const showInitialSkeleton = loading

  const benchmark = name ? getBenchmarkByName(name) : null
  const { progress, loading: progressLoading, error, difficultyIndex, setDifficultyIndex } = useBenchmarkDetailProgress(benchmark ?? undefined)

  const difficulty = benchmark?.difficulties?.[difficultyIndex]
  const favorite = benchmark ? isFavorite(benchmark.benchmarkName) : false

  const handleCopyShareImage = async () => {
    if (!shareCaptureRef.current || isCopyingShare) return

    try {
      setIsCopyingShare(true)
      setShareCopied(false)

      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        alert('Image clipboard is not supported in this environment.')
        return
      }

      const { toBlob } = await import('html-to-image')
      const blob = await toBlob(shareCaptureRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      })

      if (!blob) {
        throw new Error('Failed to generate screenshot image')
      }

      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1800)
    } catch (error) {
      console.error('Failed to copy benchmark screenshot:', error)
      alert('Failed to copy screenshot.')
    } finally {
      setIsCopyingShare(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto text-sm">
      <div className="sticky top-0 z-20 bg-canvas px-6 py-4">
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
              onClick={handleCopyShareImage}
              disabled={isCopyingShare || !progress || !!error || progressLoading}
              title={shareCopied ? 'Copied!' : 'Copy progress table screenshot'}
            >
              {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </Button>
          )}

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

      <div className="p-6 space-y-4">
        {showInitialSkeleton && (
          <div className="space-y-3 rounded-xl bg-surface p-6 shadow-sm">
            <div className="h-5 w-56 animate-pulse rounded-md bg-surface-subtle" />
            <div className="h-[320px] animate-pulse rounded-xl bg-surface-subtle" />
          </div>
        )}

        {!showInitialSkeleton && !benchmark && (
          <div className="rounded-xl bg-surface p-6 text-sm text-surface-muted-foreground shadow-sm">
            Benchmark not found.
          </div>
        )}

        {!showInitialSkeleton && benchmark && progressLoading && <Loading />}

        {!showInitialSkeleton && benchmark && !progressLoading && error && (
          <div className="rounded-xl border border-destructive-border bg-destructive-soft p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!showInitialSkeleton && benchmark && !progressLoading && !error && progress && (
          <>
            <BenchmarkProgressTable
              benchmark={benchmark}
              difficultyName={difficulty?.difficultyName || 'Unknown difficulty'}
              progress={progress}
            />

            <div className="pointer-events-none fixed -left-[10000px] top-0 z-[-1]">
              <div ref={shareCaptureRef} className="w-[1500px] bg-canvas p-6">
                <BenchmarkProgressTable
                  benchmark={benchmark}
                  difficultyName={difficulty?.difficultyName || 'Unknown difficulty'}
                  progress={progress}
                  shareMode
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <StrengthWidget progress={progress} />
              <RankDistributionWidget progress={progress} />
            </div>
          </>
        )}

        {!showInitialSkeleton && benchmark && !progressLoading && !error && !progress && (
          <div className="rounded-xl bg-surface p-6 text-sm text-surface-muted-foreground shadow-sm">
            No progress data available yet for this difficulty.
          </div>
        )}
      </div>
    </div>
  )
}
