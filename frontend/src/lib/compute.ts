import type { ScenarioRecord } from '../types/ipc'

export type ScenarioComputed = {
  labels: string[]
  realTTK: number[]
  accOverTime: number[]
  cumKills: number[]
  perKillAcc: number[]
  kpm: number[]
  timeSec: number[]
  summary: {
    kills: number
    shots: number
    hits: number
    finalAcc: number
    longestGap: number
    avgGap: number
    avgTTK: number
    medianTTK: number
    stdTTK: number
    p10TTK?: number
    p90TTK?: number
    meanKPM?: number
  }
  movingAvg: {
    ma5: number[]
    slope: number
    intercept?: number
    r2: number
    rollStd5: number[]
    stableSegments: Array<{ start: number; end: number }>
    ma5NetChange?: number
    meanMA5?: number
    stdMA5?: number
    meanRollStd5?: number
  }
  scatter: {
    corrKpmAcc: number
    meanBinStdAcc: number
    binsUsed: number
    medianNNDist: number
    centroidKPM?: number
    centroidAcc?: number
    clusterCompactness?: number
  }
}

// Parse HH:MM:SS(.ms) into seconds-of-day
function toSec(v: any): number {
  const s = String(v || '')
  const m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/)
  if (!m) return NaN
  const hh = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  const ss = parseInt(m[3], 10)
  const frac = m[4] ? parseFloat('0.' + m[4]) : 0
  return hh * 3600 + mm * 60 + ss + frac
}

function fmtRel(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

function mean(arr: number[]): number {
  if (!arr.length) return 0
  let s = 0
  let n = 0
  for (const v of arr) if (Number.isFinite(v)) { s += v; n++ }
  return n ? s / n : 0
}

function median(arr: number[]): number {
  const a = arr.filter(Number.isFinite).slice().sort((a, b) => a - b)
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
  for (const v of a) s2 += (v - m) * (v - m)
  return Math.sqrt(s2 / a.length)
}

function percentile(arr: number[], p: number): number {
  const a = arr.filter(Number.isFinite).slice().sort((x, y) => x - y)
  if (!a.length) return 0
  const idx = (a.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return a[lo]
  const w = idx - lo
  return a[lo] * (1 - w) + a[hi] * w
}

function rollingAvg(arr: number[], window: number): number[] {
  const out = new Array(arr.length).fill(0)
  const q: number[] = []
  let s = 0
  for (let i = 0; i < arr.length; i++) {
    const v = Number.isFinite(arr[i]) ? arr[i] : 0
    q.push(v)
    s += v
    if (q.length > window) s -= q.shift()!
    const denom = Math.min(window, q.length)
    out[i] = denom ? s / denom : 0
  }
  return out
}

function rollingStd(arr: number[], window: number): number[] {
  const out = new Array(arr.length).fill(0)
  const q: number[] = []
  for (let i = 0; i < arr.length; i++) {
    const v = Number.isFinite(arr[i]) ? arr[i] : 0
    q.push(v)
    if (q.length > window) q.shift()
    const m = mean(q)
    const sd = Math.sqrt(mean(q.map(x => (x - m) * (x - m))))
    out[i] = sd
  }
  return out
}

function linreg(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return { a: 0, b: 0, r2: 0 }
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i]
    sumX += x; sumY += y; sumXX += x * x; sumXY += x * y
  }
  const denom = n * sumXX - sumX * sumX
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
  const a = (sumY - b * sumX) / n
  // r^2
  const yhat = xs.map(x => a + b * x)
  const ymean = sumY / n
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) { ssRes += (ys[i] - yhat[i]) ** 2; ssTot += (ys[i] - ymean) ** 2 }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
  return { a, b, r2 }
}

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const mx = mean(xs), my = mean(ys)
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const den = Math.sqrt(dx2 * dy2)
  return den > 0 ? num / den : 0
}

function nearestNeighborMedian(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) return 0
  const dists: number[] = []
  for (let i = 0; i < points.length; i++) {
    let best = Infinity
    const p = points[i]
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue
      const q = points[j]
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      if (d < best) best = d
    }
    if (best < Infinity) dists.push(best)
  }
  return median(dists)
}

export function computeScenarioAnalysis(item: ScenarioRecord): ScenarioComputed {
  // treat rows as kills (each row is a kill event)
  const kills = Array.isArray(item.events) ? item.events : []
  const secInDay = 86400
  const startStr = (item.stats as any)?.['Challenge Start']
  const startSecRaw = toSec(startStr)
  // prefer first kill timestamp as origin so first kill is at t=0
  const firstKillSec = toSec(kills[0]?.[1])
  let originSec = Number.isFinite(firstKillSec) ? firstKillSec : (Number.isFinite(startSecRaw) ? startSecRaw : 0)

  const labels: string[] = []
  const timeSec: number[] = []
  const realTTK: number[] = []
  const accOverTime: number[] = []
  const cumKills: number[] = []
  const perKillAcc: number[] = []
  const kpm: number[] = []
  let cumShots = 0
  let cumHits = 0
  let prevSec = originSec
  let idx = 0
  let longestGap = 0
  let sumGap = 0

  for (const row of kills) {
    const ts = toSec(row[1])
    if (!Number.isFinite(ts)) continue
    // relative time since first kill (originSec)
    const rel = ts >= originSec ? (ts - originSec) : (ts + (secInDay - originSec))
    // first kill should be at 0s and have a TTK of 0
    if (timeSec.length === 0) {
      labels.push(fmtRel(0))
      timeSec.push(0)
      realTTK.push(0)
      prevSec = ts
      // preserve longestGap/sumGap behavior (first gap counted as 0)
    } else {
      labels.push(fmtRel(rel))
      timeSec.push(rel)
      // gaps (time between consecutive kills)
      let d = ts - prevSec
      if (d < 0) d += secInDay
      realTTK.push(d)
      if (d > longestGap) longestGap = d
      if (Number.isFinite(d)) sumGap += d
      prevSec = ts
    }

    const shots = parseFloat(row[5] || '0')
    const hits = parseFloat(row[6] || '0')
    if (Number.isFinite(shots)) cumShots += shots
    if (Number.isFinite(hits)) cumHits += hits
    const acc = cumShots > 0 ? (cumHits / cumShots) : 0
    accOverTime.push(acc)

    const perAcc = shots > 0 ? Math.min(1, Math.max(0, hits / shots)) : 0
    perKillAcc.push(perAcc)

    idx += 1
    cumKills.push(idx)

    // use the most recently pushed realTTK value for KPM (minutes per kill)
    const lastD = realTTK[realTTK.length - 1]
    const k = lastD > 0 ? 60 / lastD : 0
    kpm.push(k)
  }

  const avgGap = kills.length > 0 ? (sumGap / Math.max(1, kills.length - 1)) : 0
  const avgTTK = mean(realTTK)
  const medianTTK = median(realTTK)
  const stdTTK = stddev(realTTK)
  const p10TTK = percentile(realTTK, 0.1)
  const p90TTK = percentile(realTTK, 0.9)
  const meanKPM = mean(kpm)

  const ma5 = rollingAvg(realTTK, 5)
  const xs = ma5.map((_, i) => i)
  const { a, b: slope, r2 } = linreg(xs, ma5)
  // rolling std over window 5
  const rollStd5 = rollingStd(realTTK, 5)
  const thresh = median(rollStd5.filter(Number.isFinite))
  const meanRollStd5 = mean(rollStd5)
  const meanMA5 = mean(ma5)
  const stdMA5 = stddev(ma5)
  const ma5NetChange = (ma5.length >= 2) ? (ma5[ma5.length - 1] - ma5[0]) : 0
  const stableSegments: Array<{ start: number; end: number }> = []
  let s = -1
  for (let i = 0; i < rollStd5.length; i++) {
    if (rollStd5[i] <= thresh) {
      if (s === -1) s = i
    } else if (s !== -1) {
      stableSegments.push({ start: s, end: i - 1 })
      s = -1
    }
  }
  if (s !== -1) stableSegments.push({ start: s, end: rollStd5.length - 1 })
  // keep top 2 by duration
  stableSegments.sort((p, q) => (q.end - q.start) - (p.end - p.start))
  const stableTop2 = stableSegments.slice(0, 2)

  // Scatter metrics
  const corrKpmAcc = pearson(kpm, perKillAcc)
  // binning by KPM
  const finiteKpm = kpm.filter(Number.isFinite)
  const minK = finiteKpm.length ? Math.min(...finiteKpm) : 0
  const maxK = finiteKpm.length ? Math.max(...finiteKpm) : 0
  const rangeK = Math.max(1e-6, maxK - minK)
  const binCount = Math.max(3, Math.min(10, Math.round(Math.sqrt(kpm.length))))
  const bins: number[][] = Array.from({ length: binCount }, () => [])
  for (let i = 0; i < kpm.length; i++) {
    const k = kpm[i]
    const aAcc = perKillAcc[i]
    if (!Number.isFinite(k)) continue
    const b = Math.min(binCount - 1, Math.max(0, Math.floor(((k - minK) / rangeK) * binCount)))
    bins[b].push(aAcc)
  }
  let sumStd = 0
  let used = 0
  for (const arr of bins) {
    if (arr.length >= 3) { sumStd += stddev(arr); used++ }
  }
  const meanBinStdAcc = used ? (sumStd / used) : 0
  // nearest neighbor in normalized space
  const nx = kpm.map(v => rangeK > 0 ? (v - minK) / rangeK : 0.5)
  const accMin = perKillAcc.length ? Math.min(...perKillAcc) : 0
  const accMax = perKillAcc.length ? Math.max(...perKillAcc) : 1
  const rA = Math.max(1e-6, accMax - accMin)
  const ny = perKillAcc.map(v => rA > 0 ? (v - accMin) / rA : 0.5)
  const pts = nx.map((x, i) => ({ x, y: ny[i] }))
  const medianNNDist = nearestNeighborMedian(pts)
  // centroid & compactness in normalized space
  const cx = mean(nx), cy = mean(ny)
  let compSum = 0, compN = 0
  for (const p of pts) { const d = Math.hypot(p.x - cx, p.y - cy); if (Number.isFinite(d)) { compSum += d; compN++ } }
  const clusterCompactness = compN ? (compSum / compN) : 0
  const centroidKPM = meanKPM
  const centroidAcc = mean(perKillAcc)

  return {
    labels,
    timeSec,
    realTTK,
    accOverTime,
    cumKills,
    perKillAcc,
    kpm,
    summary: {
      kills: kills.length,
      shots: cumShots,
      hits: cumHits,
      finalAcc: cumShots > 0 ? (cumHits / cumShots) : 0,
      longestGap,
      avgGap,
      avgTTK,
      medianTTK,
      stdTTK,
      p10TTK,
      p90TTK,
      meanKPM,
    },
    movingAvg: {
      ma5,
      slope,
      intercept: a,
      r2,
      rollStd5,
      stableSegments: stableTop2,
      ma5NetChange,
      meanMA5,
      stdMA5,
      meanRollStd5,
    },
    scatter: {
      corrKpmAcc,
      meanBinStdAcc,
      binsUsed: used,
      medianNNDist,
      centroidKPM,
      centroidAcc,
      clusterCompactness,
    }
  }
}
