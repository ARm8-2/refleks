import { ChevronDown, ChevronUp } from 'lucide-react'

export function RecommendationLegend() {
  return (
    <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="text-sm font-medium text-[var(--text-primary)]">Recommendation Legend</div>
      </div>
      <div className="p-3 flex flex-wrap gap-6 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center -space-y-1.5 text-[var(--success)]"><ChevronUp size={12} /><ChevronUp size={12} /></div>
          <span>Strongly Recommended</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center -space-y-1.5 text-[var(--success)]"><ChevronUp size={12} /></div>
          <span>Recommended</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center -space-y-1.5 text-[var(--warning)]"><ChevronUp size={12} /></div>
          <span>Consider Playing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center -space-y-1.5 text-[var(--warning)]"><ChevronDown size={12} /></div>
          <span>Consider Switching</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center -space-y-1.5 text-[var(--error)]"><ChevronDown size={12} /><ChevronDown size={12} /></div>
          <span>Stop / Switch</span>
        </div>
      </div>
    </div>
  )
}
