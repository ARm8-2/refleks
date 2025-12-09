import { Check, ChevronDown, ChevronUp } from 'lucide-react'

export function RecommendationLegend({ embedded }: { embedded?: boolean }) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center -space-y-1.5 text-accent"><ChevronUp size={12} /><ChevronUp size={12} /></div>
        <span>Top Pick</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center -space-y-1.5 text-success"><ChevronUp size={12} /><ChevronUp size={12} /></div>
        <span>Strongly Recommended</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center -space-y-1.5 text-success"><ChevronUp size={12} /></div>
        <span>Recommended</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center -space-y-1.5 text-warning"><ChevronUp size={12} /></div>
        <span>Consider Playing</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center -space-y-1.5 text-warning"><ChevronDown size={12} /></div>
        <span>Consider Switching</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center -space-y-1.5 text-danger"><ChevronDown size={12} /><ChevronDown size={12} /></div>
        <span>Stop / Switch</span>
      </div>
      <div className="flex items-center gap-2">
        <Check size={12} className="text-tertiary" />
        <span>Completed</span>
      </div>
    </>
  )

  if (embedded) {
    return <div className="flex flex-wrap gap-6 text-xs text-secondary">{content}</div>
  }

  return (
    <div className="bg-surface-2 rounded border border-primary">
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary">
        <div className="text-sm font-medium text-primary">Recommendation Legend</div>
      </div>
      <div className="p-3 flex flex-wrap gap-6 text-xs text-secondary">
        {content}
      </div>
    </div>
  )
}
