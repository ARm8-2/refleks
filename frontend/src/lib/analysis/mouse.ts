import type { Point, ScenarioRecord } from '../../types/ipc'
import { formatNumber, formatPct } from '../utils'

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
  // Additional metrics for better sensitivity suggestions
  maxDistanceFromTarget: number
  avgDistanceFromTarget: number
  directionFlips: number
  overshootSeverity: number
  // New metrics for improved analysis
  confidence: number // 0-1 confidence in the classification
  velocityAtKill: number // speed at the moment of kill (pixels/ms)
  maxVelocity: number // peak velocity during approach
  crossingCount: number // number of times cursor crossed the target center
  clickedWhileMoving: boolean // true if click occurred while cursor was still moving fast
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
  // Points: the starting point for this analysis window, and the point where the kill occurred
  const startPoint = points[startIndex]
  const killPoint = points[Math.min(points.length - 1, endIndex)] || points[points.length - 1]
  const center = { x: killPoint.x, y: killPoint.y }

  // path metrics
  let pathLen = 0
  let prevPoint = points[startIndex]
  for (let i = startIndex + 1; i <= endIndex; i++) {
    const p = points[i]
    pathLen += Math.hypot(p.x - prevPoint.x, p.y - prevPoint.y)
    prevPoint = p
  }
  const straight = Math.hypot((killPoint.x - startPoint.x), (killPoint.y - startPoint.y))
  const efficiency = pathLen > 0 ? Math.max(0, Math.min(1, straight / pathLen)) : 1

  // Improved target zone radius calculation
  // Base it on the flick distance but also consider scenario type (via hits count)
  // Clicking scenarios (1 hit) need tighter zones, tracking (many hits) need larger zones
  const isTrackingLike = ev.hits > 100
  const isClickingLike = ev.hits <= 2
  let radius: number
  if (isClickingLike) {
    // Clicking: tighter zone, ~3-8% of flick distance
    radius = clamp(Math.max(3, straight * 0.04), 3, 15)
  } else if (isTrackingLike) {
    // Tracking: wider zone, ~8-12% of movement
    radius = clamp(Math.max(5, straight * 0.10), 5, 30)
  } else {
    // Switching/hybrid: medium zone
    radius = clamp(Math.max(4, straight * 0.06), 4, 20)
  }
  const radiusSq = radius * radius

  // Compute distances to kill point and velocities
  // Squared distances to kill point for efficiency (avoid sqrt per point)
  const distSq: number[] = []
  const velocities: number[] = []
  for (let i = startIndex; i <= endIndex; i++) {
    const p = points[i]
    const dx = p.x - killPoint.x, dy = p.y - killPoint.y
    distSq.push(dx * dx + dy * dy)

    if (i > startIndex) {
      const prevP = points[i - 1]
      const dt = tsMs(p.ts) - tsMs(prevP.ts)
      const dist = Math.hypot(p.x - prevP.x, p.y - prevP.y)
      velocities.push(dt > 0 ? dist / dt : 0)
    }
  }

  // Overshoot detection: detect when the player enters the target zone, leaves significantly,
  // and then returns — or when they oscillate by crossing the primary axis multiple times.

  let zoneEntryIndex = -1
  let leftZoneAfterEntry = false
  let crossingCount = 0
  let lastSideOnPrimaryAxis: 'left' | 'right' | 'above' | 'below' | null = null

  // Track which side of target the cursor is on (for crossing detection)
  const primaryAxisIsX = Math.abs(killPoint.x - startPoint.x) > Math.abs(killPoint.y - startPoint.y)
  for (let i = 0; i < distSq.length; i++) {
    const p = points[startIndex + i]
    const dx = p.x - killPoint.x
    const dy = p.y - killPoint.y

    // Primary movement axis detection
    const curSideX: 'left' | 'right' = dx < 0 ? 'left' : 'right'
    const curSideY: 'above' | 'below' = dy < 0 ? 'above' : 'below'

    // Use the axis with larger movement for crossing detection
    const curSide = primaryAxisIsX ? curSideX : curSideY

    if (lastSideOnPrimaryAxis !== null && lastSideOnPrimaryAxis !== curSide && Math.sqrt(distSq[i]) < radius * 3) {
      crossingCount++
    }
    lastSideOnPrimaryAxis = curSide

    // Classic enter/leave detection with conservative hysteresis
    const d = distSq[i]
    if (zoneEntryIndex === -1) {
      if (d <= radiusSq) zoneEntryIndex = i
    } else {
      // Require significant exit (2.25x area) from the zone to avoid small boundary noise
      if (d > radiusSq * 2.25) leftZoneAfterEntry = true
    }
  }

  const endWithin = distSq[distSq.length - 1] <= radiusSq
  const classicOvershoot = zoneEntryIndex !== -1 && leftZoneAfterEntry && endWithin

  // Velocity metrics
  const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0
  const velocityAtKill = velocities.length > 0 ? velocities[velocities.length - 1] : 0
  const avgVelocity = velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0

  // Only count as overshoot if:
  // - Classic pattern (enter, leave significantly, return) OR
  // - Multiple crossings (3+) with end inside zone (suggests oscillation)
  const isOvershoot = classicOvershoot || (crossingCount >= 3 && endWithin)

  // === IMPROVED UNDERSHOOT DETECTION ===
  // Detect patterns:
  // 1. Multiple direction flips while approaching (hesitation)
  // 2. Deceleration followed by micro-corrections
  // 3. Multiple small movements without reaching target confidently

  // For undershoot we consider recent signal within the last 300ms: direction flips and
  // deceleration-triggered corrections are common undershoot patterns.
  const startIndexLast300Ms = lowerBound(points, endMs - 300, startIndex, endIndex)
  let directionFlipCount = 0
  let previousSign = 0
  let decelerationFlipCount = 0

  for (let i = Math.max(1, startIndexLast300Ms - startIndex); i < distSq.length; i++) {
    const dd = distSq[i] - distSq[i - 1]
    const sign = dd === 0 ? previousSign : (dd > 0 ? 1 : -1)
    const outside = distSq[i] > radiusSq

    // Count flips while outside target zone
    if (outside && previousSign !== 0 && sign !== previousSign) {
      directionFlipCount++
      // Extra weight if this happens during deceleration
      if (i > 1 && velocities[i - 1] < velocities[i - 2]) {
        decelerationFlipCount++
      }
    }
    previousSign = sign
  }

  // Also check for "stalling" - very slow movement near but outside target
  let stallCount = 0
  for (let i = Math.max(0, distSq.length - 15); i < distSq.length - 1; i++) {
    const distFromTarget = Math.sqrt(distSq[i])
    const nearTarget = distFromTarget < radius * 3 && distFromTarget > radius
    const slowMoving = velocities[i] !== undefined && velocities[i] < avgVelocity * 0.25
    if (nearTarget && slowMoving) stallCount++
  }

  // Undershoot requires clear hesitation pattern:
  // - 3+ flips (clear indecision) OR
  // - 2 flips during deceleration (common undershoot pattern) OR
  // - Significant stalling (4+) with any flipping
  const isUndershoot = !isOvershoot && (
    directionFlipCount >= 3 ||
    (decelerationFlipCount >= 2 && directionFlipCount >= 2) ||
    (stallCount >= 4 && directionFlipCount >= 1)
  )

  // === CLICK TIMING ANALYSIS ===
  // Check if the kill click happened while cursor was still moving fast
  const clickedWhileMoving = velocityAtKill > avgVelocity * 0.6 && velocityAtKill > 0.15

  // === CONFIDENCE SCORING ===
  // Higher confidence when:
  // - Clear pattern match (not borderline cases)
  // - Sufficient data points in the window
  // - Consistent movement patterns
  const numPoints = endIndex - startIndex + 1
  let confidence = 0.5 // base confidence

  if (numPoints >= 20) confidence += 0.15
  else if (numPoints >= 10) confidence += 0.1

  if (isOvershoot) {
    if (classicOvershoot && crossingCount >= 2) confidence += 0.25 // strong pattern
    else if (classicOvershoot) confidence += 0.15
    else if (crossingCount >= 3) confidence += 0.15 // oscillation pattern
  } else if (isUndershoot) {
    if (directionFlipCount >= 3) confidence += 0.2
    else if (directionFlipCount >= 2 && decelerationFlipCount >= 1) confidence += 0.15
    else confidence += 0.1
  } else {
    // Optimal - high confidence if clearly inside zone with smooth approach
    if (efficiency > 0.85 && !leftZoneAfterEntry) confidence += 0.2
  }

  confidence = clamp(confidence, 0, 1)

  const classification: 'optimal' | 'overshoot' | 'undershoot' = isOvershoot ? 'overshoot' : (isUndershoot ? 'undershoot' : 'optimal')

  // Calculate additional metrics for better sensitivity suggestions
  const maxDistanceFromTarget = Math.sqrt(Math.max(...distSq))
  const avgDistanceFromTarget = Math.sqrt(distSq.reduce((a, b) => a + b, 0) / distSq.length)
  const directionFlips = directionFlipCount
  const overshootSeverity = isOvershoot ? Math.max(0, Math.sqrt(Math.max(...distSq)) - radius) : 0

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
    maxDistanceFromTarget,
    avgDistanceFromTarget,
    directionFlips,
    overshootSeverity,
    confidence,
    velocityAtKill,
    maxVelocity,
    crossingCount,
    clickedWhileMoving,
  }
}

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
  const optimal = analysis.counts.optimal
  const overPct = over / total
  const underPct = under / total
  const optimalPct = optimal / total

  // Calculate trace-based severity metrics with confidence weighting
  const { avgOvershootDistance, avgUndershootFlips, avgConfidence, clickWhileMovingRate } = calculateTraceSeverity(analysis)

  // Only provide suggestions if we have reasonable confidence in the analysis
  if (avgConfidence < 0.45) return null

  // If mostly optimal, no suggestion needed
  if (optimalPct > 0.7) return null

  // Improved decision logic with confidence weighting
  let net = overPct - underPct // positive => overshoot dominant

  // Weight by confidence - if confidence is low, reduce the magnitude of suggestions
  const confidenceMultiplier = 0.5 + (avgConfidence * 0.5)

  // If percentages are very close but both significant, don't suggest (mixed issues)
  const pctDiff = Math.abs(overPct - underPct)
  if (pctDiff < 0.08 && overPct > 0.15 && underPct > 0.15) {
    // Mixed pattern - both overshoot and undershoot present, no clear direction
    return null
  }

  // Factor in click-while-moving as additional evidence of overshoot tendency
  // but only if it's a significant pattern
  if (clickWhileMovingRate > 0.4 && over > 0) {
    net += clickWhileMovingRate * 0.08
  }

  // Higher threshold for providing suggestions - require clearer pattern
  const minNetToSuggest = 0.12 // 12% difference needed

  if (Math.abs(net) < minNetToSuggest || total < 5) return null

  // Calculate adjustment based on both percentage bias and severity
  // More conservative adjustments to avoid over-correction
  const pctAdjustment = net * 0.4 * confidenceMultiplier
  const severityAdjustment = avgOvershootDistance > 15 ? Math.min(0.2, avgOvershootDistance / 80) * confidenceMultiplier : 0
  const totalAdjustment = Math.abs(pctAdjustment) + severityAdjustment

  // More conservative max adjustment - 35% max
  const maxAdjustment = 0.35
  const adj = Math.max(-maxAdjustment, Math.min(maxAdjustment, net > 0 ? totalAdjustment : -totalAdjustment))

  const recommended = Math.max(0.0001, curr * (1 - adj))
  const changePct = ((recommended / curr) - 1) * 100

  const direction = net > 0 ? 'faster' : 'slower'
  const confidenceNote = avgConfidence < 0.6 ? ' (moderate confidence)' : ''
  const reason = net > 0
    ? `Overshoot detected in ${overPct > 0 ? formatPct(overPct, 0) : 'some'} of kills${avgOvershootDistance > 10 ? ` with average overshoot distance of ${formatNumber(avgOvershootDistance / 10, 1)} pixels` : ''}${clickWhileMovingRate > 0.3 ? `, often clicking while cursor still moving` : ''}. Suggest training at the higher sensitivity (${formatNumber(recommended, 2)} cm/360) for a few runs; when you return to your original sensitivity (${formatNumber(curr, 2)} cm/360) you'll likely retain smaller physical motions which should reduce overshoot${confidenceNote}.`
    : `Undershoot detected in ${underPct > 0 ? formatPct(underPct, 0) : 'some'} of kills${avgUndershootFlips > 2 ? ` with frequent micro-corrections` : ''}. Suggest training at the lower sensitivity (${formatNumber(recommended, 2)} cm/360) for a few runs; when you return to your original sensitivity (${formatNumber(curr, 2)} cm/360) you'll likely retain slightly larger motions which should reduce undershoot${confidenceNote}.`

  return { current: curr, recommended, changePct, direction, reason }
}

// Calculate trace-based severity metrics for overshoot and undershoot
function calculateTraceSeverity(analysis: MouseTraceAnalysis) {
  let totalOvershootDistance = 0
  let overshootCount = 0
  let totalUndershootFlips = 0
  let undershootCount = 0
  let totalConfidence = 0
  let clickWhileMovingCount = 0

  for (const kill of analysis.kills) {
    totalConfidence += kill.confidence
    if (kill.clickedWhileMoving) clickWhileMovingCount++

    if (kill.classification === 'overshoot') {
      totalOvershootDistance += kill.overshootSeverity
      overshootCount++
    } else if (kill.classification === 'undershoot') {
      totalUndershootFlips += kill.directionFlips
      undershootCount++
    }
  }

  const total = analysis.kills.length
  return {
    avgOvershootDistance: overshootCount > 0 ? totalOvershootDistance / overshootCount : 0,
    avgUndershootFlips: undershootCount > 0 ? totalUndershootFlips / undershootCount : 0,
    avgConfidence: total > 0 ? totalConfidence / total : 0,
    clickWhileMovingRate: total > 0 ? clickWhileMovingCount / total : 0,
  }
}
