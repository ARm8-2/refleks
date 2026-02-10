import type { Benchmark, BenchmarkProgress, Session } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateProgress(rank: number, score: number, thresholds: number[]): number {
  const totalRanks = thresholds.length
  if (totalRanks === 0) return 0
  if (rank >= totalRanks - 1) return 1

  let prev: number
  let next: number
  let baseRank: number

  if (rank < 0) {
    prev = 0
    next = thresholds[0] || 0
    baseRank = -1
  } else {
    prev = thresholds[rank]
    next = thresholds[rank + 1] || prev
    baseRank = rank
  }

  const range = next - prev
  const frac = range > 0 ? (score - prev) / range : 0
  return (baseRank + Math.max(0, Math.min(1, frac))) / totalRanks
}

function calculateDifficultyProgress(prog: BenchmarkProgress): number {
  let totalProgress = 0
  let count = 0

  for (const cat of prog.categories) {
    for (const group of cat.groups) {
      for (const scen of group.scenarios) {
        totalProgress += calculateProgress(scen.scenarioRank, scen.score, scen.thresholds)
        count++
      }
    }
  }

  return count > 0 ? (totalProgress / count) * 100 : 0
}

/** Deterministic daily jitter (0–5) to break ties differently each day. */
function getDailyJitter(id: string): number {
  const today = new Date().toISOString().split('T')[0]
  const str = id + today
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return (Math.abs(hash) % 100) / 20
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const BEGINNER_SESSION_THRESHOLD = 10
const BEGINNER_BOOSTS: Record<string, number> = {
  'Voltaic S5': 20,
  'Viscose Benchmarks': 19,
}

/**
 * Scores and selects 2–5 recommended benchmarks based on current progress.
 *
 * Scoring heuristic:
 * - Maxed benchmarks: 5 (maintenance only)
 * - New benchmarks (0% first difficulty): 50
 * - In-progress: 60 + up to 30 based on completion
 * - Next logical step (previous difficulty maxed): 70
 * - Daily jitter: 0–5 (breaks ties)
 * - Beginner boost: +20/+19 for starter benchmarks when sessions < 10
 */
export function getRecommendedBenchmarks(
  benchmarks: Benchmark[],
  progressMap: Record<number, BenchmarkProgress>,
  sessions: Session[] = [],
): Benchmark[] {
  type Candidate = { benchmark: Benchmark; score: number }
  let candidates: Candidate[] = []

  for (const bench of benchmarks) {
    if (!bench.difficulties?.length) continue

    const id = bench.benchmarkName

    // Find the active difficulty (first non-maxed)
    let activeDiffIndex = -1
    let isMaxed = false
    let progressVal = 0

    for (let i = 0; i < bench.difficulties.length; i++) {
      const diff = bench.difficulties[i]
      const prog = progressMap[diff.kovaaksBenchmarkId]

      const rankCount = prog?.ranks?.length || 0
      const currentRankIndex = (prog?.overallRank || 0) - 1
      const diffMaxed = prog && currentRankIndex >= rankCount - 1

      if (!diffMaxed) {
        activeDiffIndex = i
        progressVal = prog ? calculateDifficultyProgress(prog) : 0
        break
      }
    }

    if (activeDiffIndex === -1) {
      activeDiffIndex = bench.difficulties.length - 1
      isMaxed = true
    }

    // --- Scoring (0–100 raw) ---
    let rawScore = 0

    if (isMaxed) {
      rawScore = 5
    } else if (activeDiffIndex === 0 && progressVal === 0) {
      rawScore = 50 // New benchmark
    } else if (progressVal > 0) {
      rawScore = 60 + (Math.min(progressVal, 100) / 100) * 30 // In-progress
    } else {
      rawScore = 70 // Next logical step
    }

    rawScore += getDailyJitter(id)

    // Beginner boost
    if (sessions.length < BEGINNER_SESSION_THRESHOLD) {
      const boost = BEGINNER_BOOSTS[id]
      if (boost) rawScore += boost
    }

    candidates.push({ benchmark: bench, score: rawScore })
  }

  if (candidates.length === 0) return []

  // --- Normalize to 0–100 ---
  const maxRaw = Math.max(...candidates.map(c => c.score))
  const minRaw = Math.min(...candidates.map(c => c.score))
  const range = maxRaw - minRaw

  candidates = candidates.map(c => ({
    ...c,
    score: range > 0 ? ((c.score - minRaw) / range) * 100 : 100,
  }))

  candidates.sort((a, b) => b.score - a.score)

  // --- Select top picks ---
  let selected: Candidate[]

  if (maxRaw < 20) {
    selected = candidates.slice(0, 3)
  } else {
    selected = candidates.filter(c => c.score >= 45)
    if (selected.length < 2) selected = candidates.slice(0, 2)
    if (selected.length > 5) selected = selected.slice(0, 5)
  }

  return selected.map(c => c.benchmark)
}
