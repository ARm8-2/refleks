import type { BenchmarkListItem, Session } from '../../types/domain'
import type { Benchmark, BenchmarkProgress } from '../../types/ipc'
import { getScenarioName } from '../utils'

// --- Scenario Recommendations ---

export type ScenarioBenchmarkData = {
  rank: number
  score: number
  thresholds: number[]
  category?: string
}

export type RecommendationInputs = {
  wantedNames: string[]
  lastSessionCount: Map<string, number>
  sessions: Session[]
  benchmarkData: Map<string, ScenarioBenchmarkData>
}

// Numeric helpers
const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const stddev = (arr: number[]) => {
  if (!arr.length) return 0
  const m = mean(arr)
  const v = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length
  return Math.sqrt(v)
}
// Exponentially weighted slope (recent runs count more)
const weightedSlope = (arr: number[], alpha = 0.25): number => {
  const y = [...arr].reverse() // oldest -> newest
  const n = y.length
  if (n < 2) return 0
  const w: number[] = []
  for (let i = 0; i < n; i++) w.push(Math.exp(alpha * i))
  const sw = w.reduce((a, b) => a + b, 0)
  const mx = w.reduce((a, wi, i) => a + wi * (i + 1), 0) / sw
  const my = w.reduce((a, wi, i) => a + wi * (Number.isFinite(y[i]) ? y[i] : 0), 0) / sw
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    const x = i + 1
    const yi = Number.isFinite(y[i]) ? y[i] : 0
    const dx = x - mx
    num += w[i] * dx * (yi - my)
    den += w[i] * dx * dx
  }
  return den === 0 ? 0 : num / den
}

/**
 * Calculates normalized progress (0-1) for a scenario based on rank and score.
 */
function calculateProgress(rank: number, score: number, thresholds: number[]): number {
  const totalRanks = thresholds.length
  if (totalRanks === 0) return 0

  // Check if maxed (rank index is last index)
  if (rank >= totalRanks - 1) {
    return 1
  }

  let prev = 0
  let next = 0
  let baseRank = -1

  if (rank < 0) {
    // Unranked -> working towards first threshold
    prev = 0
    next = thresholds[0] || 0
    baseRank = -1
  } else {
    // Achieved rank i -> working towards i+1
    prev = thresholds[rank]
    next = thresholds[rank + 1] || prev
    baseRank = rank
  }

  const range = next - prev
  const frac = range > 0 ? (score - prev) / range : 0
  // Progress is (ranks achieved + partial progress) / total ranks
  return (baseRank + Math.max(0, Math.min(1, frac))) / totalRanks
}

// Compute recommendation score per scenario name
// Returns a score roughly -15 to +15, where higher means "Focus on this".
export function computeRecommendationScores(input: RecommendationInputs): Map<string, number> {
  const { wantedNames, lastSessionCount, sessions, benchmarkData } = input
  const now = Date.now()
  const out = new Map<string, number>()

  // Calculate normalized progress (0..1) and find median/average for relative comparison
  const progressMap = new Map<string, number>()
  const progressArr: number[] = []

  for (const name of wantedNames) {
    const data = benchmarkData.get(name)
    if (!data) continue
    const { rank, score, thresholds } = data

    // Old progress calculation (replaced by calculateProgress function)
    // const maxRank = Math.max(1, thresholds.length - 1)
    // const r = Math.max(0, Math.min(rank, maxRank))

    // let p = 0
    // if (r >= maxRank) {
    //   p = 1
    // } else {
    //   const prev = thresholds[r] ?? 0
    //   const next = thresholds[r + 1] ?? prev
    //   const range = next - prev
    //   const frac = range > 0 ? (score - prev) / range : 0
    //   p = (r + Math.max(0, Math.min(1, frac))) / maxRank
    // }

    const p = calculateProgress(rank, score, thresholds)

    progressMap.set(name, p)
    progressArr.push(p)
  }

  // Only consider scenarios that have been played (progress > 0) for comparison
  const playedProgressArr = progressArr.filter(p => p > 0)

  // Use MEDIAN as primary (robust to outliers)
  const medianProgress = playedProgressArr.length
    ? playedProgressArr.slice().sort((a, b) => a - b)[Math.floor(playedProgressArr.length / 2)] ?? 0.5
    : 0.5

  // Also calculate AVERAGE for additional context
  const avgProgress = playedProgressArr.length
    ? playedProgressArr.reduce((sum, p) => sum + p, 0) / playedProgressArr.length
    : 0.5

  // Build history map: scenario -> array of {time, score}
  const historyMap = new Map<string, { time: number, score: number }[]>()
  for (let i = 0; i < Math.min(sessions.length, 50); i++) {
    const s = sessions[i]
    const sTime = new Date(s.start).getTime()
    for (const item of s.items) {
      const name = getScenarioName(item)
      if (!wantedNames.includes(name)) continue
      const score = Number(item.stats?.['Score'] ?? 0)
      if (!historyMap.has(name)) historyMap.set(name, [])
      historyMap.get(name)?.push({ time: sTime, score })
    }
  }

  for (const name of wantedNames) {
    let totalScore = 0
    const p = progressMap.get(name) ?? 0
    const data = benchmarkData.get(name)
    const history = historyMap.get(name) || []

    // Skip scenarios with no progress (rank 0 or unplayed in benchmark range)
    // But still allow recommendations based on history/recency if they have data
    const hasValidProgress = p > 0

    // --- 1. Relative Weakness (Primary Driver: -10 to +10) ---
    // Only compare progress if the scenario has valid progress
    let progressDiff = 0
    if (hasValidProgress) {
      // Equal weight between median (50%) and average (50%)
      const medianDiff = medianProgress - p
      const avgDiff = avgProgress - p
      progressDiff = (medianDiff * 0.5) + (avgDiff * 0.5)

      // Scale: 0.1 difference = 3 points
      totalScore += progressDiff * 30

      // Extra boost for significantly weaker scenarios
      if (progressDiff > 0.2) {
        totalScore += 2
      }
    }
    // If no valid progress, don't factor progress comparison into score    // Strong penalty for maxed scenarios
    if (p >= 1) {
      totalScore -= 8
    }

    // --- 2. Trend Analysis (Score Improvement: -4 to +4) ---
    if (history.length >= 3) {
      const recentScores = history.slice(0, Math.min(10, history.length)).map(h => h.score)
      const slope = weightedSlope(recentScores)
      const std = stddev(recentScores)

      // Normalize slope by standard deviation
      const slopeNorm = std > 0 ? Math.max(-1, Math.min(1, slope / (3 * std))) : 0
      totalScore += slopeNorm * 4

      // Plateau detection: flat slope + low recent variance
      const recentStdVal = stddev(recentScores.slice(0, Math.min(6, recentScores.length)))
      const isPlateau = Math.abs(slopeNorm) < 0.05 && recentStdVal < (0.25 * (std || 1))

      if (isPlateau) {
        // If weak and plateaued, boost slightly (needs different approach)
        const progressDiff = p > 0 ? medianProgress - p : 0
        if (progressDiff > 0.1) {
          totalScore += 1 // Weak + plateaued = needs focus
        } else {
          totalScore -= 3 // Strong + plateaued = switch
        }
      }
    }

    // --- 3. Recency (-3 to +3) ---
    let lastPlayedTime = 0
    if (history.length > 0) {
      lastPlayedTime = history[0].time
    }

    if (lastPlayedTime > 0) {
      const hoursSince = (now - lastPlayedTime) / (1000 * 60 * 60)
      // Smooth gradient: negative if very recent, positive if old
      const recencyPoints = Math.max(-3, Math.min(3, (hoursSince - 12) / 12))
      totalScore += recencyPoints
    } else if (hasValidProgress) {
      // Has valid progress but never in history -> small boost
      totalScore += 1
    }
    // If no valid progress and no history, stays at 0

    // --- 4. Session Fatigue (Diminishing Returns: -10 to 0) ---
    const inSessionCount = lastSessionCount.get(name) ?? 0
    if (inSessionCount > 0) {
      // Exponential penalty for repeated play in same session
      totalScore -= Math.min(10, inSessionCount * 1.5)
    }

    // --- 5. PB Proximity Bonus (0 to +2) ---
    if (data && p < 1) {
      const { score, thresholds, rank } = data
      const maxRank = Math.max(1, thresholds.length - 1)
      const r = Math.max(0, Math.min(rank, maxRank))
      const next = thresholds[r + 1] ?? thresholds[r]
      const prev = thresholds[r] ?? 0
      const range = next - prev

      if (range > 0) {
        const dist = next - score
        const distPct = dist / range

        if (distPct < 0.05) {
          totalScore += 2 // Very close to rank up
        } else if (distPct < 0.15) {
          totalScore += 1 // Close to rank up
        }
      }
    }

    out.set(name, Math.round(totalScore))
  }

  return out
}

export function selectTopPicks(
  recScore: Map<string, number>,
  scenarioCategoryMap: Map<string, string>,
  maxPicks: number
): Set<string> {
  const entries = Array.from(recScore.entries())
  let candidates = entries.filter(([_, s]) => s >= 2)
  candidates.sort((a, b) => b[1] - a[1])

  if (candidates.length === 0) return new Set<string>()

  const topScore = candidates[0][1]
  candidates = candidates.filter(([_, s]) => s >= topScore - 1.5)

  const selected = new Set<string>()
  const selectedCats = new Set<string>()

  // First pass: try to pick unique categories
  for (const [name] of candidates) {
    if (selected.size >= maxPicks) break
    const cat = scenarioCategoryMap.get(name)
    if (cat && !selectedCats.has(cat)) {
      selected.add(name)
      selectedCats.add(cat)
    }
  }

  // Second pass: fill remaining spots if any
  if (selected.size < maxPicks) {
    for (const [name] of candidates) {
      if (selected.size >= maxPicks) break
      if (!selected.has(name)) {
        selected.add(name)
      }
    }
  }

  return selected
}

// --- Benchmark Recommendations ---

export type BenchmarkRecommendation = {
  item: BenchmarkListItem
  score: number
}

/**
 * Calculates a recommendation score for a specific benchmark based on its progress.
 * Higher score means more recommended.
 */
export function calculateBenchmarkScore(
  bench: Benchmark,
  progress: BenchmarkProgress | null
): number {
  if (!bench.difficulties || bench.difficulties.length === 0) return 0
  if (!progress) return 1 // Not started -> recommend (score 1)

  // This function is a placeholder for more granular scoring if needed.
  // Currently getBenchmarkRecommendations handles the logic.
  return 0
}


function calculateDifficultyProgress(prog: BenchmarkProgress): number {
  let totalProgress = 0
  let count = 0

  for (const cat of prog.categories) {
    for (const group of cat.groups) {
      for (const scen of group.scenarios) {
        const { scenarioRank, score, thresholds } = scen
        totalProgress += calculateProgress(scenarioRank, score, thresholds)
        count++
      }
    }
  }

  return count > 0 ? (totalProgress / count) * 100 : 0
}

function getDailyJitter(id: string): number {
  const today = new Date().toISOString().split('T')[0]
  const str = id + today
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return (Math.abs(hash) % 100) / 20 // 0 to 5 points
}

// Beginner boost configuration
const BEGINNER_SESSION_THRESHOLD = 10
const BEGINNER_BOOSTS: Record<string, number> = {
  'VT-Voltaic S5': 20,
  'V-Viscose Benchmarks': 19,
}

export function getBenchmarkRecommendations(
  items: BenchmarkListItem[],
  benchmarksById: Record<string, Benchmark>,
  progressMap: Record<number, BenchmarkProgress>,
  sessions: Session[] = []
): BenchmarkListItem[] {
  let candidates: BenchmarkRecommendation[] = []

  for (const item of items) {
    const bench = benchmarksById[item.id]
    if (!bench?.difficulties?.length) continue

    // Find Active Difficulty
    let activeDiffIndex = -1
    let isMaxed = false
    let progressVal = 0

    for (let i = 0; i < bench.difficulties.length; i++) {
      const diff = bench.difficulties[i]
      const prog = progressMap[diff.kovaaksBenchmarkId]

      // Check if maxed
      const rankCount = prog?.ranks?.length || 0
      const currentRankIndex = (prog?.overallRank || 0) - 1
      const diffMaxed = prog && currentRankIndex >= rankCount - 1

      if (!diffMaxed) {
        activeDiffIndex = i
        progressVal = prog ? calculateDifficultyProgress(prog) : 0
        break
      }
    }

    // If all maxed, set to last one
    if (activeDiffIndex === -1) {
      activeDiffIndex = bench.difficulties.length - 1
      isMaxed = true
    }

    // --- SCORING (0 - 100) ---
    let rawScore = 0

    // 1. State & Progress Score
    // Determines the value based on current progress and completion status
    if (isMaxed) {
      rawScore = 5 // Maintenance only
    } else if (activeDiffIndex === 0 && progressVal === 0) {
      rawScore = 50 // New Benchmark (Good to start)
    } else if (progressVal > 0) {
      // In Progress: 60 base + up to 30 based on progress
      // "Finish what you started" - Higher progress = Higher priority
      rawScore = 60 + (Math.min(progressVal, 100) / 100) * 30
    } else {
      // Next Logical Step (Previous was maxed, this is 0%)
      // High priority to continue the ladder
      rawScore = 70
    }
    // Jitter (0-5) to break ties
    rawScore += getDailyJitter(item.id)

    // 2. Beginner Boost - boost configured benchmarks for new users
    if (sessions.length < BEGINNER_SESSION_THRESHOLD) {
      const boost = BEGINNER_BOOSTS[item.id]
      if (boost) rawScore += boost
    }

    candidates.push({ item, score: rawScore })
  }

  if (candidates.length === 0) return []

  // --- NORMALIZATION (Scale to 0-100) ---
  // This ensures the "best" option always looks like a 100% match relative to others
  const maxRaw = Math.max(...candidates.map(c => c.score))
  const minRaw = Math.min(...candidates.map(c => c.score))
  const range = maxRaw - minRaw

  candidates = candidates.map(c => ({
    ...c,
    score: range > 0 ? ((c.score - minRaw) / range) * 100 : 100
  }))

  // Sort by normalized score
  candidates.sort((a, b) => b.score - a.score)

  // Filter: Only show high quality recommendations
  // Since we normalized, we can just take the top N or those above a certain %
  // But we should be careful if the "best" raw score was actually very low (e.g. everything maxed)
  // So we check maxRaw too.

  let selected: BenchmarkRecommendation[] = []

  if (maxRaw < 20) {
    // Everything is maxed or terrible, just show top 3
    selected = candidates.slice(0, 3)
  } else {
    // Take top 5, but only if they are within 70% of the best (which is 100)
    // So score >= 30 (since 100-70=30? No, relative to 100)
    // Let's say we want scores >= 60
    selected = candidates.filter(c => c.score >= 45)

    // Ensure at least 3 if available
    if (selected.length < 2) {
      selected = candidates.slice(0, 2)
    }
    // Cap at 5
    if (selected.length > 5) {
      selected = selected.slice(0, 5)
    }
  }

  return selected.map(c => c.item)
}
