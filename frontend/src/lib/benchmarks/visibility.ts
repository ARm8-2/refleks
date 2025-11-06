// Helpers for computing which rank columns to auto-hide

/**
 * Compute which rank indices should be hidden automatically.
 * Strategy: hide earliest (left-most) fully-cleared ranks while keeping at least `targetVisible` columns visible.
 * - "Cleared" means every scenario's achieved rank is strictly greater than the rank index.
 * - We hide at most `totalRanks - targetVisible` columns from the left.
 */
export function autoHiddenRanks(
  totalRanks: number,
  scenarioRanks: number[],
  enabled: boolean,
  targetVisible: number,
): Set<number> {
  const hidden = new Set<number>()
  if (!enabled) return hidden
  const n = Math.max(0, Math.floor(totalRanks || 0))
  if (n === 0) return hidden
  const ranksArr = Array.isArray(scenarioRanks) ? scenarioRanks : []
  if (ranksArr.length === 0) return hidden

  const target = Math.max(1, Math.min(n, Math.floor(targetVisible || 1)))

  // The earliest fully-cleared span on the left is min achieved across all scenarios
  let minAchieved = Number.POSITIVE_INFINITY
  for (const sr of ranksArr) {
    const r = Math.max(0, Math.min(n, Number(sr || 0)))
    if (r < minAchieved) minAchieved = r
  }
  if (!Number.isFinite(minAchieved) || minAchieved <= 0) return hidden

  // We can hide at most this many while keeping target columns visible
  const maxHide = Math.max(0, n - target)
  const hideCount = Math.max(0, Math.min(maxHide, Math.floor(minAchieved)))
  for (let i = 0; i < hideCount; i++) hidden.add(i)
  return hidden
}
