import type { Benchmark } from '@/shared/types'
import { ChevronRight, Star } from 'lucide-react'
import type { MouseEvent } from 'react'

interface BenchmarkCardProps {
  benchmark: Benchmark
  isFavorite: boolean
  onToggleFavorite: () => void
  onSelect?: () => void
}

export function BenchmarkCard({ benchmark, isFavorite, onToggleFavorite, onSelect }: BenchmarkCardProps) {
  const handleToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onToggleFavorite()
  }

  return (
    <div
      onClick={onSelect}
      className="relative group cursor-pointer rounded-xl bg-surface pl-2 pr-10 py-2 transition-[transform,background-color] duration-220 ease-emphasized will-change-transform hover:bg-surface-muted motion-safe:hover:scale-[1.01]"
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
          e.preventDefault()
          onSelect()
        }
      }}
      tabIndex={0}
      role="button"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
          title={isFavorite ? 'Unfavorite' : 'Favorite'}
          onClick={handleToggle}
          className={`inline-flex items-center justify-center rounded w-8 h-8 focus:outline-none transition-colors hover:bg-surface-emphasis ${isFavorite ? 'text-primary' : 'text-foreground hover:text-primary'
            }`}
        >
          <Star size={20} strokeWidth={1.5} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        <div className="font-medium text-foreground truncate flex-1">
          {benchmark.benchmarkName}
        </div>

        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 border-border text-surface-muted-foreground"
          style={benchmark.color ? { borderColor: benchmark.color, color: benchmark.color } : undefined}
          title={benchmark.abbreviation}
        >
          {benchmark.abbreviation}
        </span>

        {/* Right arrow hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-muted-foreground transition-colors duration-150 group-hover:text-foreground pointer-events-none">
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  )
}
