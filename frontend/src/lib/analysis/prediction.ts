import type { ScenarioRecord } from '../../types/ipc'
import { getDatePlayed, getScenarioName } from '../utils'

export type HighscorePrediction = {
  // Legacy time-based ETA derived from recommended cadence and expected runs
  etaTs: number | null
  etaHuman: string
  // New runs-based forecast
  runsExpected: number | null
  runsLo: number | null
  runsHi: number | null
  optPauseHours: number | null
  // Diagnostics
  confidence: 'low' | 'med' | 'high'
  sample: number
  best: number
  lastScore: number
  lastPlayedDays: number
  slopePerDay: number
  slopePerRun: number
  reason?: string
}

const DAY = 24 * 3600 * 1000

function humanizeETA(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'soon'
  const totalMin = Math.round(ms / (60 * 1000))
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin % (60 * 24)) / 60)
  const mins = totalMin % 60
  if (days <= 0) {
    if (hours <= 0) return `${mins}m`
    // under a day, show Hh Mm when there are minutes
    return mins ? `${hours}h ${mins}m` : `${hours}h`
  }
  if (days < 7) return mins ? `${days}d ${hours}h ${mins}m` : (hours ? `${days}d ${hours}h` : `${days}d`)
  const weeks = Math.floor(days / 7)
  const remDays = days % 7
  return remDays ? `${weeks}w ${remDays}d` : `${weeks}w`
}

// Try to get a precise timestamp from fileName, else fall back to Date Played + Challenge Start
export function parseRecordTimestamp(it: ScenarioRecord): number {
  const fn = String(it.fileName || '')
  const m = fn.match(/(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/)
  if (m) {
    const y = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10) - 1
    const d = parseInt(m[3], 10)
    const hh = parseInt(m[4], 10)
    const mm = parseInt(m[5], 10)
    const ss = parseInt(m[6], 10)
    return new Date(y, mo, d, hh, mm, ss).getTime()
  }
  const dateStr = getDatePlayed(it.stats)
  const timeStr = String((it.stats as any)?.['Challenge Start'] ?? '')
  if (dateStr) {
    // Try to parse common formats; build ISO-ish when possible
    const d1 = dateStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
    let ts = NaN
    if (d1) {
      const y = parseInt(d1[1], 10)
      const mo = parseInt(d1[2], 10) - 1
      const d = parseInt(d1[3], 10)
      if (timeStr) {
        const t = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2})/)
        if (t) {
          ts = new Date(y, mo, d, parseInt(t[1], 10), parseInt(t[2], 10), parseInt(t[3], 10)).getTime()
        }
      }
      if (!Number.isFinite(ts)) ts = new Date(y, mo, d).getTime()
      return ts
    }
    // MM/DD/YYYY or DD/MM/YYYY – ambiguous; use Date.parse and hope environment locale handles it
    const parsed = Date.parse(dateStr)
    if (Number.isFinite(parsed)) return parsed
  }
  return Date.now()
}

function weightedLinReg(xs: number[], ys: number[], ws: number[]): { a: number; b: number; r2: number } {
  const n = Math.min(xs.length, ys.length, ws.length)
  if (n < 2) return { a: 0, b: 0, r2: 0 }
  let Sw = 0, Swx = 0, Swy = 0, Swxx = 0, Swxy = 0
  for (let i = 0; i < n; i++) {
    const w = ws[i]
    const x = xs[i]
    const y = ys[i]
    Sw += w
    Swx += w * x
    Swy += w * y
    Swxx += w * x * x
    Swxy += w * x * y
  }
  const denom = Sw * Swxx - Swx * Swx
  const b = denom !== 0 ? (Sw * Swxy - Swx * Swy) / denom : 0
  const a = Sw !== 0 ? (Swy - b * Swx) / Sw : 0
  // weighted R^2
  const yhat = xs.map(x => a + b * x)
  const ymean = Sw !== 0 ? (Swy / Sw) : 0
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) {
    const w = ws[i]
    const e = ys[i] - yhat[i]
    ssRes += w * e * e
    const d = ys[i] - ymean
    ssTot += w * d * d
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
  return { a, b, r2 }
}

export function collectScenarioHistory(items: ScenarioRecord[], name: string): Array<{ t: number; score: number; sessionId: number }> {
  // Group by sessions using a fixed gap threshold (minutes). If user changes app settings,
  // this can be wired later, but here we keep a sane default independent of UI store.
  const SESSION_GAP_MIN = 30
  const gapMs = SESSION_GAP_MIN * 60 * 1000
  const runs: Array<{ t: number; score: number; sessionId: number }> = []
  // Filter to scenario and collect raw with end timestamps
  const filtered: Array<{ t: number; score: number; fileName: string }> = []
  for (const it of items) {
    if (getScenarioName(it) !== name) continue
    const score = Number(it.stats['Score'] ?? 0)
    if (!Number.isFinite(score)) continue
    filtered.push({ t: parseRecordTimestamp(it), score, fileName: String(it.fileName || '') })
  }
  // Order oldest -> newest
  filtered.sort((a, b) => a.t - b.t)
  // Assign session ids by gap
  let sid = 0
  let lastT = Number.NEGATIVE_INFINITY
  for (const f of filtered) {
    if (!Number.isFinite(lastT) || (f.t - lastT) > gapMs) sid++
    runs.push({ t: f.t, score: f.score, sessionId: sid })
    lastT = f.t
  }
  return runs
}

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)) }

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0
  const a = [...arr].sort((x, y) => x - y)
  const pos = clamp(q, 0, 1) * (a.length - 1)
  const lo = Math.floor(pos), hi = Math.ceil(pos), f = pos - lo
  if (hi === lo) return a[lo]
  return a[lo] * (1 - f) + a[hi] * f
}

// Fit deltaScore per run as a function of pause between runs: delta ~= a * (1 - exp(-dt/tau)) + b
function fitDeltaVsPause(dtDays: number[], deltas: number[], pairWeights: number[]) {
  // Adapt the time constant search to the observed within-session gaps (minutes-scale)
  const safe = dtDays.filter(Number.isFinite).filter(v => v > 0)
  const minDt = safe.length ? Math.max(1 / (24 * 60), Math.min(...safe)) : 5 / (24 * 60) // >=1min (default 5min)
  const maxDt = safe.length ? Math.max(minDt * 5, quantile(safe, 0.9)) : 2 / 24 // default 2h
  const lo = Math.log10(minDt / 3)
  const hi = Math.log10(maxDt * 3)
  const taus: number[] = []
  const steps = 25
  for (let i = 0; i < steps; i++) {
    const x = lo + (hi - lo) * (i / (steps - 1))
    taus.push(Math.pow(10, x))
  }
  let best = { tau: Math.sqrt(minDt * maxDt), a: 0, b: 0, r2: 0 }
  for (const tau of taus) {
    const x = dtDays.map(d => 1 - Math.exp(-Math.max(0, d) / tau))
    const { a, b, r2 } = weightedLinReg(x, deltas, pairWeights)
    if (r2 > best.r2) best = { tau, a, b, r2 }
  }
  return best
}

function expectedDeltaAtPause(a: number, b: number, tau: number, dtDays: number): number {
  const x = 1 - Math.exp(-Math.max(0, dtDays) / Math.max(1e-6, tau))
  return a * x + b
}

function findOptimalPauseAndRuns(deficit: number, fit: { a: number; b: number; tau: number },
  dtMinDays: number, dtMaxDays: number, dtStepDays: number) {
  // Minimize total time = runs * dt, with runs = deficit / expectedDelta(dt),
  // constrained to a realistic within-session pause range.
  let best = { dtDays: 1, runs: Number.POSITIVE_INFINITY, delta: 0 }
  for (let d = dtMinDays; d <= dtMaxDays + 1e-9; d += dtStepDays) {
    const delta = Math.max(0, expectedDeltaAtPause(fit.a, fit.b, fit.tau, d))
    if (delta <= 1e-6) continue
    const runs = deficit / delta
    const time = runs * d
    if (!Number.isFinite(time)) continue
    if (time < best.runs * best.dtDays) {
      best = { dtDays: d, runs, delta }
    }
  }
  if (!Number.isFinite(best.runs)) return null
  return best
}

export function predictNextHighscore(items: ScenarioRecord[], name: string): HighscorePrediction {
  const now = Date.now()
  const hist = collectScenarioHistory(items, name)
  const n = hist.length
  if (n < 4) {
    return { etaTs: null, etaHuman: 'unknown', runsExpected: null, runsLo: null, runsHi: null, optPauseHours: null, confidence: 'low', sample: n, best: 0, lastScore: 0, lastPlayedDays: 0, slopePerDay: 0, slopePerRun: 0, reason: 'Need at least 4 runs' }
  }
  const best = Math.max(...hist.map(h => h.score))
  const last = hist[n - 1]
  const lastPlayedDays = (now - last.t) / DAY
  // Basic arrays (for diagnostics)
  const t0 = hist[0].t
  const xsDays = hist.map(h => (h.t - t0) / DAY)
  const ys = hist.map(h => h.score)
  // Recency weighting by runs for diagnostics (not used to drive the model decisions)
  const idx = ys.map((_, i) => i)
  const halfLifeRuns = 6
  const wsRuns = idx.map(i => Math.pow(0.5, (n - 1 - i) / halfLifeRuns))
  // Diagnostics: compute slopes but do not use them to drive predictions
  const { b: slopePerRun } = weightedLinReg(idx, ys, wsRuns)
  const halfLifeDays = 21
  const wsDaysDiag = hist.map(h => Math.pow(0.5, (now - h.t) / (halfLifeDays * DAY)))
  const MIN_W = 0.04
  const xs2: number[] = []
  const ys2: number[] = []
  const ws2: number[] = []
  for (let i = 0; i < xsDays.length; i++) {
    if (n > 40 && wsDaysDiag[i] < MIN_W) continue
    xs2.push(xsDays[i]); ys2.push(ys[i]); ws2.push(wsDaysDiag[i])
  }
  const { b: slopePerDay } = weightedLinReg(xs2, ys2, ws2)

  // Prepare runs-based delta model across observed adjacent runs, but strictly within the same session
  const dtDays: number[] = [] // gap in days (we'll convert to minutes for reasoning)
  const deltas: number[] = []
  const pairWeights: number[] = []
  for (let i = 1; i < n; i++) {
    if (hist[i].sessionId !== hist[i - 1].sessionId) continue // cross-session gap: skip
    const d = (hist[i].t - hist[i - 1].t) / DAY
    const ds = ys[i] - ys[i - 1]
    // guard very small dt to 1 minute to avoid numeric issues
    const MIN_DAY = 1 / (24 * 60)
    dtDays.push(Math.max(MIN_DAY, d))
    deltas.push(ds)
    // weight more recent pairs and moderate by magnitude to reduce outlier impact
    const w = Math.pow(0.5, (n - 1 - i) / halfLifeRuns)
    pairWeights.push(w)
  }
  const havePairs = dtDays.length >= 2
  // Robustify deltas: clip to IQR
  if (deltas.length >= 6) {
    const q1 = quantile(deltas, 0.25)
    const q3 = quantile(deltas, 0.75)
    const iqr = Math.max(1, q3 - q1)
    for (let i = 0; i < deltas.length; i++) {
      deltas[i] = clamp(deltas[i], q1 - 1.5 * iqr, q3 + 1.5 * iqr)
    }
  }
  // Positive delta stats for fallback and confidence
  const pos = deltas.map(x => Math.max(0, x))
  const meanPos = pos.reduce((a, b) => a + b, 0) / Math.max(1, pos.length)
  const varPos = pos.reduce((a, b) => a + (b - meanPos) * (b - meanPos), 0) / Math.max(1, pos.length)
  const stdPos = Math.sqrt(Math.max(0, varPos))

  const fit = havePairs ? fitDeltaVsPause(dtDays, deltas, pairWeights) : { a: 0, b: 0, tau: 5 / (24 * 60), r2: 0 }
  const deficitMargin = Math.max(1, Math.round(best * 0.003))
  const target = best + deficitMargin
  const deficit = target - last.score
  // Near-best shortcut: if already within a tiny margin, expect 1–2 runs soon.
  const epsImprovement = Math.max(1, Math.round(best * 0.0002)) // ~0.02% of best, at least 1 point
  if (best - last.score <= epsImprovement) {
    const soonPauseH = Math.max(1, Math.round(quantile(dtDays, 0.25) * 24))
    const soonTs = now + Math.max(DAY * 0.25, soonPauseH * (60 * 60 * 1000))
    const pairSample = dtDays.length
    const sizeFactor = Math.min(1, pairSample / 24)
    const confScore = Math.max(0, Math.min(1, 0.4 * fit.r2 + 0.6 * sizeFactor))
    const confidence: HighscorePrediction['confidence'] = confScore > 0.6 ? 'high' : (confScore > 0.3 ? 'med' : 'low')
    return { etaTs: soonTs, etaHuman: humanizeETA(soonTs - now), runsExpected: 1, runsLo: 1, runsHi: 2, optPauseHours: soonPauseH, confidence, sample: n, best, lastScore: last.score, lastPlayedDays, slopePerDay, slopePerRun }
  }

  // Derive a realistic search range in minutes based on observed within-session gaps
  const SESSION_GAP_MIN = 30 // minutes
  const sessionGapDays = SESSION_GAP_MIN / (24 * 60)
  const dtMinObs = havePairs ? Math.max(1 / (24 * 60), quantile(dtDays, 0.1) * 0.7) : 2 / (24 * 60)
  const dtMaxObs = havePairs ? Math.max(dtMinObs * 1.2, Math.min(sessionGapDays, quantile(dtDays, 0.9) * 1.4)) : Math.min(sessionGapDays, 15 / (24 * 60))
  const dtStepDays = Math.max(0.5 / (24 * 60), (dtMaxObs - dtMinObs) / 60) // ~30 steps
  const opt = findOptimalPauseAndRuns(deficit, fit, dtMinObs, dtMaxObs, dtStepDays)
  // Reasonable caps and guards
  const MAX_RUNS_REASONABLE = 500
  if (!opt || !Number.isFinite(opt.runs) || opt.runs > MAX_RUNS_REASONABLE || opt.delta < epsImprovement) {
    // Fallback: use robust recent improvement per run (non-negative deltas) and median observed pause
    const medDt = (havePairs ? quantile(dtDays, 0.5) : 5 / (24 * 60)) || 5 / (24 * 60)
    const spr = Math.max(1e-6, meanPos)
    const runsRaw = deficit / spr
    if (!Number.isFinite(runsRaw) || runsRaw > MAX_RUNS_REASONABLE || spr < epsImprovement * 0.25) {
      // Too many runs or essentially flat improvement: report unknown
      return { etaTs: null, etaHuman: 'unknown', runsExpected: null, runsLo: null, runsHi: null, optPauseHours: null, confidence: 'low', sample: n, best, lastScore: last.score, lastPlayedDays, slopePerDay, slopePerRun, reason: 'No upward trend detected yet' }
    }
    const runs = Math.ceil(runsRaw)
    // Confidence from sample size and stability (lower variability => higher confidence)
    const pairSample = dtDays.length
    const sizeFactor = Math.min(1, pairSample / 24)
    const stability = meanPos > 1e-6 ? clamp(1 - Math.min(2, stdPos / Math.max(1, meanPos)), 0, 1) : 0
    const recencyPenalty = clamp(lastPlayedDays / 21, 0, 1)
    const confScore = clamp(0.15 + 0.55 * (0.6 * sizeFactor + 0.4 * stability) - 0.15 * recencyPenalty, 0, 1)
    const widen = 0.28 + 0.32 * (1 - confScore) + 0.12 * (1 - stability)
    const lo = Math.max(1, Math.floor(runs * (1 - widen)))
    const hi = Math.max(lo + 1, Math.ceil(runs * (1 + widen)))
    const eta = now + Math.max(1, runs) * medDt * DAY
    const confidence: HighscorePrediction['confidence'] = confScore > 0.6 ? 'high' : (confScore > 0.3 ? 'med' : 'low')
    return { etaTs: eta, etaHuman: humanizeETA(eta - now), runsExpected: runs, runsLo: lo, runsHi: hi, optPauseHours: Math.round(medDt * 24), confidence, sample: n, best, lastScore: last.score, lastPlayedDays, slopePerDay, slopePerRun, reason: 'Using robust recent trend' }
  }

  const runs = Math.max(1, Math.ceil(opt.runs))
  const eta = now + runs * opt.dtDays * DAY
  // confidence combines fit.r2 and sample size of pairs
  const pairSample = dtDays.length
  const sizeFactor = Math.min(1, pairSample / 24)
  const stability = meanPos > 1e-6 ? clamp(1 - Math.min(2, stdPos / Math.max(1, meanPos)), 0, 1) : 0
  const recencyPenalty = clamp(lastPlayedDays / 21, 0, 1)
  const confScore = clamp(0.15 + 0.55 * (0.7 * fit.r2 + 0.3 * sizeFactor) + 0.3 * stability - 0.2 * recencyPenalty, 0, 1)
  const confidence: HighscorePrediction['confidence'] = confScore > 0.6 ? 'high' : (confScore > 0.3 ? 'med' : 'low')
  // Range based on uncertainty
  const widen = 0.22 + 0.30 * (1 - confScore) + 0.12 * (1 - stability)
  const lo = Math.max(1, Math.floor(runs * (1 - widen)))
  const hi = Math.max(lo + 1, Math.ceil(runs * (1 + widen)))
  // Final recommended pause in hours, but do not exceed session gap; keep at least 1 minute
  const optPauseHours = Math.max(1 / 60, Math.min(opt.dtDays * 24, SESSION_GAP_MIN / 60))
  return { etaTs: eta, etaHuman: humanizeETA(eta - now), runsExpected: runs, runsLo: lo, runsHi: hi, optPauseHours, confidence, sample: n, best, lastScore: last.score, lastPlayedDays, slopePerDay, slopePerRun }
}
