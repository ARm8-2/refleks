import type { Session } from '../../types/domain';
import type { ScenarioRecord } from '../../types/ipc';
import { getScenarioName } from '../utils';

export type MetricsSeries = { score: number[]; acc: number[]; ttk: number[] }

/**
 * Group runs by scenario name, collecting arrays for score, accuracy (%), and Real Avg TTK.
 * Runs are assumed newest-first coming in; resulting arrays are also newest-first.
 */
export function groupByScenario(items: ScenarioRecord[]): Map<string, MetricsSeries> {
  const m = new Map<string, MetricsSeries>()
  for (const it of items) {
    const name = getScenarioName(it)
    const score = Number(it.stats['Score'] ?? 0)
    const accRaw = Number(it.stats['Accuracy'] ?? 0) // 0..1
    const acc = Number.isFinite(accRaw) ? accRaw * 100 : 0
    const ttk = Number(it.stats['Real Avg TTK'] ?? NaN)
    const prev = m.get(name) ?? { score: [], acc: [], ttk: [] }
    prev.score.push(Number.isFinite(score) ? score : 0)
    prev.acc.push(Number.isFinite(acc) ? acc : 0)
    prev.ttk.push(Number.isFinite(ttk) ? ttk : 0)
    m.set(name, prev)
  }
  return m
}

/**
 * Compute per-session averages for a given scenario name (newest-first by session).
 */
export function computeSessionAverages(sessions: Session[], scenarioName: string): MetricsSeries {
  const score: number[] = []
  const acc: number[] = []
  const ttk: number[] = []
  for (const sess of sessions) {
    const items = sess.items.filter(it => getScenarioName(it) === scenarioName)
    if (items.length === 0) continue
    let sSum = 0, aSum = 0, tSum = 0
    for (const it of items) {
      const s = Number(it.stats['Score'] ?? 0)
      const a01 = Number(it.stats['Accuracy'] ?? 0)
      const t = Number(it.stats['Real Avg TTK'] ?? NaN)
      sSum += Number.isFinite(s) ? s : 0
      aSum += Number.isFinite(a01) ? a01 * 100 : 0
      tSum += Number.isFinite(t) ? t : 0
    }
    const n = items.length
    score.push(sSum / n)
    acc.push(aSum / n)
    ttk.push(tSum / n)
  }
  return { score, acc, ttk }
}

/**
 * Build chart-ready series from newest-first arrays: returns oldest->newest labels and reversed data arrays.
 */
export function buildChartSeries(series: MetricsSeries): { labels: string[]; score: number[]; acc: number[]; ttk: number[] } {
  const labels = series.score.map((_, i) => `#${series.score.length - i}`)
  return {
    labels,
    score: [...series.score].reverse(),
    acc: [...series.acc].reverse(),
    ttk: [...series.ttk].reverse(),
  }
}
