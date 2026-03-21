import { Widget } from '@/shared/components';
import { Gauge, Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { SnapshotTone } from '../../hooks/useRecentSessionSnapshot';

export function EmptyMetricWidget({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Widget
      title={<span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>}
      className="px-4 py-3"
    >
      <div className="text-lg font-semibold text-muted-foreground">--</div>
      <div className="mt-0.5 text-xs text-muted-foreground">No session loaded</div>
    </Widget>
  )
}

export function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'flat' | null }) {
  if (!trend || trend === 'flat') return null
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-[color:var(--success)]" />
  return <TrendingDown className="h-3.5 w-3.5 text-[color:var(--warning)]" />
}

export function formatScore(score: number): string {
  return score >= 1000 ? `${(score / 1000).toFixed(1)}k` : score.toFixed(0)
}

export function formatScoreCompact(score: number): string {
  if (score >= 10000) return `${(score / 1000).toFixed(1)}k`
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`
  return score.toFixed(0)
}

export function getStatusIcon(tone: SnapshotTone): LucideIcon {
  switch (tone) {
    case 'success': return TrendingUp
    case 'warning': return TrendingDown
    case 'neutral': return Minus
    case 'muted':
    default: return Gauge
  }
}

export function getToneBadgeClasses(tone: SnapshotTone): string {
  switch (tone) {
    case 'success': return 'border-transparent bg-[rgb(16_183_127_/_0.14)] text-[color:var(--success)]'
    case 'warning': return 'border-transparent bg-[rgb(245_159_10_/_0.16)] text-[rgb(180_110_0)] dark:text-[rgb(255_201_107)]'
    case 'neutral': return 'border-primary-border bg-primary-soft text-primary'
    case 'muted':
    default: return 'border-border-soft bg-muted-soft text-muted-foreground'
  }
}

export function getPerformanceAccent(tone: SnapshotTone): string {
  switch (tone) {
    case 'success': return 'text-[color:var(--success)]'
    case 'warning': return 'text-[color:var(--warning)]'
    case 'neutral': return 'text-primary'
    case 'muted':
    default: return 'text-muted-foreground'
  }
}

export function buildScoreDomain(scores: number[], referenceScores: number[] = []): [number, number] {
  const values = [...scores, ...referenceScores].filter(value => Number.isFinite(value) && value > 0)
  if (values.length === 0) return [0, 1]

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    const pad = Math.max(1, Math.round(max * 0.04))
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
  }

  const span = max - min
  const pad = Math.max(1, Math.round(span * 0.18))
  const lower = Math.max(0, Math.floor(min - pad))
  const upper = Math.ceil(max + pad)
  return upper > lower ? [lower, upper] : [Math.max(0, lower - 1), lower + 1]
}
