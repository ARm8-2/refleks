import type { MousePoint, RunStatsEvent, RunStatsSummary } from '@/shared/types/ipc'

/* ─── Types ─── */

export type SeverityGrade = 'none' | 'slight' | 'moderate' | 'severe'

export type KillAnalysis = {
  killIdx: number
  startMs: number
  endMs: number
  startIndex: number
  endIndex: number
  pathLength: number
  straight: number
  efficiency: number
  classification: 'optimal' | 'overshoot' | 'undershoot'
  stats: { shots: number; hits: number; ttkSec: number }
  overshootPixels: number
  undershootPixels: number
  overshootSeverity: SeverityGrade
  undershootSeverity: SeverityGrade
  confidence: number
  maxVelocity: number
  crossingCount: number
  clickedWhileMoving: boolean
  correctionCount: number
  estRadius: number
}

export type MouseTraceAnalysis = {
  kills: KillAnalysis[]
  counts: { overshoot: number; undershoot: number; optimal: number }
  avgEfficiency: number
  avgOvershootPixels: number
  avgUndershootPixels: number
  severityCounts: {
    overshoot: { slight: number; moderate: number; severe: number }
    undershoot: { slight: number; moderate: number; severe: number }
  }
  cm360: number | null
}

export type SensSuggestion = {
  current: number
  recommended: number
  changePct: number
  direction: 'slower' | 'faster'
  reason: string
  primaryIssue: 'overshoot' | 'undershoot'
  avgMagnitudePixels: number
  severity: SeverityGrade
}

/* ─── Helpers ─── */

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function lowerBound(points: MousePoint[], targetMs: number, lo = 0, hi = points.length - 1): number {
  let l = Math.max(0, lo)
  let r = Math.max(l, hi)
  while (l < r) {
    const mid = (l + r) >>> 1
    if (points[mid].ts < targetMs) l = mid + 1
    else r = mid
  }
  return Math.max(0, Math.min(points.length - 1, l))
}

type KillEvent = {
  idx: number
  tsAbsMs: number
  ttkSec: number
  shots: number
  hits: number
}

/* ─── Event parsing ─── */

function parseEventsToKills(events: RunStatsEvent[], baseIso: string): KillEvent[] {
  const out: KillEvent[] = []
  const end = new Date(baseIso)
  const baseY = end.getFullYear()
  const baseM = end.getMonth()
  const baseD = end.getDate()
  const endTOD = end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds() + end.getMilliseconds() / 1000

  for (const event of events) {
    const idx = event.killIndex
    const m = String(event.timestamp ?? '').match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/)
    if (!m) continue
    const hh = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10)
    const ss = parseInt(m[3], 10)
    const ms = m[4] ? Math.round(parseFloat('0.' + m[4]) * 1000) : 0
    const evt = new Date(baseY, baseM, baseD, hh, mm, ss, ms)
    const tsSec = hh * 3600 + mm * 60 + ss + ms / 1000
    if (Number.isFinite(endTOD) && tsSec > endTOD + 1) {
      evt.setDate(evt.getDate() - 1)
    }
    out.push({ idx, tsAbsMs: evt.getTime(), ttkSec: event.ttkSeconds, shots: event.shots, hits: event.hits })
  }
  out.sort((a, b) => a.tsAbsMs - b.tsAbsMs)
  for (let i = 1; i < out.length; i++) {
    if (out[i].tsAbsMs <= out[i - 1].tsAbsMs) out[i].tsAbsMs = out[i - 1].tsAbsMs + 1
  }
  return out
}

/* ─── Per-kill analysis ─── */

function analyzeWindow(
  points: MousePoint[],
  win: { startMs: number; endMs: number; startIndex: number; endIndex: number },
  ev: KillEvent,
): KillAnalysis {
  const { startIndex, endIndex, startMs, endMs } = win
  const startPoint = points[startIndex]
  const killPoint = points[Math.min(points.length - 1, endIndex)] || points[points.length - 1]

  let pathLen = 0
  let prevPoint = points[startIndex]
  for (let i = startIndex + 1; i <= endIndex; i++) {
    const p = points[i]
    pathLen += Math.hypot(p.x - prevPoint.x, p.y - prevPoint.y)
    prevPoint = p
  }
  const straight = Math.hypot(killPoint.x - startPoint.x, killPoint.y - startPoint.y)
  const efficiency = pathLen > 0 ? clamp(straight / pathLen, 0, 1) : 1

  const isTrackingLike = ev.hits > 30
  const isClickingLike = ev.hits <= 2 && ev.shots <= 2
  let radius: number
  if (isClickingLike) radius = clamp(Math.max(3, straight * 0.045), 3, 12)
  else if (isTrackingLike) radius = clamp(Math.max(6, straight * 0.10), 6, 35)
  else radius = clamp(Math.max(4, straight * 0.055), 4, 20)
  const radiusSq = radius * radius

  const distSq: number[] = []
  const velocities: number[] = []
  const signedDistances: { dx: number; dy: number }[] = []

  for (let i = startIndex; i <= endIndex; i++) {
    const p = points[i]
    const dx = p.x - killPoint.x
    const dy = p.y - killPoint.y
    distSq.push(dx * dx + dy * dy)
    signedDistances.push({ dx, dy })
    if (i > startIndex) {
      const prevP = points[i - 1]
      const dt = p.ts - prevP.ts
      velocities.push(dt > 0 ? Math.hypot(p.x - prevP.x, p.y - prevP.y) / dt : 0)
    }
  }

  // Overshoot detection - projects each point onto the actual (possibly
  // diagonal) approach direction from start to kill point, rather than
  // picking whichever single axis moved more. A point's projection is
  // positive when it sits further along that direction than the target
  // itself - i.e. the cursor travelled past it, the real overshoot side -
  // and negative while still short of it, regardless of whether the flick
  // was horizontal, vertical, or diagonal.
  const approachDx = killPoint.x - startPoint.x
  const approachDy = killPoint.y - startPoint.y
  const approachLen = Math.hypot(approachDx, approachDy) || 1
  const approachUx = approachDx / approachLen
  const approachUy = approachDy / approachLen

  let maxOvershootDist = 0
  let crossingCount = 0
  let lastSide = 0
  let zoneEntryIndex = -1
  let leftZoneAfterEntry = false

  for (let i = 0; i < distSq.length; i++) {
    const { dx, dy } = signedDistances[i]
    const dist = Math.sqrt(distSq[i])
    const alongTravel = dx * approachUx + dy * approachUy
    const curSide = Math.sign(alongTravel)

    if (lastSide !== 0 && curSide !== 0 && lastSide !== curSide && dist < radius * 4) crossingCount++
    lastSide = curSide || lastSide

    if (curSide > 0) {
      maxOvershootDist = Math.max(maxOvershootDist, Math.abs(alongTravel))
    }
    if (zoneEntryIndex === -1) {
      if (distSq[i] <= radiusSq) zoneEntryIndex = i
    } else {
      if (distSq[i] > radiusSq * 2.5) leftZoneAfterEntry = true
    }
  }

  const endWithin = distSq[distSq.length - 1] <= radiusSq
  const classicOvershoot = zoneEntryIndex !== -1 && leftZoneAfterEntry && endWithin
  const lateEntry = zoneEntryIndex !== -1 && zoneEntryIndex >= distSq.length - 2

  const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0
  const velocityAtKill = velocities.length > 0 ? velocities[velocities.length - 1] : 0
  const avgVelocity = velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0

  // Undershoot detection
  const startIndexLast300Ms = lowerBound(points, endMs - 300, startIndex, endIndex)
  let directionFlipCount = 0
  let previousDistSign = 0
  let decelerationFlipCount = 0
  let correctionDistance = 0
  let correctionCount = 0
  let inCorrection = false

  for (let i = Math.max(1, startIndexLast300Ms - startIndex); i < distSq.length; i++) {
    const dd = distSq[i] - distSq[i - 1]
    const sign = dd === 0 ? previousDistSign : dd > 0 ? 1 : -1
    const outside = distSq[i] > radiusSq
    if (outside && previousDistSign !== 0 && sign !== previousDistSign) {
      directionFlipCount++
      if (!inCorrection) { inCorrection = true; correctionCount++ }
      if (i > 1 && velocities[i - 1] !== undefined && velocities[i - 2] !== undefined && velocities[i - 1] < velocities[i - 2]) {
        decelerationFlipCount++
      }
    } else if (sign === previousDistSign && inCorrection) {
      inCorrection = false
    }
    if (inCorrection && i < distSq.length - 1) {
      const p1 = points[startIndex + i]
      const p2 = points[startIndex + i + 1]
      if (p1 && p2) correctionDistance += Math.hypot(p2.x - p1.x, p2.y - p1.y)
    }
    previousDistSign = sign
  }

  let stallCount = 0
  let avgStallDistance = 0
  for (let i = Math.max(0, distSq.length - 15); i < distSq.length - 1; i++) {
    const distFromTarget = Math.sqrt(distSq[i])
    if (distFromTarget < radius * 3 && distFromTarget > radius && velocities[i] !== undefined && velocities[i] < avgVelocity * 0.25) {
      stallCount++
      avgStallDistance += distFromTarget - radius
    }
  }
  avgStallDistance = stallCount > 0 ? avgStallDistance / stallCount : 0

  // Classification
  const hasSignificantOvershoot = maxOvershootDist > radius * 0.5
  const hasOvershootPattern = classicOvershoot || (crossingCount >= 2 && hasSignificantOvershoot)
  const lateEntryGuard = !(lateEntry && crossingCount <= 1 && maxOvershootDist < radius * 1.5)
  const isOvershoot = hasOvershootPattern && maxOvershootDist > Math.max(2, radius * 0.35) && lateEntryGuard

  const hasUndershootPattern =
    directionFlipCount >= 3 ||
    (decelerationFlipCount >= 2 && directionFlipCount >= 2) ||
    (stallCount >= 3 && directionFlipCount >= 1) ||
    (correctionCount >= 2 && avgStallDistance > radius * 0.3)

  const undershootMagnitude = hasUndershootPattern ? Math.max(avgStallDistance, correctionDistance / Math.max(1, correctionCount * 3)) : 0
  const isUndershoot = !isOvershoot && hasUndershootPattern && undershootMagnitude > 1

  // Severity
  let overshootSeverity: SeverityGrade = 'none'
  let undershootSeverity: SeverityGrade = 'none'

  if (isOvershoot) {
    const rel = maxOvershootDist / radius
    if (maxOvershootDist < 10 || rel < 1.0) overshootSeverity = 'slight'
    else if (maxOvershootDist < 22 || rel < 2.2) overshootSeverity = 'moderate'
    else overshootSeverity = 'severe'
  }
  if (isUndershoot) {
    const rel = undershootMagnitude / radius
    if (undershootMagnitude < 9 || rel < 0.9 || correctionCount <= 2) undershootSeverity = 'slight'
    else if (undershootMagnitude < 18 || rel < 1.6 || correctionCount <= 4) undershootSeverity = 'moderate'
    else undershootSeverity = 'severe'
  }

  const clickedWhileMoving = velocityAtKill > avgVelocity * 0.5 && velocityAtKill > 0.12

  // Confidence
  const numPoints = endIndex - startIndex + 1
  let confidence = 0.5
  if (numPoints >= 20) confidence += 0.15
  else if (numPoints >= 10) confidence += 0.1

  if (isOvershoot) {
    if (classicOvershoot && crossingCount >= 2) confidence += 0.25
    else if (classicOvershoot || maxOvershootDist > radius * 1.5) confidence += 0.15
    else confidence += 0.08
    if (!classicOvershoot && crossingCount < 2) confidence -= 0.08
  } else if (isUndershoot) {
    if (directionFlipCount >= 4) confidence += 0.22
    else if (directionFlipCount >= 3 || (stallCount >= 3 && correctionCount >= 2)) confidence += 0.15
    else confidence += 0.1
    if (directionFlipCount < 2 && correctionCount < 2) confidence -= 0.08
  } else {
    if (efficiency > 0.85 && !leftZoneAfterEntry && crossingCount <= 1) confidence += 0.25
    else if (efficiency > 0.7) confidence += 0.15
  }
  if (lateEntry) confidence -= 0.05
  confidence = clamp(confidence, 0, 1)

  const downgradeSeverity = (sev: SeverityGrade): SeverityGrade =>
    sev === 'severe' ? 'moderate' : sev === 'moderate' ? 'slight' : sev

  if (isOvershoot) {
    if ((!classicOvershoot && crossingCount < 3) || lateEntry || confidence < 0.62) overshootSeverity = downgradeSeverity(overshootSeverity)
    if (confidence < 0.45) overshootSeverity = downgradeSeverity(overshootSeverity)
  }
  if (isUndershoot) {
    if ((directionFlipCount < 3 && correctionCount < 2) || (stallCount < 2 && avgStallDistance < radius * 0.4) || confidence < 0.62) undershootSeverity = downgradeSeverity(undershootSeverity)
    if (confidence < 0.45) undershootSeverity = downgradeSeverity(undershootSeverity)
  }

  const classification: 'optimal' | 'overshoot' | 'undershoot' = isOvershoot ? 'overshoot' : isUndershoot ? 'undershoot' : 'optimal'

  return {
    killIdx: ev.idx,
    startMs, endMs, startIndex, endIndex,
    pathLength: pathLen, straight, efficiency,
    classification,
    stats: { shots: ev.shots, hits: ev.hits, ttkSec: ev.ttkSec },
    overshootPixels: isOvershoot ? maxOvershootDist : 0,
    undershootPixels: isUndershoot ? undershootMagnitude : 0,
    overshootSeverity, undershootSeverity,
    confidence, maxVelocity, crossingCount, clickedWhileMoving, correctionCount,
    estRadius: radius,
  }
}

/* ─── Main entry point ─── */

export function computeMouseTraceAnalysis(
  stats: RunStatsSummary,
  events: RunStatsEvent[],
  points: MousePoint[],
): MouseTraceAnalysis | null {
  if (points.length < 4 || events.length === 0) return null
  const baseIso = String(stats.datePlayed ?? '')
  if (!baseIso) return null
  const kills = parseEventsToKills(events, baseIso)
  if (!kills.length) return null

  const windowCapSec = 1.0
  const analyses: KillAnalysis[] = []
  for (const ev of kills) {
    const endMs = ev.tsAbsMs
    const startMs = Math.max(points[0].ts, endMs - Math.max(0.1, Math.min(Math.max(0, ev.ttkSec) || windowCapSec, windowCapSec)) * 1000)
    const startIndex = lowerBound(points, startMs)
    const endIndex = lowerBound(points, endMs)
    if (endIndex <= startIndex) continue
    analyses.push(analyzeWindow(points, { startMs, endMs, startIndex, endIndex }, ev))
  }

  let overshoot = 0, undershoot = 0, optimal = 0
  let effSum = 0, effN = 0
  let totalOvershootPx = 0, overshootKillN = 0
  let totalUndershootPx = 0, undershootKillN = 0
  const severityCounts = {
    overshoot: { slight: 0, moderate: 0, severe: 0 },
    undershoot: { slight: 0, moderate: 0, severe: 0 },
  }

  for (const a of analyses) {
    if (a.classification === 'overshoot') {
      overshoot++
      totalOvershootPx += a.overshootPixels
      overshootKillN++
      if (a.overshootSeverity !== 'none') severityCounts.overshoot[a.overshootSeverity]++
    } else if (a.classification === 'undershoot') {
      undershoot++
      totalUndershootPx += a.undershootPixels
      undershootKillN++
      if (a.undershootSeverity !== 'none') severityCounts.undershoot[a.undershootSeverity]++
    } else {
      optimal++
    }
    if (Number.isFinite(a.efficiency)) { effSum += a.efficiency; effN++ }
  }

  return {
    kills: analyses,
    counts: { overshoot, undershoot, optimal },
    avgEfficiency: effN ? effSum / effN : 0,
    avgOvershootPixels: overshootKillN > 0 ? totalOvershootPx / overshootKillN : 0,
    avgUndershootPixels: undershootKillN > 0 ? totalUndershootPx / undershootKillN : 0,
    severityCounts,
    cm360: Number(stats.cm360) || null,
  }
}

/* ─── Sensitivity suggestion ─── */

export function computeSuggestedSens(analysis: MouseTraceAnalysis, stats: RunStatsSummary): SensSuggestion | null {
  const curr = Number(stats.cm360 ?? 0)
  if (!Number.isFinite(curr) || curr <= 0) return null
  const total = Math.max(1, analysis.kills.length)

  let totalConf = 0, clickMovingN = 0, totalCorrN = 0
  let wOver = 0, wUnder = 0
  for (const k of analysis.kills) {
    totalConf += k.confidence
    if (k.clickedWhileMoving) clickMovingN++
    totalCorrN += k.correctionCount
    if (k.overshootPixels > 0) {
      const w = k.overshootSeverity === 'severe' ? 3 : k.overshootSeverity === 'moderate' ? 1.5 : 1
      wOver += k.overshootPixels * w * k.confidence
    }
    if (k.undershootPixels > 0) {
      const w = k.undershootSeverity === 'severe' ? 3 : k.undershootSeverity === 'moderate' ? 1.5 : 1
      wUnder += k.undershootPixels * w * k.confidence
    }
  }
  const avgConf = total > 0 ? totalConf / total : 0
  wOver /= total
  wUnder /= total
  const avgCorrCount = total > 0 ? totalCorrN / total : 0
  const clickRate = total > 0 ? clickMovingN / total : 0

  if (avgConf < 0.42 || total < 4) return null
  if (wOver < 3 && wUnder < 2) return null
  const diff = Math.abs(wOver - wUnder)
  if (diff < Math.max(wOver, wUnder) * 0.25 && wOver > 5 && wUnder > 5) return null

  const primaryIssue: 'overshoot' | 'undershoot' = wOver > wUnder ? 'overshoot' : 'undershoot'
  const avgMag = primaryIssue === 'overshoot' ? analysis.avgOvershootPixels : analysis.avgUndershootPixels
  const sc = primaryIssue === 'overshoot' ? analysis.severityCounts.overshoot : analysis.severityCounts.undershoot

  let severity: SeverityGrade = 'slight'
  if (sc.severe > sc.moderate && sc.severe > sc.slight) severity = 'severe'
  else if (sc.moderate >= sc.slight) severity = 'moderate'

  const base = severity === 'severe' ? 0.20 : severity === 'moderate' ? 0.12 : 0.06
  let adj = clamp(base * clamp(avgMag / 15, 0.5, 1.8) * (0.6 + avgConf * 0.4), 0.03, 0.30)
  // Overshoot → train with higher sens (lower cm/360) → decrease cm
  // Undershoot → train with lower sens (higher cm/360) → increase cm
  if (primaryIssue === 'overshoot') adj = -adj

  const recommended = Math.max(0.001, curr * (1 + adj))
  const changePct = ((recommended / curr) - 1) * 100
  const direction: 'slower' | 'faster' = adj < 0 ? 'faster' : 'slower'

  const confNote = avgConf < 0.58 ? ' (moderate confidence)' : ''
  const sevWord = severity === 'severe' ? 'Significant' : severity === 'moderate' ? 'Noticeable' : 'Slight'
  const pct = primaryIssue === 'overshoot' ? analysis.counts.overshoot / total : analysis.counts.undershoot / total
  const fmtPct = `${Math.round(pct * 100)}%`
  const fmtNum = (n: number, d = 2) => n.toFixed(d)

  let reason: string
  if (primaryIssue === 'overshoot') {
    const px = avgMag > 10 ? ` (avg ${fmtNum(avgMag, 1)}px past target)` : ''
    const click = clickRate > 0.35 ? '; often clicking before fully settled' : ''
    reason = `${sevWord} overshoot in ${fmtPct} of kills${px}${click}. Train at ${fmtNum(recommended)} cm/360 (${direction}) for 3–10 runs — the higher sens exaggerates overshooting, teaching your motor control to make smaller movements${confNote}.`
  } else {
    const corr = avgCorrCount > 2 ? ` with ~${fmtNum(avgCorrCount, 1)} corrections/kill` : ''
    reason = `${sevWord} undershoot in ${fmtPct} of kills${corr}. Train at ${fmtNum(recommended)} cm/360 (${direction}) for 3–10 runs — the lower sens forces larger initial movements, training your motor control to commit to bigger flicks${confNote}.`
  }

  return { current: curr, recommended, changePct, direction, reason, primaryIssue, avgMagnitudePixels: avgMag, severity }
}
