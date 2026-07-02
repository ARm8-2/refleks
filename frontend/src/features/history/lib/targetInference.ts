import type { MousePoint, RunPerformanceEvent, RunPerformanceHeader } from '@/shared/types/ipc'
import type { KillAnalysis, MouseTraceAnalysis } from './mouseAnalysis'

export type TargetInferenceFrame = {
  x: number
  y: number
  radius: number
  alpha: number
}

type SmoothedPoint = {
  x: number
  y: number
}

type EvidencePoint = {
  ts: number
  shots: number
  hits: number
  misses: number
  kills: number
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

function smoothPoints(points: MousePoint[]): SmoothedPoint[] {
  const weights = [1, 2, 3, 2, 1]
  const radius = 2
  return points.map((_, index) => {
    let weightedX = 0
    let weightedY = 0
    let totalWeight = 0

    for (let offset = -radius; offset <= radius; offset++) {
      const point = points[index + offset]
      if (!point) continue
      const weight = weights[offset + radius]
      weightedX += point.x * weight
      weightedY += point.y * weight
      totalWeight += weight
    }

    if (totalWeight <= 0) return { x: points[index].x, y: points[index].y }
    return { x: weightedX / totalWeight, y: weightedY / totalWeight }
  })
}

type MotionSignals = { speed: number[]; turnAngle: number[]; turnSpeed: number[] }

// Per-point cursor motion signals derived from the smoothed trace, used to
// refine where within a performance bucket the single on-target window most
// plausibly sits: `speed` is instantaneous frame-to-frame movement magnitude
// (small, steady movement reads as actively tracking a target, a wide sweep
// does not); `turnAngle` is the angle between the recent incoming and
// outgoing direction over a short time window (a sharp reversal reads as the
// moment the target changed direction and the player likely lost it for an
// instant); `turnSpeed` is how much actual movement backed that angle, used
// to gate out reversals found while barely moving (jitter, not a real
// direction change). The window is time-based rather than a fixed sample
// count so it behaves consistently regardless of the trace's capture rate.
function computeMotionSignals(points: MousePoint[], smoothed: SmoothedPoint[]): MotionSignals {
  const n = points.length
  const speed = new Array<number>(n).fill(0)
  const turnAngle = new Array<number>(n).fill(0)
  const turnSpeed = new Array<number>(n).fill(0)

  for (let i = 1; i < n; i++) {
    const dt = Math.max(1, points[i].ts - points[i - 1].ts)
    const dx = smoothed[i].x - smoothed[i - 1].x
    const dy = smoothed[i].y - smoothed[i - 1].y
    speed[i] = Math.hypot(dx, dy) / dt
  }
  if (n > 1) speed[0] = speed[1]

  const TURN_WINDOW_MS = 40
  for (let i = 0; i < n; i++) {
    const ts = points[i].ts
    let back = i
    while (back > 0 && ts - points[back - 1].ts <= TURN_WINDOW_MS) back--
    let fwd = i
    while (fwd < n - 1 && points[fwd + 1].ts - ts <= TURN_WINDOW_MS) fwd++

    const inX = smoothed[i].x - smoothed[back].x
    const inY = smoothed[i].y - smoothed[back].y
    const outX = smoothed[fwd].x - smoothed[i].x
    const outY = smoothed[fwd].y - smoothed[i].y
    const inLen = Math.hypot(inX, inY)
    const outLen = Math.hypot(outX, outY)
    if (inLen < 0.5 || outLen < 0.5) continue

    const cos = clamp((inX * outX + inY * outY) / (inLen * outLen), -1, 1)
    turnAngle[i] = Math.acos(cos)

    const span = Math.max(1, points[fwd].ts - points[back].ts)
    turnSpeed[i] = (inLen + outLen) / span
  }

  return { speed, turnAngle, turnSpeed }
}

function buildEvidencePoints(header: RunPerformanceHeader, events: RunPerformanceEvent[]): EvidencePoint[] {
  const byTimestamp = new Map<number, EvidencePoint>()

  for (const event of events) {
    if (!Number.isFinite(event.timestamp)) continue
    const ts = Math.round(header.challengeStartUtc + event.timestamp * 1000)
    const bucket = byTimestamp.get(ts) ?? { ts, shots: 0, hits: 0, misses: 0, kills: 0 }

    if (event.payloadType === 'shotsFired' && event.count !== undefined && Number.isFinite(event.count)) {
      bucket.shots += event.count
    } else if (event.payloadType === 'shotsHit' && event.count !== undefined && Number.isFinite(event.count)) {
      bucket.hits += event.count
    } else if (event.payloadType === 'shotsMissed' && event.count !== undefined && Number.isFinite(event.count)) {
      bucket.misses += event.count
    } else if (event.payloadType === 'kills' && event.count !== undefined && Number.isFinite(event.count)) {
      bucket.kills += event.count
    } else {
      continue
    }

    byTimestamp.set(ts, bucket)
  }

  return Array.from(byTimestamp.values())
    .filter(point => point.shots > 0 || point.hits > 0 || point.misses > 0 || point.kills > 0)
    .sort((a, b) => a.ts - b.ts)
}

// Reduces each ~1s performance bucket to a single contiguous "on target"
// sub-interval whose length matches that bucket's hit fraction, instead of
// smearing a flat confidence value across the whole second. Within any given
// second the player overwhelmingly moved on/off target only once (briefly
// lost and reacquired it, or vice versa) rather than being "60% on target"
// continuously throughout - so we model exactly that: mostly one state, with
// one contiguous excursion sized by the miss/hit ratio. When the bucket
// contains a kill, the on-target interval is anchored to the end of the
// bucket, since the kill is precise evidence that the final moments of that
// second were on target. Otherwise, the raw cursor motion within the bucket
// is used to place that window rather than just assuming it's centered: see
// placeOnTargetWindow.
type OnTargetSegment = {
  bucketStart: number
  bucketEnd: number
  onStart: number
  onEnd: number
  strength: number
}

function averageSpeedInWindow(points: MousePoint[], motion: MotionSignals, beginIdx: number, endIdx: number, winStart: number, winEnd: number): number {
  let sum = 0
  let count = 0
  for (let i = beginIdx; i <= endIdx; i++) {
    const ts = points[i].ts
    if (ts < winStart || ts > winEnd) continue
    sum += motion.speed[i]
    count++
  }
  return count > 0 ? sum / count : 0
}

// Timestamp of the sharpest qualifying direction reversal within [beginIdx,
// endIdx], or null if none stands out. Reversals found while the cursor is
// barely moving are ignored (that's jitter, not a real target-direction
// change) by requiring the windowed movement backing the angle (turnSpeed)
// to be a meaningful fraction of the bucket's own peak, which keeps the
// check scale-independent regardless of sensitivity/DPI. Gating on the
// windowed turnSpeed rather than the single-sample instantaneous speed
// matters here: a real sharp reversal often decelerates toward zero right at
// its own apex, so requiring instantaneous speed there would tend to reject
// exactly the reversals we're trying to find.
function findTurnTs(points: MousePoint[], motion: MotionSignals, beginIdx: number, endIdx: number): number | null {
  if (endIdx <= beginIdx) return null

  let maxTurnSpeed = 0
  for (let i = beginIdx; i <= endIdx; i++) maxTurnSpeed = Math.max(maxTurnSpeed, motion.turnSpeed[i])
  if (maxTurnSpeed <= 0) return null

  const TURN_ANGLE_THRESHOLD = 0.9 // radians, ~52 degrees of direction change
  const MIN_RELATIVE_SPEED = 0.25 // ignore reversals found while barely moving (jitter)
  let bestIdx = -1
  let bestAngle = TURN_ANGLE_THRESHOLD

  for (let i = beginIdx; i <= endIdx; i++) {
    if (motion.turnSpeed[i] < maxTurnSpeed * MIN_RELATIVE_SPEED) continue
    if (motion.turnAngle[i] > bestAngle) {
      bestAngle = motion.turnAngle[i]
      bestIdx = i
    }
  }

  return bestIdx >= 0 ? points[bestIdx].ts : null
}

// Chooses where within a bucket (with no kill to anchor it) the single
// on-target window most plausibly sits, using two pieces of raw cursor-
// motion evidence rather than just assuming the middle of the second:
// (1) prefer the sub-window with the least cursor movement, since small,
// controlled movement is far more consistent with actively tracking a
// target than a wide sweeping motion; (2) if the bucket contains a sharp,
// well-formed direction reversal, treat that instant as the likely moment
// the target changed direction and the player briefly lost it, and require
// the chosen window to sit on one side of it rather than straddling it.
function placeOnTargetWindow(
  points: MousePoint[],
  motion: MotionSignals,
  beginIdx: number,
  endIdx: number,
  bucketStart: number,
  bucketEnd: number,
  onLength: number,
): { start: number; end: number } {
  const bucketDuration = bucketEnd - bucketStart
  const mid = bucketStart + bucketDuration / 2

  if (onLength <= 0) return { start: mid, end: mid }
  if (onLength >= bucketDuration) return { start: bucketStart, end: bucketEnd }

  const maxStart = bucketEnd - onLength
  const candidateStarts = [clamp(mid - onLength / 2, bucketStart, maxStart)]

  const turnTs = findTurnTs(points, motion, beginIdx, endIdx)
  if (turnTs !== null) {
    const margin = Math.min(onLength * 0.15, 60)
    candidateStarts.push(clamp(turnTs - margin - onLength, bucketStart, maxStart))
    candidateStarts.push(clamp(turnTs + margin, bucketStart, maxStart))
  }

  if (endIdx > beginIdx) {
    const pointCount = endIdx - beginIdx + 1
    const sampleCount = Math.min(pointCount, 24)
    const step = Math.max(1, Math.floor(pointCount / sampleCount))
    for (let i = beginIdx; i <= endIdx; i += step) {
      candidateStarts.push(clamp(points[i].ts, bucketStart, maxStart))
    }
  }

  // Prefer any candidate that keeps the turn point outside the window at
  // all (categorical), then break ties by average speed inside the window
  // (lower is better), with a mild pull toward the bucket center to avoid
  // degenerate choices when the motion evidence is flat/inconclusive.
  let bestStart = candidateStarts[0]
  let bestAvoidsTurn = false
  let bestScore = Infinity

  for (const start of candidateStarts) {
    const end = start + onLength
    const avoidsTurn = turnTs === null || turnTs < start || turnTs > end
    const score = averageSpeedInWindow(points, motion, beginIdx, endIdx, start, end) + Math.abs((start + end) / 2 - mid) * 0.0005

    const better = avoidsTurn !== bestAvoidsTurn ? avoidsTurn : score < bestScore
    if (better) {
      bestStart = start
      bestAvoidsTurn = avoidsTurn
      bestScore = score
    }
  }

  return { start: bestStart, end: bestStart + onLength }
}

function buildOnTargetSegments(evidence: EvidencePoint[], points: MousePoint[], motion: MotionSignals): OnTargetSegment[] {
  const segments: OnTargetSegment[] = []
  let ptr = 0

  for (let index = 0; index < evidence.length; index++) {
    const point = evidence[index]
    const prevTs = index > 0 ? evidence[index - 1].ts : point.ts - 1000
    const bucketDuration = clamp(point.ts - prevTs, 400, 1400)
    const bucketStart = point.ts - bucketDuration
    const bucketEnd = point.ts

    const shots = Math.max(point.shots, point.hits + point.misses)
    let fraction: number
    let strength: number

    if (shots > 0) {
      fraction = clamp(point.hits / shots, 0, 1)
      strength = clamp(shots / 6, 0.45, 1)
    } else if (point.kills > 0) {
      fraction = 1
      strength = 0.85
    } else {
      continue
    }

    const onLength = fraction * bucketDuration
    let onStart: number
    let onEnd: number

    if (point.kills > 0) {
      onEnd = bucketEnd
      onStart = clamp(bucketEnd - onLength, bucketStart, bucketEnd)
    } else {
      while (ptr < points.length && points[ptr].ts < bucketStart) ptr++
      let scan = ptr
      while (scan < points.length && points[scan].ts <= bucketEnd) scan++
      const beginIdx = ptr
      const endIdx = scan - 1

      const placement = placeOnTargetWindow(points, motion, beginIdx, endIdx, bucketStart, bucketEnd, onLength)
      onStart = placement.start
      onEnd = placement.end
    }

    segments.push({ bucketStart, bucketEnd, onStart, onEnd, strength })
  }

  return segments
}

const SEGMENT_EDGE_MS = 130
const SEGMENT_GAP_TOLERANCE_MS = 150

function segmentAt(segments: OnTargetSegment[], ts: number, startIndex: number): { segment: OnTargetSegment | null; nextIndex: number } {
  let index = startIndex
  while (index < segments.length - 1 && segments[index].bucketEnd < ts) index++
  return { segment: segments[index] ?? null, nextIndex: index }
}

// Confidence (0-1ish) that the cursor is on target at `ts`, derived from the
// enclosing bucket's single on-target sub-interval. Fades linearly over
// SEGMENT_EDGE_MS at the boundary of that interval rather than cutting hard,
// and drops to 0 once we're outside the bucket entirely (no nearby evidence).
function confidenceFromSegment(segment: OnTargetSegment | null, ts: number): number {
  if (!segment) return 0
  if (ts < segment.bucketStart - SEGMENT_GAP_TOLERANCE_MS || ts > segment.bucketEnd + SEGMENT_GAP_TOLERANCE_MS) return 0

  if (ts >= segment.onStart && ts <= segment.onEnd) return segment.strength
  if (ts < segment.onStart) {
    const d = segment.onStart - ts
    return d <= SEGMENT_EDGE_MS ? segment.strength * (1 - d / SEGMENT_EDGE_MS) : 0
  }
  const d = ts - segment.onEnd
  return d <= SEGMENT_EDGE_MS ? segment.strength * (1 - d / SEGMENT_EDGE_MS) : 0
}

function directionForIndex(points: SmoothedPoint[], index: number, kill: KillAnalysis | null): { x: number; y: number } {
  const left = points[Math.max(0, index - 2)]
  const right = points[Math.min(points.length - 1, index + 2)]
  let dx = right.x - left.x
  let dy = right.y - left.y
  let len = Math.hypot(dx, dy)

  if (len < 1 && kill) {
    const start = points[Math.max(0, kill.startIndex)]
    const end = points[Math.min(points.length - 1, kill.endIndex)]
    dx = end.x - start.x
    dy = end.y - start.y
    len = Math.hypot(dx, dy)
  }

  if (len < 1) return { x: 1, y: 0 }
  return { x: dx / len, y: dy / len }
}

function resolveReferenceRadius(kills: KillAnalysis[]): number {
  const radii = kills.map(kill => kill.estRadius).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b)
  if (radii.length === 0) return 0
  return radii[Math.floor(radii.length / 2)]
}

// Radius of the target inferred for the current frame, in the same trace
// coordinate space as the points (raw accumulated mouse deltas, not screen
// pixels). While a kill window is active, its own detection radius is the
// most precise estimate. Otherwise, blend between the nearest completed kill
// and the upcoming one by time proximity.
function radiusForFrame(kills: KillAnalysis[], killCursor: number, activeKill: KillAnalysis | null, ts: number, fallback: number): number {
  if (activeKill) return activeKill.estRadius

  const prev = killCursor > 0 ? kills[killCursor - 1] : null
  const next = killCursor < kills.length ? kills[killCursor] : null

  if (prev && next) {
    const span = Math.max(1, next.endMs - prev.endMs)
    const t = clamp((ts - prev.endMs) / span, 0, 1)
    return prev.estRadius + (next.estRadius - prev.estRadius) * t
  }

  return (prev ?? next)?.estRadius ?? fallback
}

function activeKillAt(kills: KillAnalysis[], ts: number, startIndex: number): { kill: KillAnalysis | null; nextIndex: number } {
  let index = startIndex
  while (index < kills.length && kills[index].endMs < ts) index++
  const kill = index < kills.length && kills[index].startMs <= ts && ts <= kills[index].endMs ? kills[index] : null
  return { kill, nextIndex: index }
}

type Vec2 = { x: number; y: number }
type Run = { startIdx: number; endIdx: number }
type Gap = { runA: Run; runB: Run; tA: number; tB: number }

// Cubic Hermite spline through two anchor states (position + velocity/
// tangent) parameterized by time. Used to fill the gap between the last
// point we're confident was on target and the next one, producing a curve
// that departs smoothly along the outgoing velocity and arrives smoothly
// along the incoming velocity, instead of overshooting past either.
function hermite(pA: Vec2, vA: Vec2, pB: Vec2, vB: Vec2, tA: number, tB: number, ts: number): Vec2 {
  const duration = Math.max(1, tB - tA)
  const t = clamp((ts - tA) / duration, 0, 1)
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2

  return {
    x: h00 * pA.x + h10 * duration * vA.x + h01 * pB.x + h11 * duration * vB.x,
    y: h00 * pA.y + h10 * duration * vA.y + h01 * pB.y + h11 * duration * vB.y,
  }
}

// Caps a tangent (velocity) so it can't make the Hermite curve loop or
// overshoot wildly across a long gap - a tangent is only trustworthy for
// shaping the curve near its own endpoint, so we scale it down (never up)
// relative to the straight-line distance between the two anchors.
function clampTangent(v: Vec2, duration: number, maxDisplacement: number): Vec2 {
  const displacement = Math.hypot(v.x, v.y) * duration
  if (displacement <= maxDisplacement || displacement <= 0) return v
  const scale = maxDisplacement / displacement
  return { x: v.x * scale, y: v.y * scale }
}

// Estimates the target's instantaneous velocity at the start or end of an
// on-target run from the run's own (already lightly-smoothed) local
// position track, using a short lookahead/lookback window so a single noisy
// sample can't dominate.
function estimateRunVelocity(run: Run, atStart: boolean, points: MousePoint[], localX: number[], localY: number[]): Vec2 {
  const WINDOW_MS = 55
  if (atStart) {
    const t0 = points[run.startIdx].ts
    let j = run.startIdx
    while (j < run.endIdx && points[j + 1].ts - t0 <= WINDOW_MS) j++
    if (j === run.startIdx) return { x: 0, y: 0 }
    const dt = Math.max(1, points[j].ts - t0)
    return { x: (localX[j] - localX[run.startIdx]) / dt, y: (localY[j] - localY[run.startIdx]) / dt }
  }

  const t1 = points[run.endIdx].ts
  let j = run.endIdx
  while (j > run.startIdx && t1 - points[j - 1].ts <= WINDOW_MS) j--
  if (j === run.endIdx) return { x: 0, y: 0 }
  const dt = Math.max(1, t1 - points[j].ts)
  return { x: (localX[run.endIdx] - localX[j]) / dt, y: (localY[run.endIdx] - localY[j]) / dt }
}

const RUN_CONFIDENCE_THRESHOLD = 0.15
const TAIL_DECAY_TAU_MS = 220
const GAP_MIRROR_STRENGTH = 0.4
const ALPHA_FADE_TAU_MS = 380

export function computeTargetInference(
  points: MousePoint[],
  header: RunPerformanceHeader | undefined,
  performanceEvents: RunPerformanceEvent[],
  analysis: MouseTraceAnalysis | null,
): Array<TargetInferenceFrame | null> {
  if (!header || points.length < 2 || performanceEvents.length === 0) return []

  const kills = analysis?.kills ?? []
  if (kills.length === 0) return []

  const smoothed = smoothPoints(points)
  const motion = computeMotionSignals(points, smoothed)

  const evidence = buildEvidencePoints(header, performanceEvents)
  if (evidence.length === 0) return []

  const segments = buildOnTargetSegments(evidence, points, motion)
  if (segments.length === 0) return []

  const n = points.length
  const frames: Array<TargetInferenceFrame | null> = new Array(n).fill(null)
  const fallbackRadius = resolveReferenceRadius(kills)

  // --- Pass 1: per-point confidence -----------------------------------
  // backgroundConfidence is derived purely from real per-second evidence
  // (used to decide what counts as a trustworthy "on target" run, and to
  // shape the curve between runs). combinedConfidence additionally folds in
  // the kill-window floor and drives the rendered alpha.
  const backgroundConfidence = new Array<number>(n)
  const combinedConfidence = new Array<number>(n)
  const killIndexAt = new Array<number>(n).fill(-1)
  const killCursorAt = new Array<number>(n)
  const killProgressAt = new Array<number>(n).fill(0)

  {
    let segmentCursor = 0
    let killCursor = 0
    for (let i = 0; i < n; i++) {
      const ts = points[i].ts
      const segmentResult = segmentAt(segments, ts, segmentCursor)
      segmentCursor = segmentResult.nextIndex
      const bg = confidenceFromSegment(segmentResult.segment, ts)
      backgroundConfidence[i] = bg

      const activeKill = activeKillAt(kills, ts, killCursor)
      killCursor = activeKill.nextIndex
      killCursorAt[i] = killCursor

      let combined = bg
      if (activeKill.kill) {
        killIndexAt[i] = killCursor
        const duration = Math.max(1, activeKill.kill.endMs - activeKill.kill.startMs)
        const progress = clamp((ts - activeKill.kill.startMs) / duration, 0, 1)
        killProgressAt[i] = progress

        // Ramps in with flick progress instead of snapping to a flat value
        // the instant a kill window opens - early in the flick the cursor is
        // still travelling toward the target.
        const killFloor = 0.18 + 0.5 * progress + 0.24 * activeKill.kill.confidence
        combined = Math.max(combined, killFloor)
        if (progress > 0.78) combined = Math.max(combined, 0.68)
      }
      combinedConfidence[i] = clamp(combined, 0, 0.92)
    }
  }

  // --- Pass 2: contiguous on-target runs -------------------------------
  // Uses backgroundConfidence only (not the kill floor) so a run's boundary
  // velocity reflects genuine tracking motion, not the player's flick speed
  // while still approaching a target.
  const runs: Run[] = []
  {
    let i = 0
    while (i < n) {
      if (backgroundConfidence[i] >= RUN_CONFIDENCE_THRESHOLD) {
        let j = i
        while (j + 1 < n && backgroundConfidence[j + 1] >= RUN_CONFIDENCE_THRESHOLD) j++
        runs.push({ startIdx: i, endIdx: j })
        i = j + 1
      } else {
        i++
      }
    }
  }

  if (runs.length === 0) return frames

  // Non-empty gaps between consecutive runs, computed once and shared by
  // the position-curve pass and the visibility-fade pass below.
  const gaps: Gap[] = []
  for (let k = 0; k < runs.length - 1; k++) {
    const runA = runs[k]
    const runB = runs[k + 1]
    if (runB.startIdx <= runA.endIdx + 1) continue
    gaps.push({ runA, runB, tA: points[runA.endIdx].ts, tB: points[runB.startIdx].ts })
  }

  // --- Pass 3: local (lightly-smoothed) position within each run -------
  // The ease gain scales with confidence: when we're confidently on target
  // it still trails the cursor a bit (a target isn't a shadow glued to the
  // mouse - real aim wobbles around it slightly) but never drifts further
  // than roughly its own radius, so it reads as "the mouse is on the target"
  // without literally overlapping it every frame.
  const localX = new Array<number>(n)
  const localY = new Array<number>(n)
  const offsetCapBase = fallbackRadius > 0 ? fallbackRadius * 0.9 : 0

  for (const run of runs) {
    let px = smoothed[run.startIdx].x
    let py = smoothed[run.startIdx].y
    let prevTs = points[run.startIdx].ts
    localX[run.startIdx] = px
    localY[run.startIdx] = py

    for (let i = run.startIdx + 1; i <= run.endIdx; i++) {
      const ts = points[i].ts
      const dt = Math.max(1, ts - prevTs)
      prevTs = ts
      const tau = clamp(140 - 90 * backgroundConfidence[i], 45, 140)
      const gain = 1 - Math.exp(-dt / tau)
      px += (smoothed[i].x - px) * gain
      py += (smoothed[i].y - py) * gain

      if (offsetCapBase > 0) {
        const dx = px - smoothed[i].x
        const dy = py - smoothed[i].y
        const dist = Math.hypot(dx, dy)
        if (dist > offsetCapBase) {
          const scale = offsetCapBase / dist
          px = smoothed[i].x + dx * scale
          py = smoothed[i].y + dy * scale
        }
      }

      localX[i] = px
      localY[i] = py
    }
  }

  // --- Pass 4: gaps between runs - curve toward where the target reappears
  // instead of blindly extrapolating past it. Departs along the outgoing
  // velocity and arrives along the incoming one, decelerating/curving as
  // needed rather than snapping to a "random" far position. On top of that
  // smooth base curve we blend in a damped, tapered echo of the cursor's own
  // path shape during the gap: when a target suddenly changes direction the
  // player doesn't teleport onto the new line either - they overshoot the
  // old direction, then swing/correct toward the new one, and that swing is
  // real evidence of roughly which way the target actually went. It's not
  // mirrored 1:1 (a correction swing is typically wider than the target's
  // own movement), so it's damped and faded to zero at both edges so it
  // never disturbs the smooth arrival/departure velocities above - it only
  // bends the path in between instead of a spatially straight lerp.
  for (const gap of gaps) {
    const { runA, runB, tA, tB } = gap
    const pA: Vec2 = { x: localX[runA.endIdx], y: localY[runA.endIdx] }
    const pB: Vec2 = { x: localX[runB.startIdx], y: localY[runB.startIdx] }
    const duration = Math.max(1, tB - tA)
    const distance = Math.hypot(pB.x - pA.x, pB.y - pA.y)
    const maxTangentDisplacement = Math.max(distance * 1.4, 1)

    const vA = clampTangent(estimateRunVelocity(runA, false, points, localX, localY), duration, maxTangentDisplacement)
    const vB = clampTangent(estimateRunVelocity(runB, true, points, localX, localY), duration, maxTangentDisplacement)

    const cursorStart = smoothed[runA.endIdx]
    const cursorEnd = smoothed[runB.startIdx]
    const maxMirrorDisplacement = Math.max(distance * 0.8, 1)

    for (let i = runA.endIdx + 1; i < runB.startIdx; i++) {
      const ts = points[i].ts
      const pos = hermite(pA, vA, pB, vB, tA, tB, ts)

      // Cursor's own deviation from a straight line between its positions at
      // the gap's edges - a proxy for how the target actually curved, since
      // the player was actively chasing it the whole time, not standing
      // still.
      const t = clamp((ts - tA) / duration, 0, 1)
      const straightX = cursorStart.x + (cursorEnd.x - cursorStart.x) * t
      const straightY = cursorStart.y + (cursorEnd.y - cursorStart.y) * t
      let devX = smoothed[i].x - straightX
      let devY = smoothed[i].y - straightY
      const devLen = Math.hypot(devX, devY)
      if (devLen > maxMirrorDisplacement) {
        const scale = maxMirrorDisplacement / devLen
        devX *= scale
        devY *= scale
      }

      // Zero at both edges (so it never disturbs the Hermite endpoints) and
      // peaks mid-gap, where the player's correction swing is most visible.
      const taper = Math.sin(Math.PI * t) * GAP_MIRROR_STRENGTH

      localX[i] = pos.x + devX * taper
      localY[i] = pos.y + devY * taper
    }
  }

  // --- Pass 5: head/tail with no future or past anchor to curve toward -
  const firstRun = runs[0]
  if (firstRun.startIdx > 0) {
    const px = localX[firstRun.startIdx]
    const py = localY[firstRun.startIdx]
    for (let i = 0; i < firstRun.startIdx; i++) {
      localX[i] = px
      localY[i] = py
    }
  }

  const lastRun = runs[runs.length - 1]
  if (lastRun.endIdx < n - 1) {
    const tailVelocity = estimateRunVelocity(lastRun, false, points, localX, localY)
    let vx = tailVelocity.x
    let vy = tailVelocity.y
    let px = localX[lastRun.endIdx]
    let py = localY[lastRun.endIdx]
    let prevTs = points[lastRun.endIdx].ts

    for (let i = lastRun.endIdx + 1; i < n; i++) {
      const ts = points[i].ts
      const dt = Math.max(1, ts - prevTs)
      prevTs = ts
      px += vx * dt
      py += vy * dt
      const decay = Math.exp(-dt / TAIL_DECAY_TAU_MS)
      vx *= decay
      vy *= decay
      localX[i] = px
      localY[i] = py
    }
  }

  // --- Pass 6: visibility (alpha) away from runs -----------------------
  // combinedConfidence collapses to ~0 quickly outside a bucket's on-target
  // window (by design, for the position/segment model), but that made the
  // blob disappear the instant the player left the target - so we never
  // actually saw it travel the curve computed in pass 4. Visibility should
  // instead fade out gradually from the last confirmed on-target moment and
  // fade back in as we approach the next one, mirroring the position curve
  // itself: fully present on target, gently fading through an uncertain gap,
  // anticipating the next reacquisition rather than snapping to invisible.
  const renderAlpha = new Array<number>(n)

  for (const run of runs) {
    for (let i = run.startIdx; i <= run.endIdx; i++) renderAlpha[i] = combinedConfidence[i]
  }

  for (const gap of gaps) {
    const { runA, runB, tA, tB } = gap
    const alphaA = combinedConfidence[runA.endIdx]
    const alphaB = combinedConfidence[runB.startIdx]

    for (let i = runA.endIdx + 1; i < runB.startIdx; i++) {
      const ts = points[i].ts
      const fromPrev = alphaA * Math.exp(-(ts - tA) / ALPHA_FADE_TAU_MS)
      const towardNext = alphaB * Math.exp(-(tB - ts) / ALPHA_FADE_TAU_MS)
      renderAlpha[i] = Math.max(fromPrev, towardNext)
    }
  }

  if (firstRun.startIdx > 0) {
    const tFirst = points[firstRun.startIdx].ts
    const alphaFirst = combinedConfidence[firstRun.startIdx]
    for (let i = 0; i < firstRun.startIdx; i++) {
      renderAlpha[i] = alphaFirst * Math.exp(-(tFirst - points[i].ts) / ALPHA_FADE_TAU_MS)
    }
  }

  if (lastRun.endIdx < n - 1) {
    const tLast = points[lastRun.endIdx].ts
    const alphaLast = combinedConfidence[lastRun.endIdx]
    for (let i = lastRun.endIdx + 1; i < n; i++) {
      renderAlpha[i] = alphaLast * Math.exp(-(points[i].ts - tLast) / ALPHA_FADE_TAU_MS)
    }
  }

  // --- Pass 7: assemble rendered frames --------------------------------
  for (let i = 0; i < n; i++) {
    const killIndex = killIndexAt[i]
    const kill = killIndex >= 0 ? kills[killIndex] : null
    // Active kill windows keep using combinedConfidence directly (its
    // flick-progress ramp is already well-tuned); everywhere else uses the
    // gap-aware fade so the blob stays visible while it's travelling the
    // predicted curve, not just while directly on target.
    let alpha = kill ? combinedConfidence[i] : renderAlpha[i]

    if (!kill && alpha <= 0.06) continue

    const ts = points[i].ts
    const baseRadius = radiusForFrame(kills, killCursorAt[i], kill, ts, fallbackRadius)

    let x = localX[i]
    let y = localY[i]

    if (kill) {
      const dir = directionForIndex(smoothed, i, kill)
      const progress = killProgressAt[i]
      const phase = Math.sin(clamp((progress - 0.12) / 0.88, 0, 1) * Math.PI)

      if (kill.classification === 'overshoot' && kill.overshootPixels > 0) {
        const shift = Math.min(kill.overshootPixels * 0.18, baseRadius * 0.95) * phase
        x -= dir.x * shift
        y -= dir.y * shift
      } else if (kill.classification === 'undershoot' && kill.undershootPixels > 0) {
        const shift = Math.min(kill.undershootPixels * 0.18, baseRadius * 0.75) * phase
        x += dir.x * shift
        y += dir.y * shift
      }

      if (kill.stats.hits > 0) alpha = Math.min(0.92, alpha + 0.08)
    }

    alpha = clamp(alpha, 0, 0.92)
    if (alpha < 0.08) continue

    frames[i] = {
      x,
      y,
      radius: baseRadius * (1 + (1 - alpha) * 0.35),
      alpha,
    }
  }

  return frames
}
