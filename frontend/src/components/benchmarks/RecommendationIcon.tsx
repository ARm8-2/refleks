import { Check, ChevronDown, ChevronUp, Minus } from 'lucide-react'

type RecommendationIconProps = {
  score: number
  compact?: boolean
  isTopPick?: boolean
  isCompleted?: boolean
}

export function RecommendationIcon({ score, compact, isTopPick, isCompleted }: RecommendationIconProps) {
  const s = compact ? 12 : 14
  const space = compact ? '-space-y-1' : '-space-y-1.5'

  if (isCompleted) return <Check size={s} className="text-[var(--text-tertiary)]" />

  const colorStyle = isTopPick ? { color: 'var(--accent-primary)' } : undefined
  const successClass = isTopPick ? '' : 'text-[var(--success)]'

  if (score >= 3) return <div className={`flex flex-col items-center ${space} ${successClass}`} style={colorStyle}><ChevronUp size={s} /><ChevronUp size={s} /></div>
  if (score === 2) return <div className={`flex flex-col items-center ${space} ${successClass}`} style={colorStyle}><ChevronUp size={s} /></div>
  if (score === 1) return <div className={`flex flex-col items-center ${space} text-[var(--warning)]`}><ChevronUp size={s} /></div>
  if (score === -1) return <div className={`flex flex-col items-center ${space} text-[var(--warning)]`}><ChevronDown size={s} /></div>
  if (score <= -2) return <div className={`flex flex-col items-center ${space} text-[var(--error)]`}><ChevronDown size={s} /><ChevronDown size={s} /></div>
  return <Minus size={s} className="text-[var(--text-tertiary)]" />
}