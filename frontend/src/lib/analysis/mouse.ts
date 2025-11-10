import type { Point, ScenarioRecord } from '../../types/ipc'

export type MouseKillEvent = {
  idx: number
  tsIso: string
  tsAbsMs: number
  ttkSec: number
  shots: number
  hits: number
}

export type KillAnalysis = {
  killIdx: number
  tsIso: string
  endMs: number
  startMs: number
  startIndex: number
  endIndex: number
  center: { x: number; y: number }
  pathLength: number
  straight: number
  efficiency: number // straight / pathLength in [0,1]
  classification: 'optimal' | 'overshoot' | 'undershoot'
  stats: { shots: number; hits: number; ttkSec: number }
}

export type MouseTraceAnalysis = {
  kills: KillAnalysis[]
  counts: { overshoot: number; undershoot: number; optimal: number }
  avgEfficiency: number
  windowCapSec: number
}

export type SensSuggestion = {
  current: number
  recommended: number
  changePct: number
  direction: 'slower' | 'faster'
  reason: string
} | null


// Entry point used by UI
export function computeMouseTraceAnalysis(item: ScenarioRecord): MouseTraceAnalysis | null {
  const points = Array.isArray(item.mouseTrace) ? item.mouseTrace : []
  const events = Array.isArray(item.events) ? item.events : []
  if (points.length < 4 || events.length === 0) return null
  const baseIso = String((item.stats as any)?.['Date Played'] || '')
  if (!baseIso) return null
  const kills = parseEventsToKills(events, baseIso)
  if (!kills.length) return null

  // Heuristic window cap based on shots per kill (median)
  const medShots = median(kills.map(k => k.shots))
  let windowCapSec = 1.0
  if (medShots >= 300) windowCapSec = 1.0 // tracking-like: only analyze last 1s
  else if (medShots >= 60) windowCapSec = 1.2 // switching-ish
  else windowCapSec = 0.9 // small targets

  const analyses: KillAnalysis[] = []
  for (const ev of kills) {
    const win = findWindow(points, ev, windowCapSec)
    if (!win) continue
    const ka = analyzeWindow(points, win, ev)
    analyses.push(ka)
  }
  let overshoot = 0, undershoot = 0, optimal = 0
  let effSum = 0, effN = 0
  for (const a of analyses) {
    if (a.classification === 'overshoot') overshoot++
    else if (a.classification === 'undershoot') undershoot++
    else optimal++
    if (Number.isFinite(a.efficiency)) { effSum += a.efficiency; effN++ }
  }
  return {
    kills: analyses,
    counts: { overshoot, undershoot, optimal },
    avgEfficiency: effN ? (effSum / effN) : 0,
    windowCapSec,
  }
}

// --- Core helpers ---
export function parseEventsToKills(events: string[][], baseIso: string): MouseKillEvent[] {
  const out: MouseKillEvent[] = []
  const end = new Date(baseIso)
  // Use LOCAL date parts to avoid UTC day drift
  const baseY = end.getFullYear()
  const baseM = end.getMonth() // 0-based
  const baseD = end.getDate()
  const endTOD = (end.getHours() * 3600) + (end.getMinutes() * 60) + end.getSeconds() + (end.getMilliseconds() / 1000)
  for (const row of events) {
    if (!row || row.length < 7) continue
    const idx = toInt(row[0])
    const todStr = row[1]
    // Parse HH:MM:SS(.fff)
    const m = String(todStr || '').match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/)
    if (!m) continue
    const hh = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10)
    const ss = parseInt(m[3], 10)
    const ms = m[4] ? Math.round(parseFloat('0.' + m[4]) * 1000) : 0
    // Build local Date for the event
    let evt = new Date(baseY, baseM, baseD, hh, mm, ss, ms)
    const tsSec = hh * 3600 + mm * 60 + ss + (ms / 1000)
    // If event TOD is after end TOD, it likely belongs to the previous day (crossed midnight)
    if (Number.isFinite(endTOD) && tsSec > endTOD + 1) {
      evt.setDate(evt.getDate() - 1)
    }
    const ttkSec = parseTTK(row[4])
    const shots = toFloat(row[5])
    const hits = toFloat(row[6])
    out.push({ idx, tsIso: evt.toISOString(), tsAbsMs: evt.getTime(), ttkSec, shots, hits })
  }
  // Enforce non-decreasing timestamps by slight monotonic fix (in case of equal ms)
  out.sort((a, b) => a.tsAbsMs - b.tsAbsMs)
  for (let i = 1; i < out.length; i++) {
    if (out[i].tsAbsMs <= out[i - 1].tsAbsMs) out[i].tsAbsMs = out[i - 1].tsAbsMs + 1
  }
  return out
}

export function findWindow(points: Point[], ev: MouseKillEvent, capSec: number): { startMs: number; endMs: number; startIndex: number; endIndex: number } | null {
  if (!points.length) return null
  const endMs = ev.tsAbsMs
  const startMs = Math.max(tsMs(points[0].ts), endMs - Math.max(0.1, Math.min(Math.max(0, ev.ttkSec) || capSec, capSec)) * 1000)
  const startIndex = lowerBound(points, startMs)
  const endIndex = lowerBound(points, endMs)
  if (endIndex <= startIndex) return null
  return { startMs, endMs, startIndex, endIndex }
}

export function analyzeWindow(points: Point[], win: { startMs: number; endMs: number; startIndex: number; endIndex: number }, ev: MouseKillEvent): KillAnalysis {
  const { startIndex, endIndex, startMs, endMs } = win
  const s = points[startIndex]
  const k = points[Math.min(points.length - 1, endIndex)] || points[points.length - 1]
  const center = { x: k.x, y: k.y }
  // path metrics
  let pathLen = 0
  let prev = points[startIndex]
  for (let i = startIndex + 1; i <= endIndex; i++) {
    const p = points[i]
    pathLen += Math.hypot(p.x - prev.x, p.y - prev.y)
    prev = p
  }
  const straight = Math.hypot((k.x - s.x), (k.y - s.y))
  const efficiency = pathLen > 0 ? Math.max(0, Math.min(1, straight / pathLen)) : 1

  // overshoot/undershoot via distance-to-kill analysis
  const r = clamp(Math.max(2, straight * 0.05), 2, 20)
  const r2 = r * r
  const dists: number[] = []
  for (let i = startIndex; i <= endIndex; i++) {
    const p = points[i]
    const dx = p.x - k.x, dy = p.y - k.y
    dists.push(dx * dx + dy * dy)
  }
  // Overshoot: enter within r, move away beyond r, then return to within r at end.
  let enteredAt = -1
  let leftAfterEnter = false
  for (let i = 0; i < dists.length - 1; i++) {
    const d = dists[i]
    if (enteredAt === -1) {
      if (d <= r2) enteredAt = i
    } else {
      if (d > r2 * 1.2) leftAfterEnter = true
    }
  }
  const endWithin = dists[dists.length - 1] <= r2
  const isOvershoot = enteredAt !== -1 && leftAfterEnter && endWithin

  // Undershoot: within last 300ms, multiple radial direction flips while outside r, but never overshoot
  const last300msStart = lowerBound(points, endMs - 300, startIndex, endIndex)
  let flips = 0
  let prevSign = 0
  for (let i = Math.max(1, last300msStart - startIndex); i < dists.length; i++) {
    const dd = dists[i] - dists[i - 1]
    const sign = dd === 0 ? prevSign : (dd > 0 ? 1 : -1)
    // Only count flips while still outside r (approach corrections)
    const outside = dists[i] > r2
    if (outside && prevSign !== 0 && sign !== prevSign) flips++
    prevSign = sign
  }
  const isUndershoot = !isOvershoot && flips >= 2

  const classification: 'optimal' | 'overshoot' | 'undershoot' = isOvershoot ? 'overshoot' : (isUndershoot ? 'undershoot' : 'optimal')

  return {
    killIdx: ev.idx,
    tsIso: ev.tsIso,
    endMs,
    startMs,
    startIndex,
    endIndex,
    center,
    pathLength: pathLen,
    straight,
    efficiency,
    classification,
    stats: { shots: ev.shots, hits: ev.hits, ttkSec: ev.ttkSec },
  }
}

// --- Utilities ---
function parseTTK(s: any): number {
  const m = String(s || '').match(/([0-9]*\.?[0-9]+)s/i)
  return m ? parseFloat(m[1]) : NaN
}
function toInt(s: any): number { const n = parseInt(String(s || ''), 10); return Number.isFinite(n) ? n : NaN }
function toFloat(s: any): number { const n = parseFloat(String(s || '')); return Number.isFinite(n) ? n : NaN }
function tsMs(v: any): number { if (v == null) return 0; if (typeof v === 'number') return v; const n = Date.parse(String(v)); return Number.isFinite(n) ? n : 0 }
function lowerBound(points: Point[], targetMs: number, lo = 0, hi = points.length - 1): number {
  let l = Math.max(0, lo), r = Math.max(l, hi)
  while (l < r) {
    const mid = (l + r) >>> 1
    const t = tsMs(points[mid].ts)
    if (t < targetMs) l = mid + 1; else r = mid
  }
  return Math.max(0, Math.min(points.length - 1, l))
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }
function median(arr: number[]): number { const a = arr.filter(Number.isFinite).slice().sort((x, y) => x - y); const n = a.length; if (!n) return 0; const m = Math.floor(n / 2); return n % 2 ? a[m] : (a[m - 1] + a[m]) / 2 }

// Suggest a sensitivity adjustment (cm/360) given an analysis and the run stats.
// Returns null when no useful suggestion can be made.
export function computeSuggestedSens(analysis: MouseTraceAnalysis, stats: Record<string, any>): SensSuggestion {
  const curr = Number(stats?.['cm/360'] ?? 0)
  if (!Number.isFinite(curr) || curr <= 0) return null

  const total = Math.max(1, analysis.kills.length)
  const over = analysis.counts.overshoot
  const under = analysis.counts.undershoot
  const overPct = over / total
  const underPct = under / total
  const net = overPct - underPct // positive => overshoot dominant

  // Ignore very small biases or tiny sample sizes
  const minNetToSuggest = 0.12 // 12%
  if (Math.abs(net) < minNetToSuggest || total < 6) return null

  // Scale the adjustment proportionally, but clamp to reasonable bounds.
  const scale = 0.8
  const adj = Math.max(-0.6, Math.min(0.6, net * scale)) // +/-60% max

  const recommended = Math.max(0.0001, curr * (1 - adj))
  const changePct = ((recommended / curr) - 1) * 100

  const direction = net > 0 ? 'faster' : 'slower'
  const reason = net > 0
    ? `Overshoot dominant (${(overPct * 100).toFixed(0)}% overshoot vs ${(underPct * 100).toFixed(0)}% undershoot). Suggest training at the higher sensitivity (${recommended.toFixed(2)} cm/360) for a few runs; when you return to your original sensitivity (${curr.toFixed(2)} cm/360) you'll likely retain smaller physical motions which should reduce overshoot.`
    : `Undershoot dominant (${(underPct * 100).toFixed(0)}% undershoot vs ${(overPct * 100).toFixed(0)}% overshoot). Suggest training at the lower sensitivity (${recommended.toFixed(2)} cm/360) for a few runs; when you return to your original sensitivity (${curr.toFixed(2)} cm/360) you'll likely retain slightly larger motions which should reduce undershoot.`

  return { current: curr, recommended, changePct, direction, reason }
}
