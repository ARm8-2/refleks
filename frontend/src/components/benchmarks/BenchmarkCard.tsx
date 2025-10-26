import { Star } from 'lucide-react';
import React from 'react';

type BenchmarkCardProps = {
  id: string
  title: string
  abbreviation: string
  color?: string
  isFavorite: boolean
  onOpen: (id: string) => void
  onToggleFavorite: (id: string) => void
}
export function BenchmarkCard({ id, title, abbreviation, color, isFavorite, onOpen, onToggleFavorite }: BenchmarkCardProps) {
  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onToggleFavorite(id)
  }
  return (
    <div
      onClick={() => onOpen(id)}
      className="cursor-pointer pl-2 pr-4 py-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
          title={isFavorite ? 'Unfavorite' : 'Favorite'}
          onClick={handleToggle}
          className="inline-flex items-center justify-center rounded w-8 h-8 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus:outline-none"
        >
          <Star size={20} strokeWidth={1.5} style={{ color: isFavorite ? 'var(--accent-primary)' as any : undefined, fill: isFavorite ? 'var(--accent-primary)' : 'none' }} />
        </button>
        <div className="font-medium text-[var(--text-primary)] truncate flex-1">{title}</div>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0"
          style={{ borderColor: color || 'var(--border-primary)', color: color || 'var(--text-secondary)' }}
          title={abbreviation}
        >
          {abbreviation}
        </span>
      </div>
    </div>
  )
}
