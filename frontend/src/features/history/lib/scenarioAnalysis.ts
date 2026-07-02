import type { RunStatsEvent, RunStatsSummary } from '@/shared/types'

/* ─── Types ─── */

export type AnalysisSummary = {
  kills: number
  shots: number
  hits: number
  finalAcc: number
  longestGap: number
  avgGap: number
  avgTTK: number
  medianTTK: number
  stdTTK: number
  p10TTK: number
  p90TTK: number
  meanKPM: number
}

export type MovingAvgData = {
  ma5: number[]
  slope: number
  intercept: number
  r2: number
  ma5NetChange: number
  meanMA5: number
  stdMA5: number
}

export type ScatterData = {
  corrKpmAcc: number
  centroidKPM: number
  centroidAcc: number
}

export type ScenarioAnalysis = {
  labels: string[]
  timeSec: number[]
  realTTK: number[]
  accOverTime: number[]
  cumKills: number[]
  perKillAcc: number[]
  kpm: number[]
  summary: AnalysisSummary
  movingAvg: MovingAvgData
  scatter: ScatterData
}

/* ─── Math helpers ─── */

function mean(arr: number[]): number {
  let s = 0, n = 0
  for (const v of arr) if (Number.isFinite(v)) { s += v; n++ }
  return n ? s / n : 0
}

function median(arr: number[]): number {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y)
  const n = a.length
  if (!n) return 0
  const mid = Math.floor(n / 2)
  return n % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

function stddev(arr: number[]): number {
  const a = arr.filter(Number.isFinite)
  const m = mean(a)
  if (!a.length) return 0
  let s2 = 0
  for (const v of a) s2 += (v - m) ** 2
  return Math.sqrt(s2 / a.length)
}

function percentile(arr: number[], p: number): number {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y)
  if (!a.length) return 0
  const idx = (a.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return a[lo]
  const w = idx - lo
  return a[lo] * (1 - w) + a[hi] * w
}

function rollingAvg(arr: number[], window: number): number[] {
  const out: number[] = []
  const q: number[] = []
  let s = 0
  for (let i = 0; i < arr.length; i++) {
    const v = Number.isFinite(arr[i]) ? arr[i] : 0
    q.push(v)
    s += v
    if (q.length > window) s -= q.shift()!
    out.push(s / Math.min(window, q.length))
  }
  return out
}

function linreg(ys: number[]): { a: number; b: number; r2: number } {
  const n = ys.length
  if (n < 2) return { a: 0, b: 0, r2: 0 }
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += ys[i]; sumXX += i * i; sumXY += i * ys[i]
  }
  const denom = n * sumXX - sumX * sumX
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
  const a = (sumY - b * sumX) / n
  const ymean = sumY / n
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) {
    ssRes += (ys[i] - (a + b * i)) ** 2
    ssTot += (ys[i] - ymean) ** 2
  }
  return { a, b, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 }
}

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const mx = mean(xs), my = mean(ys)
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  const den = Math.sqrt(dx2 * dy2)
  return den > 0 ? num / den : 0
}

/* ─── Timestamp parsing ─── */

const SEC_IN_DAY = 86400

function toSec(v: unknown): number {
  const s = String(v || '')
  const m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/)
  if (!m) return NaN
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + (m[4] ? parseFloat('0.' + m[4]) : 0)
}

function fmtRel(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ─── Main analysis ─── */

export function computeScenarioAnalysis(stats: RunStatsSummary, events: RunStatsEvent[]): ScenarioAnalysis | null {
  const kills = Array.isArray(events) ? events : []
  if (kills.length < 1) return null

  const firstKillSec = toSec(kills[0]?.timestamp)
  const startSecRaw = toSec(stats?.challengeStart)
  const originSec = Number.isFinite(firstKillSec) ? firstKillSec : (Number.isFinite(startSecRaw) ? startSecRaw : 0)

  const labels: string[] = []
  const timeSec: number[] = []
  const realTTK: number[] = []
  const accOverTime: number[] = []
  const cumKills: number[] = []
  const perKillAcc: number[] = []
  const kpm: number[] = []

  let cumShots = 0, cumHits = 0, prevSec = originSec
  let idx = 0, longestGap = 0, sumGap = 0

  for (const event of kills) {
    const ts = toSec(event.timestamp)
    if (!Number.isFinite(ts)) continue

    const rel = ts >= originSec ? (ts - originSec) : (ts + (SEC_IN_DAY - originSec))

    if (timeSec.length === 0) {
      labels.push(fmtRel(0))
      timeSec.push(0)
      realTTK.push(0)
      prevSec = ts
    } else {
      labels.push(fmtRel(rel))
      timeSec.push(rel)
      let d = ts - prevSec
      if (d < 0) d += SEC_IN_DAY
      realTTK.push(d)
      if (d > longestGap) longestGap = d
      if (Number.isFinite(d)) sumGap += d
      prevSec = ts
    }

    const shots = event.shots
    const hits = event.hits
    if (Number.isFinite(shots)) cumShots += shots
    if (Number.isFinite(hits)) cumHits += hits

    accOverTime.push(cumShots > 0 ? cumHits / cumShots : 0)
    perKillAcc.push(shots > 0 ? Math.min(1, Math.max(0, hits / shots)) : 0)

    idx += 1
    cumKills.push(idx)

    const lastD = realTTK[realTTK.length - 1]
    kpm.push(lastD > 0 ? 60 / lastD : 0)
  }

  if (timeSec.length < 1) return null

  const avgGap = sumGap / Math.max(1, timeSec.length - 1)
  const ma5 = rollingAvg(realTTK, 5)
  const { a: intercept, b: slope, r2 } = linreg(ma5)

  return {
    labels,
    timeSec,
    realTTK,
    accOverTime,
    cumKills,
    perKillAcc,
    kpm,
    summary: {
      kills: timeSec.length,
      shots: cumShots,
      hits: cumHits,
      finalAcc: cumShots > 0 ? cumHits / cumShots : 0,
      longestGap,
      avgGap,
      avgTTK: mean(realTTK),
      medianTTK: median(realTTK),
      stdTTK: stddev(realTTK),
      p10TTK: percentile(realTTK, 0.1),
      p90TTK: percentile(realTTK, 0.9),
      meanKPM: mean(kpm),
    },
    movingAvg: {
      ma5,
      slope,
      intercept,
      r2,
      ma5NetChange: ma5.length >= 2 ? ma5[ma5.length - 1] - ma5[0] : 0,
      meanMA5: mean(ma5),
      stdMA5: stddev(ma5),
    },
    scatter: {
      corrKpmAcc: pearson(kpm, perKillAcc),
      centroidKPM: mean(kpm),
      centroidAcc: mean(perKillAcc),
    },
  }
}
