import { Check, ChevronDown, ChevronUp, Minus } from 'lucide-react'

type Props = {
  score: number
  isTopPick?: boolean
  isCompleted?: boolean
  compact?: boolean
}

export function RecommendationIndicator({ score, isTopPick, isCompleted, compact }: Props) {
  const size = compact ? 12 : 14
  const stackClass = compact ? '-space-y-1' : '-space-y-1.5'

  if (isCompleted) return <Check size={size} className="text-surface-muted-foreground" />

  const upColor = isTopPick ? 'text-primary' : 'text-success'

  if (score >= 5) {
    return (
      <div className={`flex flex-col items-center ${stackClass} ${upColor}`}>
        <ChevronUp size={size} />
        <ChevronUp size={size} />
      </div>
    )
  }

  if (score >= 3) {
    return (
      <div className={`flex flex-col items-center ${stackClass} ${upColor}`}>
        <ChevronUp size={size} />
      </div>
    )
  }

  if (score >= 1) {
    return (
      <div className={`flex flex-col items-center ${stackClass} text-warning`}>
        <ChevronUp size={size} />
      </div>
    )
  }

  if (score <= -3) {
    return (
      <div className={`flex flex-col items-center ${stackClass} text-destructive`}>
        <ChevronDown size={size} />
        <ChevronDown size={size} />
      </div>
    )
  }

  if (score <= -1) {
    return (
      <div className={`flex flex-col items-center ${stackClass} text-warning`}>
        <ChevronDown size={size} />
      </div>
    )
  }

  return <Minus size={size} className="text-surface-muted-foreground" />
}
