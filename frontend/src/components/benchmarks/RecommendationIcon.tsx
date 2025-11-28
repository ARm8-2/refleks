import { ChevronDown, ChevronUp, Minus } from 'lucide-react'

type RecommendationIconProps = {
  score: number
}

export function RecommendationIcon({ score }: RecommendationIconProps) {
  if (score >= 3) return <div className="flex flex-col items-center -space-y-1.5 text-[var(--success)]"><ChevronUp size={14} /><ChevronUp size={14} /></div>
  if (score === 2) return <div className="flex flex-col items-center -space-y-1.5 text-[var(--success)]"><ChevronUp size={14} /></div>
  if (score === 1) return <div className="flex flex-col items-center -space-y-1.5 text-[var(--warning)]"><ChevronUp size={14} /></div>
  if (score === -1) return <div className="flex flex-col items-center -space-y-1.5 text-[var(--warning)]"><ChevronDown size={14} /></div>
  if (score <= -2) return <div className="flex flex-col items-center -space-y-1.5 text-[var(--error)]"><ChevronDown size={14} /><ChevronDown size={14} /></div>
  return <Minus size={14} className="text-[var(--text-tertiary)]" />
}
