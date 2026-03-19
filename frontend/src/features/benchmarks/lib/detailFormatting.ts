export { getScenarioName } from '@/shared/lib'
import { MISSING_STR } from './detailConstants'

export function formatNumber(value: unknown, decimals = 2, trimTrailingZeros = true): string {
  if (value == null || value === '') return MISSING_STR
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return MISSING_STR

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: trimTrailingZeros ? 0 : decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(number)
}

export function computeFillColor(
  achievedRank: number | undefined | null,
  rankDefs: Array<{ color?: string }>,
  fallback = 'var(--muted-foreground)',
): string {
  const achieved = Number(achievedRank || 0)
  if (!achieved || achieved <= 0) return fallback

  const lastIndex = Math.max(0, Math.min((rankDefs?.length ?? 0) - 1, achieved - 1))
  return rankDefs?.[lastIndex]?.color ?? fallback
}

export function cellFill(index: number, score: number, thresholds: number[]): number {
  const maxIndex = thresholds?.length ?? 0
  if (maxIndex < 2) return 0

  const previous = thresholds[index] ?? 0
  const next = thresholds[index + 1] ?? previous

  if (next <= previous) return Number(score ?? 0) >= next ? 1 : 0

  const fraction = (Number(score ?? 0) - previous) / (next - previous)
  return Math.max(0, Math.min(1, fraction))
}

export function normalizedRankProgress(scenarioRank: number, score: number, thresholds: number[]): number {
  const count = thresholds?.length ?? 0
  const maxRank = count > 0 ? count - 1 : 0
  if (maxRank <= 0) return 0

  const rank = Math.max(0, Math.min(maxRank, Number(scenarioRank || 0)))

  if (rank <= 0) {
    const previous = thresholds[0] ?? 0
    const next = thresholds[1] ?? previous
    const denominator = next - previous
    if (denominator <= 0) return 0

    const fraction = Math.max(0, Math.min(1, (Number(score || 0) - previous) / denominator))
    return fraction * (1 / maxRank)
  }

  if (rank >= maxRank) return 1

  const previous = thresholds[rank] ?? 0
  const next = thresholds[rank + 1] ?? previous
  if (next <= previous) return rank / maxRank

  const fraction = Math.max(0, Math.min(1, (Number(score || 0) - previous) / (next - previous)))
  return (rank - 1) / maxRank + fraction * (1 / maxRank)
}
