import type { ScenarioRecord } from '../../types/ipc';

// Compute 'findings' (strongest/weakest runs) from a list of ScenarioRecord.
// This extracts the ranking logic out of the UI component so pages can compute
// results and pass plain data to presentational components.
export function computeFindings(items: ScenarioRecord[], topN = 3): { strongest: ScenarioRecord[]; weakest: ScenarioRecord[] } {
  if (!Array.isArray(items) || items.length === 0) return { strongest: [], weakest: [] }

  function normalize(arr: number[]): (x: number) => number {
    const vals = arr.filter(n => Number.isFinite(n))
    if (vals.length === 0) return () => 0.5
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    if (!isFinite(min) || !isFinite(max) || max === min) return () => 0.5
    return (x: number) => (x - min) / (max - min)
  }

  // Build metric arrays
  const scores = items.map(it => Number(it.stats['Score'] ?? 0))
  const accs01 = items.map(it => Number(it.stats['Accuracy'] ?? 0)) // 0..1
  const ttks = items.map(it => Number(it.stats['Real Avg TTK'] ?? NaN))

  const nScore = normalize(scores)
  const nAcc = normalize(accs01.map(a => a * 100)) // percent scale for stability
  const nTtk = normalize(ttks)

  const wScore = 0.6, wAcc = 0.35, wTtk = 0.05

  const ranked = items.map((rec, i) => {
    const s = nScore(scores[i])
    const a = nAcc(accs01[i] * 100)
    const t = nTtk(ttks[i])
    const composite = wScore * s + wAcc * a + wTtk * (1 - t)
    return { rec, score: composite }
  }).sort((a, b) => b.score - a.score)

  const strongest = ranked.slice(0, Math.min(topN, ranked.length)).map(r => r.rec)
  const weakest = ranked.slice(-Math.min(topN, ranked.length)).reverse().map(r => r.rec)
  return { strongest, weakest }
}
