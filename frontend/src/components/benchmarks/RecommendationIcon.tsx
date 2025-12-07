import { ChevronDown, ChevronUp, Minus } from 'lucide-react'

type RecommendationIconProps = {
  score: number
  compact?: boolean
}

export function RecommendationIcon({ score, compact }: RecommendationIconProps) {
  const s = compact ? 12 : 14
  const space = compact ? '-space-y-1' : '-space-y-1.5'

  if (score >= 3) return <div className={`flex flex-col items-center ${space} text-[var(--success)]`}><ChevronUp size={s} /><ChevronUp size={s} /></div>
  if (score === 2) return <div className={`flex flex-col items-center ${space} text-[var(--success)]`}><ChevronUp size={s} /></div>
  if (score === 1) return <div className={`flex flex-col items-center ${space} text-[var(--warning)]`}><ChevronUp size={s} /></div>
  if (score === -1) return <div className={`flex flex-col items-center ${space} text-[var(--warning)]`}><ChevronDown size={s} /></div>
  if (score <= -2) return <div className={`flex flex-col items-center ${space} text-[var(--error)]`}><ChevronDown size={s} /><ChevronDown size={s} /></div>
  return <Minus size={s} className="text-[var(--text-tertiary)]" />
}
