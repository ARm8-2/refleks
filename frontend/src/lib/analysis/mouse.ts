import type { MousePoint, ScenarioRecord } from '../../types/ipc'
import { decodeTraceData } from '../trace'
import { clamp, formatNumber, formatPct } from '../utils'

export type MouseKillEvent = {
  idx: number
  tsIso: string
  tsAbsMs: number
  ttkSec: number
  shots: number
  hits: number
}

// Severity grading for over/undershoot - focuses on magnitude, not just occurrence
export type SeverityGrade = 'none' | 'slight' | 'moderate' | 'severe'

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
  // Magnitude-based metrics (pixels) - these are what matter most
  overshootPixels: number // max distance past target (0 if no overshoot)
  undershootPixels: number // distance stopped short of target (0 if no undershoot)
  overshootSeverity: SeverityGrade
  undershootSeverity: SeverityGrade
  // Additional context metrics
  maxDistanceFromTarget: number
  avgDistanceFromTarget: number
  directionFlips: number
  // Confidence and velocity metrics
  confidence: number // 0-1 confidence in the classification
  velocityAtKill: number // speed at the moment of kill (pixels/ms)
  maxVelocity: number // peak velocity during approach
  crossingCount: number // number of times cursor crossed the target center
  clickedWhileMoving: boolean // true if click occurred while cursor was still moving fast
  // Correction metrics
  correctionDistance: number // total distance of corrections after initial approach
  correctionCount: number // number of distinct correction movements
}

export type MouseTraceAnalysis = {
  kills: KillAnalysis[]
  counts: { overshoot: number; undershoot: number; optimal: number }
  avgEfficiency: number
  windowCapSec: number
  // Magnitude-based aggregate metrics (more useful than counts)
  avgOvershootPixels: number // average pixels overshot (across overshoot kills only)
  avgUndershootPixels: number // average pixels undershot (across undershoot kills only)
  overallOvershootPixels: number // average across ALL kills (even optimal ones may have slight overshoot)
  overallUndershootPixels: number // average across ALL kills
  severityCounts: {
    overshoot: { slight: number; moderate: number; severe: number }
    undershoot: { slight: number; moderate: number; severe: number }
  }
  // Physical metrics
  cm360: number | null
  totalDistanceCm: number | null
  maxAccelG: number | null
  avgSpeedCmS: number | null
  peakSpeedCmS: number | null
  avgFlickSpeedCmS: number | null
}

export type SensSuggestion = {
  current: number
  recommended: number
  changePct: number
  direction: 'slower' | 'faster'
  reason: string
  // Detailed breakdown for UI
  primaryIssue: 'overshoot' | 'undershoot'
  avgMagnitudePixels: number
  severity: SeverityGrade
} | null


// Entry point used by UI
export function computeMouseTraceAnalysis(item: ScenarioRecord, overridePoints?: MousePoint[]): MouseTraceAnalysis | null {
  let points = overridePoints || (Array.isArray(item.mouseTrace) ? item.mouseTrace : [])
  if (points.length === 0 && item.traceData) {
    points = decodeTraceData(item.traceData)
  }
  const events = Array.isArray(item.events) ? item.events : []
  if (points.length < 4 || events.length === 0) return null
  const baseIso = String((item.stats as any)?.['Date Played'] || '')
  if (!baseIso) return null
  const kills = parseEventsToKills(events, baseIso)
  if (!kills.length) return null

  // Adaptive window cap - we'll determine per-kill based on TTK and hits
  // Use a reasonable default that works for most scenarios
  const windowCapSec = 1.0

  const analyses: KillAnalysis[] = []
  for (const ev of kills) {
    const win = findWindow(points, ev, windowCapSec)
    if (!win) continue
    const ka = analyzeWindow(points, win, ev)
    analyses.push(ka)
  }

  // Aggregate counts
  let overshoot = 0, undershoot = 0, optimal = 0
  let effSum = 0, effN = 0

  // Magnitude aggregates
  let totalOvershootPixels = 0, overshootKillCount = 0
  let totalUndershootPixels = 0, undershootKillCount = 0
  let allKillsOvershootPixels = 0, allKillsUndershootPixels = 0

  // Severity counters
  const severityCounts = {
    overshoot: { slight: 0, moderate: 0, severe: 0 },
    undershoot: { slight: 0, moderate: 0, severe: 0 }
  }

  for (const a of analyses) {
    if (a.classification === 'overshoot') {
      overshoot++
      totalOvershootPixels += a.overshootPixels
      overshootKillCount++
      if (a.overshootSeverity === 'slight') severityCounts.overshoot.slight++
      else if (a.overshootSeverity === 'moderate') severityCounts.overshoot.moderate++
      else if (a.overshootSeverity === 'severe') severityCounts.overshoot.severe++
    } else if (a.classification === 'undershoot') {
      undershoot++
      totalUndershootPixels += a.undershootPixels
      undershootKillCount++
      if (a.undershootSeverity === 'slight') severityCounts.undershoot.slight++
      else if (a.undershootSeverity === 'moderate') severityCounts.undershoot.moderate++
      else if (a.undershootSeverity === 'severe') severityCounts.undershoot.severe++
    } else {
      optimal++
    }

    // Track ALL kill over/undershoot for overall analysis
    allKillsOvershootPixels += a.overshootPixels
    allKillsUndershootPixels += a.undershootPixels

    if (Number.isFinite(a.efficiency)) { effSum += a.efficiency; effN++ }
  }

  // Physical metrics calculation
  const cm360 = Number(item.stats['cm/360']) || null
  const dpi = Number(item.stats['DPI'])
  let totalDistanceCm: number | null = null
  let maxAccelG: number | null = null
  let avgSpeedCmS: number | null = null
  let peakSpeedCmS: number | null = null
  let avgFlickSpeedCmS: number | null = null

  if (Number.isFinite(dpi) && dpi > 0 && points.length > 1) {
    const cmPerCount = 2.54 / dpi
    let totalDist = 0
    let maxAccel = 0
    let maxSpeed = 0
    let speedSum = 0
    let speedCount = 0
    let prevV = 0

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1]
      const p2 = points[i]
      const dt = (p2.ts - p1.ts) / 1000 // seconds

      // Skip large gaps (pauses) or zero time
      if (dt <= 0.0001 || dt > 0.5) {
        prevV = 0
        continue
      }

      const distCounts = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const distCm = distCounts * cmPerCount
      totalDist += distCm

      const v = distCm / dt // cm/s
      if (v > maxSpeed) maxSpeed = v

      // Only count speed if moving (ignore tiny jitter)
      if (v > 1.0) {
        speedSum += v
        speedCount++
      }

      // Calculate acceleration if we have a previous velocity
      // We need at least 3 points for accel, but here we use prevV from previous iteration
      if (i > 1) {
        const accel = Math.abs(v - prevV) / dt // cm/s^2
        if (accel > maxAccel) maxAccel = accel
      }
      prevV = v
    }

    totalDistanceCm = totalDist
    // Convert cm/s^2 to G (980.665 cm/s^2)
    maxAccelG = maxAccel / 980.665
    avgSpeedCmS = speedCount > 0 ? speedSum / speedCount : 0
    peakSpeedCmS = maxSpeed

    // Calculate average flick speed from kill analyses
    // analyses[].maxVelocity is in pixels/ms
    // cm/s = pixels/ms * 1000 * cmPerCount
    if (analyses.length > 0) {
      let flickSpeedSum = 0
      let flickCount = 0
      for (const a of analyses) {
        if (a.maxVelocity > 0) {
          flickSpeedSum += a.maxVelocity * 1000 * cmPerCount
          flickCount++
        }
      }
      avgFlickSpeedCmS = flickCount > 0 ? flickSpeedSum / flickCount : 0
    }
  }

  return {
    kills: analyses,
    counts: { overshoot, undershoot, optimal },
    avgEfficiency: effN ? (effSum / effN) : 0,
    windowCapSec,
    avgOvershootPixels: overshootKillCount > 0 ? totalOvershootPixels / overshootKillCount : 0,
    avgUndershootPixels: undershootKillCount > 0 ? totalUndershootPixels / undershootKillCount : 0,
    overallOvershootPixels: analyses.length > 0 ? allKillsOvershootPixels / analyses.length : 0,
    overallUndershootPixels: analyses.length > 0 ? allKillsUndershootPixels / analyses.length : 0,
    severityCounts,
    cm360,
    totalDistanceCm,
    maxAccelG,
    avgSpeedCmS,
    peakSpeedCmS,
    avgFlickSpeedCmS,
  }
}// --- Core helpers ---
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

export function findWindow(points: MousePoint[], ev: MouseKillEvent, capSec: number): { startMs: number; endMs: number; startIndex: number; endIndex: number } | null {
  if (!points.length) return null
  const endMs = ev.tsAbsMs
  const startMs = Math.max(points[0].ts, endMs - Math.max(0.1, Math.min(Math.max(0, ev.ttkSec) || capSec, capSec)) * 1000)
  const startIndex = lowerBound(points, startMs)
  const endIndex = lowerBound(points, endMs)
  if (endIndex <= startIndex) return null
  return { startMs, endMs, startIndex, endIndex }
}

export function analyzeWindow(points: MousePoint[], win: { startMs: number; endMs: number; startIndex: number; endIndex: number }, ev: MouseKillEvent): KillAnalysis {
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

  // Adaptive target zone radius based on per-kill characteristics
  // Uses hits/shots to determine if this is clicking-like or tracking-like
  const isTrackingLike = ev.hits > 30
  const isClickingLike = ev.hits <= 2 && ev.shots <= 2

  let radius: number
  if (isClickingLike) {
    // Clicking: tight zone, 3-6% of flick distance
    radius = clamp(Math.max(3, straight * 0.045), 3, 12)
  } else if (isTrackingLike) {
    // Tracking: larger zone for continuous tracking
    radius = clamp(Math.max(6, straight * 0.10), 6, 35)
  } else {
    // Mixed/switching: medium zone
    radius = clamp(Math.max(4, straight * 0.055), 4, 20)
  }
  const radiusSq = radius * radius

  // Compute distances to kill point and velocities
  const distSq: number[] = []
  const velocities: number[] = []
  const signedDistances: { dx: number; dy: number }[] = [] // For overshoot direction analysis

  for (let i = startIndex; i <= endIndex; i++) {
    const p = points[i]
    const dx = p.x - killPoint.x, dy = p.y - killPoint.y
    distSq.push(dx * dx + dy * dy)
    signedDistances.push({ dx, dy })

    if (i > startIndex) {
      const prevP = points[i - 1]
      const dt = p.ts - prevP.ts
      const dist = Math.hypot(p.x - prevP.x, p.y - prevP.y)
      velocities.push(dt > 0 ? dist / dt : 0)
    }
  }

  // === IMPROVED OVERSHOOT DETECTION WITH MAGNITUDE ===
  // Track when cursor passes through/beyond target and by how much

  const primaryAxisIsX = Math.abs(killPoint.x - startPoint.x) > Math.abs(killPoint.y - startPoint.y)
  const approachSign = primaryAxisIsX
    ? Math.sign(killPoint.x - startPoint.x)  // Direction we're approaching from
    : Math.sign(killPoint.y - startPoint.y)

  let maxOvershootDist = 0 // Maximum distance past the target (in pixels)
  let crossingCount = 0
  let lastSide: number = 0
  let zoneEntryIndex = -1
  let leftZoneAfterEntry = false
  let maxDistWhileInZone = 0

  for (let i = 0; i < distSq.length; i++) {
    const { dx, dy } = signedDistances[i]
    const dist = Math.sqrt(distSq[i])

    // Determine which side of target we're on (relative to approach direction)
    const curSide = primaryAxisIsX
      ? Math.sign(dx) * -approachSign  // +1 = overshot, -1 = hasn't reached
      : Math.sign(dy) * -approachSign

    // Track crossing count
    if (lastSide !== 0 && curSide !== 0 && lastSide !== curSide && dist < radius * 4) {
      crossingCount++
    }
    lastSide = curSide || lastSide

    // Track overshoot magnitude (how far past the target)
    if (curSide > 0) {
      // We're past the target - measure overshoot distance
      const overshootDist = primaryAxisIsX ? Math.abs(dx) : Math.abs(dy)
      maxOvershootDist = Math.max(maxOvershootDist, overshootDist)
    }

    // Zone entry/exit tracking
    if (zoneEntryIndex === -1) {
      if (distSq[i] <= radiusSq) zoneEntryIndex = i
    } else {
      if (distSq[i] > radiusSq * 2.5) leftZoneAfterEntry = true
      if (distSq[i] <= radiusSq) {
        maxDistWhileInZone = Math.max(maxDistWhileInZone, dist)
      }
    }
  }

  const endWithin = distSq[distSq.length - 1] <= radiusSq
  const classicOvershoot = zoneEntryIndex !== -1 && leftZoneAfterEntry && endWithin
  const lateEntry = zoneEntryIndex !== -1 && zoneEntryIndex >= distSq.length - 2

  // Velocity metrics
  const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0
  const velocityAtKill = velocities.length > 0 ? velocities[velocities.length - 1] : 0
  const avgVelocity = velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0

  // === IMPROVED UNDERSHOOT DETECTION WITH MAGNITUDE ===
  // Detect stopping short and measure by how much

  const startIndexLast300Ms = lowerBound(points, endMs - 300, startIndex, endIndex)
  let directionFlipCount = 0
  let previousDistSign = 0
  let decelerationFlipCount = 0
  let correctionDistance = 0 // Total distance of corrections
  let correctionCount = 0
  let inCorrection = false

  for (let i = Math.max(1, startIndexLast300Ms - startIndex); i < distSq.length; i++) {
    const dd = distSq[i] - distSq[i - 1]
    const sign = dd === 0 ? previousDistSign : (dd > 0 ? 1 : -1)
    const outside = distSq[i] > radiusSq

    // Count direction flips while outside target zone
    if (outside && previousDistSign !== 0 && sign !== previousDistSign) {
      directionFlipCount++
      if (!inCorrection) {
        inCorrection = true
        correctionCount++
      }
      if (i > 1 && velocities[i - 1] !== undefined && velocities[i - 2] !== undefined && velocities[i - 1] < velocities[i - 2]) {
        decelerationFlipCount++
      }
    } else if (sign === previousDistSign && inCorrection) {
      inCorrection = false
    }

    // Track correction distance
    if (inCorrection && i < distSq.length - 1) {
      const p1 = points[startIndex + i]
      const p2 = points[startIndex + i + 1]
      if (p1 && p2) {
        correctionDistance += Math.hypot(p2.x - p1.x, p2.y - p1.y)
      }
    }

    previousDistSign = sign
  }

  // Check for "stalling" - very slow movement near but outside target
  let stallCount = 0
  let avgStallDistance = 0
  for (let i = Math.max(0, distSq.length - 15); i < distSq.length - 1; i++) {
    const distFromTarget = Math.sqrt(distSq[i])
    const nearTarget = distFromTarget < radius * 3 && distFromTarget > radius
    const slowMoving = velocities[i] !== undefined && velocities[i] < avgVelocity * 0.25
    if (nearTarget && slowMoving) {
      stallCount++
      avgStallDistance += distFromTarget - radius
    }
  }
  avgStallDistance = stallCount > 0 ? avgStallDistance / stallCount : 0

  // === CLASSIFICATION WITH MAGNITUDE ===

  // Overshoot classification based on magnitude AND pattern
  const hasSignificantOvershoot = maxOvershootDist > radius * 0.5
  const hasOvershootPattern = classicOvershoot || (crossingCount >= 2 && hasSignificantOvershoot)
  // Avoid marking as overshoot when we barely entered the zone at the end and didn't truly pass the target
  const lateEntryGuard = !(lateEntry && crossingCount <= 1 && maxOvershootDist < radius * 1.5)
  const isOvershoot = hasOvershootPattern && maxOvershootDist > Math.max(2, radius * 0.35) && lateEntryGuard // At least a minimal overshoot

  // Undershoot classification based on magnitude AND pattern
  const hasUndershootPattern = (
    directionFlipCount >= 3 ||
    (decelerationFlipCount >= 2 && directionFlipCount >= 2) ||
    (stallCount >= 3 && directionFlipCount >= 1) ||
    (correctionCount >= 2 && avgStallDistance > radius * 0.3)
  )

  // Measure undershoot as the average distance we were short by during corrections
  const undershootMagnitude = hasUndershootPattern ? Math.max(avgStallDistance, correctionDistance / Math.max(1, correctionCount * 3)) : 0
  const isUndershoot = !isOvershoot && hasUndershootPattern && undershootMagnitude > 1

  // === SEVERITY GRADING (based on pixels, not just occurrence) ===

  let overshootSeverity: SeverityGrade = 'none'
  let undershootSeverity: SeverityGrade = 'none'

  // Overshoot severity based on pixels overshot relative to target zone
  if (isOvershoot) {
    // Use both absolute pixels and relative size so tiny radii don't over-mark severe
    const relativeOvershoot = maxOvershootDist / radius
    if (maxOvershootDist < 10 || relativeOvershoot < 1.0) {
      overshootSeverity = 'slight'
    } else if (maxOvershootDist < 22 || relativeOvershoot < 2.2) {
      overshootSeverity = 'moderate'
    } else {
      overshootSeverity = 'severe'
    }
  }

  // Undershoot severity based on pixels short and correction count
  if (isUndershoot) {
    const relativeUndershoot = undershootMagnitude / radius
    if (undershootMagnitude < 9 || relativeUndershoot < 0.9 || correctionCount <= 2) {
      undershootSeverity = 'slight'
    } else if (undershootMagnitude < 18 || relativeUndershoot < 1.6 || correctionCount <= 4) {
      undershootSeverity = 'moderate'
    } else {
      undershootSeverity = 'severe'
    }
  }

  // === CLICK TIMING ANALYSIS ===
  const clickedWhileMoving = velocityAtKill > avgVelocity * 0.5 && velocityAtKill > 0.12

  // === CONFIDENCE SCORING ===
  const numPoints = endIndex - startIndex + 1
  let confidence = 0.5

  if (numPoints >= 20) confidence += 0.15
  else if (numPoints >= 10) confidence += 0.1

  if (isOvershoot) {
    if (classicOvershoot && crossingCount >= 2) confidence += 0.25
    else if (classicOvershoot || maxOvershootDist > radius * 1.5) confidence += 0.15
    else confidence += 0.08

    // Penalize weak evidence (e.g., likely target switch / just moving on)
    if (!classicOvershoot && crossingCount < 2) confidence -= 0.08
  } else if (isUndershoot) {
    if (directionFlipCount >= 4) confidence += 0.22
    else if (directionFlipCount >= 3 || (stallCount >= 3 && correctionCount >= 2)) confidence += 0.15
    else confidence += 0.1

    // Penalize very weak undershoot evidence
    if (directionFlipCount < 2 && correctionCount < 2) confidence -= 0.08
  } else {
    // Optimal - high confidence if clearly inside zone with smooth approach
    if (efficiency > 0.85 && !leftZoneAfterEntry && crossingCount <= 1) confidence += 0.25
    else if (efficiency > 0.7) confidence += 0.15
  }

  // Mild penalty when entry into target zone is extremely late (likely just arriving, not overshooting)
  if (lateEntry) confidence -= 0.05

  confidence = clamp(confidence, 0, 1)

  // Soften severity when confidence or evidence is weak
  const downgradeSeverity = (sev: SeverityGrade): SeverityGrade => sev === 'severe' ? 'moderate' : (sev === 'moderate' ? 'slight' : sev)

  if (isOvershoot) {
    const weakOvershootEvidence = (!classicOvershoot && crossingCount < 3) || lateEntry
    if (weakOvershootEvidence || confidence < 0.62) overshootSeverity = downgradeSeverity(overshootSeverity)
    if (confidence < 0.45) overshootSeverity = downgradeSeverity(overshootSeverity)
  }

  if (isUndershoot) {
    const weakUndershootEvidence = (directionFlipCount < 3 && correctionCount < 2) || (stallCount < 2 && avgStallDistance < radius * 0.4)
    if (weakUndershootEvidence || confidence < 0.62) undershootSeverity = downgradeSeverity(undershootSeverity)
    if (confidence < 0.45) undershootSeverity = downgradeSeverity(undershootSeverity)
  }

  const classification: 'optimal' | 'overshoot' | 'undershoot' = isOvershoot ? 'overshoot' : (isUndershoot ? 'undershoot' : 'optimal')

  // Calculate additional metrics
  const maxDistanceFromTarget = Math.sqrt(Math.max(...distSq))
  const avgDistanceFromTarget = Math.sqrt(distSq.reduce((a, b) => a + b, 0) / distSq.length)

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
    overshootPixels: isOvershoot ? maxOvershootDist : 0,
    undershootPixels: isUndershoot ? undershootMagnitude : 0,
    overshootSeverity,
    undershootSeverity,
    maxDistanceFromTarget,
    avgDistanceFromTarget,
    directionFlips: directionFlipCount,
    confidence,
    velocityAtKill,
    maxVelocity,
    crossingCount,
    clickedWhileMoving,
    correctionDistance,
    correctionCount,
  }
}

function parseTTK(s: any): number {
  const m = String(s || '').match(/([0-9]*\.?[0-9]+)s/i)
  return m ? parseFloat(m[1]) : NaN
}
function toInt(s: any): number { const n = parseInt(String(s || ''), 10); return Number.isFinite(n) ? n : NaN }
function toFloat(s: any): number { const n = parseFloat(String(s || '')); return Number.isFinite(n) ? n : NaN }
function lowerBound(points: MousePoint[], targetMs: number, lo = 0, hi = points.length - 1): number {
  let l = Math.max(0, lo), r = Math.max(l, hi)
  while (l < r) {
    const mid = (l + r) >>> 1
    const t = points[mid].ts
    if (t < targetMs) l = mid + 1; else r = mid
  }
  return Math.max(0, Math.min(points.length - 1, l))
}
function median(arr: number[]): number { const a = arr.filter(Number.isFinite).slice().sort((x, y) => x - y); const n = a.length; if (!n) return 0; const m = Math.floor(n / 2); return n % 2 ? a[m] : (a[m - 1] + a[m]) / 2 }

// Suggest a sensitivity adjustment (cm/360) given an analysis and the run stats.
// Returns null when no useful suggestion can be made.
// Now focuses on MAGNITUDE (how many pixels over/undershot) rather than just counts.
export function computeSuggestedSens(analysis: MouseTraceAnalysis, stats: Record<string, any>): SensSuggestion {
  const curr = Number(stats?.['cm/360'] ?? 0)
  if (!Number.isFinite(curr) || curr <= 0) return null

  const total = Math.max(1, analysis.kills.length)

  // Calculate confidence-weighted severity metrics
  const severity = calculateTraceSeverity(analysis)

  // Only provide suggestions if we have reasonable confidence and enough data
  if (severity.avgConfidence < 0.42 || total < 4) return null

  // === MAGNITUDE-BASED DECISION ===
  // Focus on HOW MUCH pixels are overshot/undershot, not just counts

  const overallOvershoot = analysis.overallOvershootPixels
  const overallUndershoot = analysis.overallUndershootPixels

  // Determine primary issue by magnitude (pixels), not just count
  // This gives better feedback because 3 severe overshoots matter more than 10 slight ones
  const overshootScore = severity.weightedOvershootPixels
  const undershootScore = severity.weightedUndershootPixels

  // If both scores are very low, aim is optimal - no suggestion needed
  if (overshootScore < 3 && undershootScore < 2) return null

  // If scores are close and both significant, mixed pattern - harder to give clear advice
  const scoreDiff = Math.abs(overshootScore - undershootScore)
  if (scoreDiff < Math.max(overshootScore, undershootScore) * 0.25 && overshootScore > 5 && undershootScore > 5) {
    return null // Mixed issues, no clear direction
  }

  const primaryIssue: 'overshoot' | 'undershoot' = overshootScore > undershootScore ? 'overshoot' : 'undershoot'
  const avgMagnitudePixels = primaryIssue === 'overshoot'
    ? analysis.avgOvershootPixels
    : analysis.avgUndershootPixels

  // Determine overall severity
  const severityCounts = primaryIssue === 'overshoot'
    ? analysis.severityCounts.overshoot
    : analysis.severityCounts.undershoot

  let overallSeverity: SeverityGrade = 'slight'
  if (severityCounts.severe > severityCounts.moderate && severityCounts.severe > severityCounts.slight) {
    overallSeverity = 'severe'
  } else if (severityCounts.moderate >= severityCounts.slight) {
    overallSeverity = 'moderate'
  }

  // Calculate adjustment based on severity AND magnitude
  const baseAdjustment = overallSeverity === 'severe' ? 0.20
    : overallSeverity === 'moderate' ? 0.12
      : 0.06

  // Scale by magnitude (more pixels = larger adjustment needed)
  const magnitudeScale = clamp(avgMagnitudePixels / 15, 0.5, 1.8)

  // Scale by confidence
  const confidenceScale = 0.6 + (severity.avgConfidence * 0.4)

  // Final adjustment (capped)
  const maxAdjustment = 0.30
  let adj = clamp(baseAdjustment * magnitudeScale * confidenceScale, 0.03, maxAdjustment)

  // Direction: overshoot => increase sens (smaller physical motion), undershoot => decrease sens
  if (primaryIssue === 'undershoot') adj = -adj

  const recommended = Math.max(0.001, curr * (1 + adj))
  const changePct = ((recommended / curr) - 1) * 100
  const direction = adj > 0 ? 'faster' : 'slower'

  // Build descriptive reason
  const confidenceNote = severity.avgConfidence < 0.58 ? ' (moderate confidence)' : ''
  const severityWord = overallSeverity === 'severe' ? 'significant'
    : overallSeverity === 'moderate' ? 'noticeable'
      : 'slight'

  const pct = primaryIssue === 'overshoot'
    ? (analysis.counts.overshoot / total)
    : (analysis.counts.undershoot / total)

  let reason: string
  if (primaryIssue === 'overshoot') {
    const pixelNote = avgMagnitudePixels > 10
      ? `averaging ${formatNumber(avgMagnitudePixels, 1)} pixels past target`
      : ''
    const clickNote = severity.clickWhileMovingRate > 0.35
      ? '; often clicking before fully settled'
      : ''

    reason = `${severityWord.charAt(0).toUpperCase() + severityWord.slice(1)} overshoot detected in ${formatPct(pct, 0)} of kills${pixelNote ? ` (${pixelNote})` : ''}${clickNote}. `
      + `Training at ${formatNumber(recommended, 2)} cm/360 (${direction}) for 3-10 runs can help calibrate smaller movements. `
      + `When you return to ${formatNumber(curr, 2)} cm/360, your muscle memory should produce more precise flicks${confidenceNote}.`
  } else {
    const correctionNote = severity.avgCorrectionCount > 2
      ? ` with ${formatNumber(severity.avgCorrectionCount, 1)} corrections per kill on average`
      : ''

    reason = `${severityWord.charAt(0).toUpperCase() + severityWord.slice(1)} undershoot detected in ${formatPct(pct, 0)} of kills${correctionNote}. `
      + `You're stopping short of targets and making micro-adjustments. Training at ${formatNumber(recommended, 2)} cm/360 (${direction}) `
      + `can help calibrate larger initial movements. When you return to ${formatNumber(curr, 2)} cm/360, your initial flicks should land closer to target${confidenceNote}.`
  }

  return {
    current: curr,
    recommended,
    changePct,
    direction,
    reason,
    primaryIssue,
    avgMagnitudePixels,
    severity: overallSeverity
  }
}

// Calculate trace-based severity metrics with focus on magnitude (pixels)
function calculateTraceSeverity(analysis: MouseTraceAnalysis) {
  let totalOvershootPixels = 0
  let overshootCount = 0
  let totalUndershootPixels = 0
  let undershootCount = 0
  let totalConfidence = 0
  let clickWhileMovingCount = 0
  let totalCorrectionCount = 0
  let analyzedKillCount = 0

  // Weighted scores that factor in severity
  let weightedOvershootPixels = 0
  let weightedUndershootPixels = 0

  for (const kill of analysis.kills) {
    totalConfidence += kill.confidence
    if (kill.clickedWhileMoving) clickWhileMovingCount++

    // Always track overshoot/undershoot pixels even for "optimal" kills
    // (they may have slight over/undershoot)
    if (kill.overshootPixels > 0) {
      totalOvershootPixels += kill.overshootPixels
      overshootCount++
      // Weight by severity
      const weight = kill.overshootSeverity === 'severe' ? 3.0
        : kill.overshootSeverity === 'moderate' ? 1.5
          : 1.0
      weightedOvershootPixels += kill.overshootPixels * weight * kill.confidence
    }

    if (kill.undershootPixels > 0) {
      totalUndershootPixels += kill.undershootPixels
      undershootCount++
      const weight = kill.undershootSeverity === 'severe' ? 3.0
        : kill.undershootSeverity === 'moderate' ? 1.5
          : 1.0
      weightedUndershootPixels += kill.undershootPixels * weight * kill.confidence
    }

    totalCorrectionCount += kill.correctionCount
    analyzedKillCount++
  }

  const total = analysis.kills.length
  return {
    avgOvershootPixels: overshootCount > 0 ? totalOvershootPixels / overshootCount : 0,
    avgUndershootPixels: undershootCount > 0 ? totalUndershootPixels / undershootCount : 0,
    weightedOvershootPixels: total > 0 ? weightedOvershootPixels / total : 0,
    weightedUndershootPixels: total > 0 ? weightedUndershootPixels / total : 0,
    avgConfidence: total > 0 ? totalConfidence / total : 0,
    clickWhileMovingRate: total > 0 ? clickWhileMovingCount / total : 0,
    avgCorrectionCount: analyzedKillCount > 0 ? totalCorrectionCount / analyzedKillCount : 0,
  }
}
