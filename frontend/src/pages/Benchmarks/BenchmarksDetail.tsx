import { Camera, ChevronLeft, Play, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ShareBenchmarkProgress from '../../components/benchmarks/ShareBenchmarkProgress';
import { Dropdown } from '../../components/shared/Dropdown';
import { Tabs } from '../../components/shared/Tabs';
import { useOpenedBenchmarkProgress } from '../../hooks/useOpenedBenchmarkProgress';
import { useUIState } from '../../hooks/useUIState';
import { copyNodeToClipboard } from '../../lib/clipboard';
import { launchPlaylist } from '../../lib/internal';
import type { Benchmark } from '../../types/ipc';
import { AiTab } from './tabs/Ai';
import { AnalysisTab } from './tabs/Analysis';
import { OverviewTab } from './tabs/Overview';

type BenchmarksDetailProps = {
  id: string
  bench?: Benchmark
  favorites: string[]
  onToggleFav: (id: string) => void
  onBack: () => void
}

function useBenchmarkShare() {
  const [renderShare, setRenderShare] = useState(false)
  const shareRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!renderShare) return
    let cancelled = false
    const doCapture = async () => {
      const node = shareRef.current
      if (!node) { setRenderShare(false); return }
      try {
        const imgs = Array.from(node.querySelectorAll('img')) as HTMLImageElement[]
        await Promise.all(imgs.map(img => new Promise<void>(resolve => {
          if (img.complete && img.naturalWidth !== 0) return resolve()
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        })))

        if (cancelled) return
        const bg = getComputedStyle(node).backgroundColor
        const res = await copyNodeToClipboard(node, { pixelRatio: 2, backgroundColor: bg })
        if (res.copied) {
          alert('Share image copied to clipboard!')
        } else {
          alert('Clipboard not available. Saved image instead.')
        }
      } catch (e) {
        alert('Failed to copy image: ' + (e as Error)?.message)
      } finally {
        setRenderShare(false)
      }
    }
    void doCapture()
    return () => { cancelled = true }
  }, [renderShare])

  return { renderShare, setRenderShare, shareRef }
}

export function BenchmarksDetail({ id, bench, favorites, onToggleFav, onBack }: BenchmarksDetailProps) {
  const [tab, setTab] = useUIState<'overview' | 'analysis' | 'ai'>(`benchmark:${id}:tab`, 'overview')
  const { progress, loading, error, difficultyIndex, setDifficultyIndex } = useOpenedBenchmarkProgress({ id, bench: bench ?? null })
  const { renderShare, setRenderShare, shareRef } = useBenchmarkShare()

  return (
    <div className="space-y-3 p-4 h-full overflow-auto">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-surface-3 text-primary"
          aria-label="Back"
          title="Back"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-lg font-medium flex items-center gap-2">
          <span>Benchmark: {bench ? `${bench.abbreviation} ${bench.benchmarkName}` : id}</span>
          <button
            onClick={() => { if (bench) launchPlaylist(bench.difficulties[difficultyIndex].sharecode) }}
            disabled={!bench}
            className="p-1 rounded hover:bg-surface-3 text-primary mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Play benchmark playlist"
            title="Play benchmark playlist in Kovaak's"
          >
            <Play size={18} />
          </button>
          <button
            onClick={() => { if (bench && progress) setRenderShare(true) }}
            disabled={!bench || !progress}
            className="p-1 rounded hover:bg-surface-3 text-primary mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Copy share image"
            title="Copy share image to clipboard"
          >
            <Camera size={18} />
          </button>
          <button
            onClick={() => onToggleFav(id)}
            className={`p-1 rounded hover:bg-surface-3 mb-1 transition-colors ${favorites.includes(id) ? 'text-accent' : 'text-primary hover:text-accent'}`}
            aria-label={favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
            title={favorites.includes(id) ? 'Unfavorite' : 'Favorite'}
          >
            <Star
              size={20}
              strokeWidth={1.5}
              fill={favorites.includes(id) ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>
      {bench?.difficulties?.length ? (
        <div className="flex items-center gap-2">
          <Dropdown
            label="Difficulty"
            size="md"
            value={difficultyIndex}
            onChange={(v: string) => setDifficultyIndex(Number(v))}
            options={bench.difficulties.map((d, i) => ({ label: d.difficultyName, value: i }))}
          />
        </div>
      ) : <div className="text-sm text-secondary">No difficulties info.</div>}
      <Tabs tabs={[
        { id: 'overview', label: 'Overview', content: <OverviewTab bench={bench} difficultyIndex={difficultyIndex} loading={loading} error={error} progress={progress} /> },
        { id: 'analysis', label: 'Analysis', content: <AnalysisTab bench={bench} difficultyIndex={difficultyIndex} loading={loading} error={error} progress={progress} /> },
        { id: 'ai', label: 'AI Insights', content: <AiTab /> },
      ]} active={tab} onChange={(id) => setTab(id as any)} />

      {bench && progress && renderShare && (
        <div style={{ position: 'fixed', left: -99999, top: -99999, pointerEvents: 'none' }} aria-hidden>
          <div ref={shareRef}>
            <ShareBenchmarkProgress bench={bench} difficultyIndex={difficultyIndex} progress={progress!} />
          </div>
        </div>
      )}
    </div>
  )
}
