import { translate, type MessageKey } from "@/shared/lib/i18n";
import type {
  MousePoint,
  RunPerformanceHeader,
  RunStatsEvent,
  RunStatsSummary,
} from "@/shared/types/ipc";

const SEVERITY_LABEL_KEYS: Record<
  Exclude<SeverityGrade, "none">,
  MessageKey
> = {
  slight: "history.trace.severitySlight",
  moderate: "history.trace.severityModerate",
  severe: "history.trace.severitySevere",
};

const ISSUE_LABEL_KEYS: Record<"overshoot" | "undershoot", MessageKey> = {
  overshoot: "history.trace.overshoot",
  undershoot: "history.trace.undershoot",
};

/*
 * The trace is an event-driven stream of accumulated raw mouse input. It is not
 * a stream of screen pixels, so all distances in this module are deliberately
 * named `trace units`. Keeping that distinction here prevents the UI and the
 * sensitivity advice from presenting an invented pixel measurement as fact.
 */

export type SeverityGrade = "none" | "slight" | "moderate" | "severe";
export type KillClassification =
  "optimal" | "overshoot" | "undershoot" | "unknown";

export type TraceQuality = {
  sampleCount: number;
  durationMs: number;
  medianGapMs: number;
  maxGapMs: number;
  coverageRatio: number;
  hasLargeGap: boolean;
};

export type KillAnalysis = {
  killIdx: number;
  startMs: number;
  endMs: number;
  startIndex: number;
  endIndex: number;
  pathLength: number;
  straight: number;
  efficiency: number;
  classification: KillClassification;
  stats: { shots: number; hits: number; ttkSec: number };
  // Kept for consumers of the previous API. These are raw accumulated-input
  // units, never physical screen pixels.
  overshootPixels: number;
  undershootPixels: number;
  overshootSeverity: SeverityGrade;
  undershootSeverity: SeverityGrade;
  confidence: number;
  maxVelocity: number;
  crossingCount: number;
  clickedWhileMoving: boolean;
  correctionCount: number;
  estRadius: number;
  clickTs: number | null;
  traceQuality: TraceQuality;
  coordinateSpace: "raw-input";
  movementOnsetMs: number;
  targetEvidence: "inferred-endpoint" | "missing";
};

export type MouseTraceAnalysis = {
  kills: KillAnalysis[];
  counts: {
    overshoot: number;
    undershoot: number;
    optimal: number;
    unknown: number;
  };
  avgEfficiency: number;
  avgOvershootPixels: number;
  avgUndershootPixels: number;
  severityCounts: {
    overshoot: { slight: number; moderate: number; severe: number };
    undershoot: { slight: number; moderate: number; severe: number };
  };
  cm360: number | null;
  analyzedKillCount: number;
  skippedKillCount: number;
  knownKillCount: number;
  method: "kinematic-legacy";
  coordinateSpace: "raw-input";
  traceQuality: TraceQuality;
};

export type SensSuggestion = {
  current: number;
  recommended: number;
  changePct: number;
  direction: "slower" | "faster";
  reason: string;
  primaryIssue: "overshoot" | "undershoot";
  avgMagnitudePixels: number;
  severity: SeverityGrade;
};

type NormalizedPoint = MousePoint & { buttons: number };
type KillEvent = {
  idx: number;
  tsAbsMs: number;
  ttkSec: number;
  shots: number;
  hits: number;
};
type Window = {
  startMs: number;
  endMs: number;
  startIndex: number;
  endIndex: number;
  desiredDurationMs: number;
  clickTs: number | null;
};
type Vec = { x: number; y: number };

const DAY_MS = 86_400_000;
const MIN_TRACE_GAP_MS = 120;
const MAX_WINDOW_MS = 3_000;
const MIN_WINDOW_MS = 80;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function lowerBound(points: NormalizedPoint[], targetMs: number): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid].ts < targetMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(points: NormalizedPoint[], targetMs: number): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid].ts <= targetMs) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

function normalizeTrace(points: MousePoint[]): NormalizedPoint[] {
  return points
    .filter(
      (point) =>
        finite(point.ts) && finite(point.x) && finite(point.y) && point.ts >= 0,
    )
    .map((point, index) => ({
      ...point,
      buttons: finite(point.buttons) ? point.buttons : 0,
      __index: index,
    }))
    .sort(
      (a, b) =>
        a.ts - b.ts ||
        (a as MousePoint & { __index: number }).__index -
          (b as MousePoint & { __index: number }).__index,
    )
    .reduce<NormalizedPoint[]>((result, point) => {
      const previous = result[result.length - 1];
      if (previous?.ts === point.ts) {
        // Keep the last coordinate and button state observed at a timestamp.
        result[result.length - 1] = point;
      } else {
        result.push(point);
      }
      return result;
    }, []);
}

function getTraceQuality(
  points: NormalizedPoint[],
  window?: { startMs: number; endMs: number },
): TraceQuality {
  const startMs = window?.startMs ?? points[0]?.ts ?? 0;
  const endMs = window?.endMs ?? points[points.length - 1]?.ts ?? startMs;
  const gaps: number[] = [];
  let previous: NormalizedPoint | undefined;
  let sampleCount = 0;

  for (const point of points) {
    if (point.ts < startMs || point.ts > endMs) continue;
    sampleCount++;
    if (previous) gaps.push(point.ts - previous.ts);
    previous = point;
  }

  const durationMs = Math.max(0, endMs - startMs);
  const observedStart = points.find((point) => point.ts >= startMs)?.ts;
  const observedEnd = [...points]
    .reverse()
    .find((point) => point.ts <= endMs)?.ts;
  const observedDuration =
    observedStart !== undefined && observedEnd !== undefined
      ? Math.max(0, observedEnd - observedStart)
      : 0;

  return {
    sampleCount,
    durationMs,
    medianGapMs: median(gaps),
    maxGapMs: gaps.length > 0 ? Math.max(...gaps) : 0,
    coverageRatio:
      durationMs > 0 ? clamp(observedDuration / durationMs, 0, 1) : 0,
    hasLargeGap: gaps.some((gap) => gap > MIN_TRACE_GAP_MS),
  };
}

function parseClockSeconds(value: unknown): number {
  const match = String(value ?? "").match(
    /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/,
  );
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return Number.NaN;
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
  return hours * 3600 + minutes * 60 + seconds + fraction;
}

function elapsedSeconds(current: number, origin: number): number {
  const elapsed = current - origin;
  return elapsed >= 0 ? elapsed : elapsed + DAY_MS / 1000;
}

function parseIsoClockSeconds(value: string): number {
  const match = value.match(/T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!match) return Number.NaN;
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    (match[4] ? Number(`0.${match[4]}`) : 0)
  );
}

function parseDateParts(value: string): {
  year: number;
  month: number;
  day: number;
  offsetMinutes: number;
} | null {
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!date) return null;

  const zone = value.match(/([+-])(\d{2}):(\d{2})$/);
  const offsetMinutes = zone
    ? (Number(zone[2]) * 60 + Number(zone[3])) * (zone[1] === "-" ? -1 : 1)
    : 0;

  return {
    year: Number(date[1]),
    month: Number(date[2]),
    day: Number(date[3]),
    offsetMinutes,
  };
}

/** Convert a legacy local-clock timestamp without using the browser timezone. */
function legacyTimestampMs(
  baseIso: string,
  clockSeconds: number,
  baseClockSeconds: number,
): number | null {
  const parts = parseDateParts(baseIso);
  if (!parts || !finite(clockSeconds)) return null;

  let dayOffset = 0;
  if (finite(baseClockSeconds) && clockSeconds > baseClockSeconds + 1) {
    dayOffset = -1;
  }

  return (
    Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset) -
    parts.offsetMinutes * 60_000 +
    clockSeconds * 1000
  );
}

function parseEventsToKills(
  events: RunStatsEvent[],
  stats: RunStatsSummary,
  performanceHeader?: RunPerformanceHeader,
): KillEvent[] {
  const baseIso = String(stats.datePlayed ?? "");
  const baseClock = parseClockSeconds(stats.challengeStart);
  // datePlayed is the run end date in the filename-derived record. Use its
  // wall-clock time for legacy midnight disambiguation; challengeStart is the
  // scenario origin and can itself be close to midnight.
  const datePlayedClock = parseIsoClockSeconds(baseIso);
  const legacyReferenceClock = finite(datePlayedClock)
    ? datePlayedClock
    : baseClock;
  const challengeStartMs = performanceHeader?.challengeStartUtc;
  const canUsePerformanceClock =
    finite(challengeStartMs) &&
    challengeStartMs > 100_000_000_000 &&
    finite(baseClock);
  const result: KillEvent[] = [];

  for (const event of events) {
    const clock = parseClockSeconds(event.timestamp);
    if (!finite(clock)) continue;

    const tsAbsMs = canUsePerformanceClock
      ? challengeStartMs! + elapsedSeconds(clock, baseClock) * 1000
      : legacyTimestampMs(baseIso, clock, legacyReferenceClock);
    if (!finite(tsAbsMs)) continue;

    result.push({
      idx: finite(event.killIndex) ? event.killIndex : result.length + 1,
      tsAbsMs,
      ttkSec: finite(event.ttkSeconds) ? Math.max(0, event.ttkSeconds) : 0,
      shots: finite(event.shots) ? Math.max(0, event.shots) : 0,
      hits: finite(event.hits) ? Math.max(0, event.hits) : 0,
    });
  }

  return result
    .sort((a, b) => a.tsAbsMs - b.tsAbsMs || a.idx - b.idx)
    .map((event, index, sorted) => ({
      ...event,
      // Duplicate CSV timestamps are common at millisecond precision. Keep
      // their order deterministic without changing their actual timeline.
      tsAbsMs:
        index > 0 && event.tsAbsMs <= sorted[index - 1].tsAbsMs
          ? sorted[index - 1].tsAbsMs + 1
          : event.tsAbsMs,
    }));
}

function leftButtonDownTransitions(
  points: NormalizedPoint[],
  startMs: number,
  endMs: number,
): number[] {
  const transitions: number[] = [];
  const scanStart = startMs - 150;
  const scanEnd = endMs + 100;

  // Seed the state from the sample immediately before the scan window. Without
  // this, a button held across the window boundary looks like a fresh click at
  // the first sample in the window.
  let previousDown = false;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].ts < scanStart) {
      previousDown = (points[i].buttons & 1) !== 0;
      break;
    }
  }

  for (const point of points) {
    if (point.ts < scanStart) continue;
    if (point.ts > scanEnd) break;
    const down = (point.buttons & 1) !== 0;
    if (down && !previousDown && point.ts >= scanStart) {
      transitions.push(point.ts);
    }
    previousDown = down;
  }
  return transitions;
}

function chooseWindow(
  points: NormalizedPoint[],
  event: KillEvent,
  medianTtkMs: number,
): Window | null {
  const endMs = event.tsAbsMs;
  const traceStart = points[0]?.ts ?? 0;
  const traceEnd = points[points.length - 1]?.ts ?? 0;
  if (endMs < traceStart || endMs > traceEnd + 100) return null;

  const durationMs = clamp(
    event.ttkSec > 0 ? event.ttkSec * 1000 : medianTtkMs,
    MIN_WINDOW_MS,
    MAX_WINDOW_MS,
  );
  const desiredStartMs = endMs - durationMs;
  const startMs = Math.max(traceStart, desiredStartMs);
  const endIndex = upperBound(points, endMs);
  if (endIndex < 0) return null;

  const startIndex = lowerBound(points, startMs);
  const actualEndMs = points[endIndex].ts;
  if (startIndex >= endIndex || actualEndMs - points[startIndex].ts < 25)
    return null;

  const clickCandidates = leftButtonDownTransitions(points, startMs, endMs);
  const clickTs =
    clickCandidates
      .filter((ts) => Math.abs(ts - endMs) <= 150)
      .sort((a, b) => Math.abs(a - endMs) - Math.abs(b - endMs))[0] ?? null;

  return {
    startMs: points[startIndex].ts,
    endMs: actualEndMs,
    startIndex,
    endIndex,
    desiredDurationMs: durationMs,
    clickTs,
  };
}

function pointAt(points: NormalizedPoint[], index: number): Vec {
  return { x: points[index].x, y: points[index].y };
}

function subtract(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

function length(value: Vec): number {
  return Math.hypot(value.x, value.y);
}

function traceDistance(
  points: NormalizedPoint[],
  start: number,
  end: number,
): number {
  let distance = 0;
  for (let i = start + 1; i <= end; i++) {
    distance += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  return distance;
}

function classifySeverity(magnitude: number, radius: number): SeverityGrade {
  const normalized = magnitude / Math.max(radius, 1);
  if (normalized < 0.55) return "slight";
  if (normalized < 1.25) return "moderate";
  return "severe";
}

function downgrade(severity: SeverityGrade): SeverityGrade {
  return severity === "severe"
    ? "moderate"
    : severity === "moderate"
      ? "slight"
      : severity;
}

function analyzeWindow(
  points: NormalizedPoint[],
  window: Window,
  event: KillEvent,
): KillAnalysis {
  const { startIndex, endIndex, startMs, endMs } = window;
  const start = pointAt(points, startIndex);
  const finish = pointAt(points, endIndex);
  const displacement = subtract(finish, start);
  const straight = length(displacement);
  const pathLength = traceDistance(points, startIndex, endIndex);
  const efficiency = pathLength > 0 ? clamp(straight / pathLength, 0, 1) : 1;
  const quality = getTraceQuality(points, {
    startMs:
      startMs - Math.max(0, window.desiredDurationMs - (endMs - startMs)),
    endMs,
  });

  const velocities: number[] = [];
  const segmentDistances: number[] = [];
  for (let i = startIndex + 1; i <= endIndex; i++) {
    const dt = points[i].ts - points[i - 1].ts;
    const distance = Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
    if (dt > 0) {
      velocities.push(distance / dt);
      segmentDistances.push(distance);
    }
  }

  const medianStep = median(segmentDistances);
  const movementScale = Math.max(1, medianStep * 2, straight * 0.008);
  const radius = Math.max(movementScale * 2.5, straight * 0.035, 2);
  const direction =
    straight > movementScale
      ? {
          x: displacement.x / straight,
          y: displacement.y / straight,
        }
      : { x: 1, y: 0 };

  // The final cursor position is only an inferred endpoint. Overshoot is
  // accepted only when there is a clear excursion beyond that endpoint and a
  // subsequent return; lateral curvature alone cannot trigger it.
  let maxOvershoot = 0;
  let overshootIndex = -1;
  let previousSide = -1;
  let crossingCount = 0;
  const overshootThreshold = Math.max(movementScale * 2, straight * 0.025, 2);
  const projections: number[] = [];
  const distancesToEnd: number[] = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const relative = subtract(pointAt(points, i), finish);
    const projection = dot(relative, direction);
    projections.push(projection);
    distancesToEnd.push(length(relative));
    const side =
      projection > overshootThreshold
        ? 1
        : projection < -overshootThreshold
          ? -1
          : 0;
    if (side !== 0 && previousSide !== -1 && side !== previousSide) {
      crossingCount++;
    }
    if (side !== 0) previousSide = side;
    if (projection > maxOvershoot) {
      maxOvershoot = projection;
      overshootIndex = i;
    }
  }

  const returnedAfterOvershoot =
    overshootIndex >= 0 &&
    overshootIndex < endIndex - 1 &&
    projections[projections.length - 1] < maxOvershoot * 0.35 &&
    maxOvershoot > overshootThreshold;
  const isOvershoot = returnedAfterOvershoot;

  // Count meaningful longitudinal corrections. Hysteresis makes this stable
  // against the tiny reversals caused by a 125 Hz event stream.
  let correctionCount = 0;
  let previousDirection = 0;
  let correctionDistance = 0;
  for (let i = 1; i < projections.length; i++) {
    const delta = projections[i] - projections[i - 1];
    if (Math.abs(delta) < movementScale * 0.35) continue;
    const currentDirection = Math.sign(delta);
    if (
      previousDirection !== 0 &&
      currentDirection !== previousDirection &&
      distancesToEnd[i] > radius * 0.75
    ) {
      correctionCount++;
    }
    if (currentDirection < 0 && distancesToEnd[i] > radius) {
      correctionDistance += Math.abs(delta);
    }
    previousDirection = currentDirection;
  }

  const finalWindowStart = endMs - 250;
  const lateOutside = distancesToEnd.filter(
    (_, index) =>
      points[startIndex + index].ts >= finalWindowStart &&
      distancesToEnd[index] > radius,
  );
  const lowVelocityThreshold =
    velocities.length > 0 ? median(velocities) * 0.7 : 0;
  let stalledOutsideMs = 0;
  for (let i = startIndex + 1; i <= endIndex; i++) {
    if (
      points[i].ts >= finalWindowStart &&
      distancesToEnd[i - startIndex] > radius &&
      velocities[i - startIndex - 1] <= lowVelocityThreshold
    ) {
      stalledOutsideMs += Math.max(0, points[i].ts - points[i - 1].ts);
    }
  }

  const hasCorrectionPattern =
    correctionCount >= 2 ||
    (correctionCount >= 1 && stalledOutsideMs >= 45 && lateOutside.length >= 2);
  const isUndershoot = !isOvershoot && hasCorrectionPattern;
  const meaningfulMovement =
    straight >= movementScale * 2 && pathLength >= movementScale * 3;
  const movementOnsetIndex = points.findIndex(
    (point, index) =>
      index >= startIndex &&
      index <= endIndex &&
      Math.hypot(point.x - start.x, point.y - start.y) >= movementScale * 2,
  );
  const movementOnsetMs =
    movementOnsetIndex >= 0 ? points[movementOnsetIndex].ts : startMs;

  const clickTs = window.clickTs;
  const clickIndex = clickTs == null ? endIndex : upperBound(points, clickTs);
  const velocityAtClick =
    clickIndex > startIndex && points[clickIndex].ts > points[clickIndex - 1].ts
      ? Math.hypot(
          points[clickIndex].x - points[clickIndex - 1].x,
          points[clickIndex].y - points[clickIndex - 1].y,
        ) /
        (points[clickIndex].ts - points[clickIndex - 1].ts)
      : (velocities[velocities.length - 1] ?? 0);
  const clickedWhileMoving =
    velocityAtClick > Math.max(lowVelocityThreshold, movementScale / 30);

  const severeGap =
    quality.maxGapMs >
    Math.max(MIN_TRACE_GAP_MS, window.desiredDurationMs * 0.35);
  const insufficientCoverage =
    quality.coverageRatio < 0.82 ||
    quality.sampleCount < 4 ||
    quality.durationMs < 35 ||
    severeGap;

  let classification: KillClassification;
  if (insufficientCoverage || !meaningfulMovement) {
    classification = insufficientCoverage ? "unknown" : "optimal";
  } else if (isOvershoot) {
    classification = "overshoot";
  } else if (isUndershoot) {
    classification = "undershoot";
  } else {
    classification = "optimal";
  }

  const overshootSeverity = isOvershoot
    ? classifySeverity(maxOvershoot, radius)
    : "none";
  const undershootMagnitude = isUndershoot
    ? Math.max(
        correctionDistance / Math.max(1, correctionCount),
        stalledOutsideMs * lowVelocityThreshold,
        movementScale,
      )
    : 0;
  const undershootSeverity = isUndershoot
    ? classifySeverity(undershootMagnitude, radius)
    : "none";

  let confidence = 0.28;
  confidence += clamp(quality.coverageRatio, 0, 1) * 0.2;
  confidence +=
    quality.sampleCount >= 10 ? 0.16 : quality.sampleCount >= 6 ? 0.1 : 0.04;
  confidence += clamp(efficiency, 0, 1) * 0.16;
  confidence += clickTs != null ? 0.08 : 0;
  if (isOvershoot && returnedAfterOvershoot) confidence += 0.13;
  if (isUndershoot && correctionCount >= 2) confidence += 0.12;
  if (classification === "unknown") confidence *= 0.6;
  // Without target telemetry this is a strong movement-shape signal, not an
  // authoritative target-relative diagnosis.
  confidence = clamp(confidence, 0.05, 0.72);
  if (classification === "overshoot" && crossingCount < 1)
    confidence = Math.min(confidence, 0.56);
  if (classification === "undershoot" && correctionCount < 2)
    confidence = Math.min(confidence, 0.52);

  let finalOvershootSeverity = overshootSeverity;
  let finalUndershootSeverity = undershootSeverity;
  if (confidence < 0.55) {
    finalOvershootSeverity = downgrade(finalOvershootSeverity);
    finalUndershootSeverity = downgrade(finalUndershootSeverity);
  }

  return {
    killIdx: event.idx,
    startMs,
    endMs,
    startIndex,
    endIndex,
    pathLength,
    straight,
    efficiency,
    classification,
    stats: { shots: event.shots, hits: event.hits, ttkSec: event.ttkSec },
    overshootPixels: isOvershoot ? maxOvershoot : 0,
    undershootPixels: isUndershoot ? undershootMagnitude : 0,
    overshootSeverity: finalOvershootSeverity,
    undershootSeverity: finalUndershootSeverity,
    confidence,
    maxVelocity: velocities.length > 0 ? Math.max(...velocities) : 0,
    crossingCount,
    clickedWhileMoving,
    correctionCount,
    estRadius: radius,
    clickTs,
    traceQuality: quality,
    coordinateSpace: "raw-input",
    movementOnsetMs,
    targetEvidence: "inferred-endpoint",
  };
}

export function computeMouseTraceAnalysis(
  stats: RunStatsSummary,
  events: RunStatsEvent[],
  points: MousePoint[],
  performanceHeader?: RunPerformanceHeader,
): MouseTraceAnalysis | null {
  const normalized = normalizeTrace(points);
  if (normalized.length < 2 || events.length === 0) return null;

  const traceQuality = getTraceQuality(normalized);
  const parsedKills = parseEventsToKills(events, stats, performanceHeader);
  if (parsedKills.length === 0) return null;

  const validTtks = parsedKills
    .map((event) => event.ttkSec * 1000)
    .filter((value) => value >= MIN_WINDOW_MS && value <= MAX_WINDOW_MS);
  const medianTtkMs = median(validTtks) || 600;
  const analyses: KillAnalysis[] = [];
  let skippedKillCount = 0;

  for (const event of parsedKills) {
    const window = chooseWindow(normalized, event, medianTtkMs);
    if (!window) {
      skippedKillCount++;
      continue;
    }
    analyses.push(analyzeWindow(normalized, window, event));
  }
  if (analyses.length === 0) return null;

  const counts = { overshoot: 0, undershoot: 0, optimal: 0, unknown: 0 };
  const severityCounts = {
    overshoot: { slight: 0, moderate: 0, severe: 0 },
    undershoot: { slight: 0, moderate: 0, severe: 0 },
  };
  let efficiencySum = 0;
  let efficiencyCount = 0;
  let overshootSum = 0;
  let overshootCount = 0;
  let undershootSum = 0;
  let undershootCount = 0;

  for (const analysis of analyses) {
    counts[analysis.classification]++;
    if (analysis.classification !== "unknown") {
      efficiencySum += analysis.efficiency;
      efficiencyCount++;
    }
    if (analysis.classification === "overshoot") {
      overshootSum += analysis.overshootPixels;
      overshootCount++;
      if (analysis.overshootSeverity !== "none")
        severityCounts.overshoot[analysis.overshootSeverity]++;
    }
    if (analysis.classification === "undershoot") {
      undershootSum += analysis.undershootPixels;
      undershootCount++;
      if (analysis.undershootSeverity !== "none")
        severityCounts.undershoot[analysis.undershootSeverity]++;
    }
  }

  return {
    kills: analyses,
    counts,
    avgEfficiency: efficiencyCount > 0 ? efficiencySum / efficiencyCount : 0,
    avgOvershootPixels: overshootCount > 0 ? overshootSum / overshootCount : 0,
    avgUndershootPixels:
      undershootCount > 0 ? undershootSum / undershootCount : 0,
    severityCounts,
    cm360: finite(stats.cm360) && stats.cm360 > 0 ? stats.cm360 : null,
    analyzedKillCount: analyses.length,
    skippedKillCount,
    knownKillCount: analyses.length - counts.unknown,
    method: "kinematic-legacy",
    coordinateSpace: "raw-input",
    traceQuality,
  };
}

/*
 * Sensitivity advice is deliberately a training perturbation, not an attempt
 * to find the player's objectively optimal sensitivity. The trace has no
 * target center/radius or per-shot hit timestamp, so only repeated,
 * high-confidence movement-shape evidence contributes. The dose is intentionally
 * large enough to exaggerate the diagnosed problem for a short training block.
 */
export function computeSuggestedSens(
  analysis: MouseTraceAnalysis,
  stats: RunStatsSummary,
): SensSuggestion | null {
  const current = Number(stats.cm360 ?? 0);
  if (!finite(current) || current <= 0) return null;

  const known = analysis.kills.filter(
    (kill) => kill.classification !== "unknown" && kill.confidence >= 0.5,
  );
  if (known.length < 5) return null;

  let overshootScore = 0;
  let undershootScore = 0;
  let overshootMagnitude = 0;
  let undershootMagnitude = 0;
  let confidenceSum = 0;
  let movingClicks = 0;

  for (const kill of known) {
    const weight = kill.confidence * (kill.clickedWhileMoving ? 1.05 : 1);
    confidenceSum += kill.confidence;
    if (kill.clickedWhileMoving) movingClicks++;
    if (kill.classification === "overshoot") {
      overshootScore +=
        weight *
        Math.max(1, kill.overshootPixels / Math.max(kill.estRadius, 1));
      overshootMagnitude += kill.overshootPixels * weight;
    } else if (kill.classification === "undershoot") {
      undershootScore +=
        weight *
        Math.max(1, kill.undershootPixels / Math.max(kill.estRadius, 1));
      undershootMagnitude += kill.undershootPixels * weight;
    }
  }

  const averageConfidence = confidenceSum / known.length;
  if (averageConfidence < 0.55) return null;
  const totalScore = overshootScore + undershootScore;
  if (totalScore <= 0) return null;
  const dominantScore = Math.max(overshootScore, undershootScore);
  if (dominantScore / totalScore < 0.62) return null;

  const primaryIssue: "overshoot" | "undershoot" =
    overshootScore >= undershootScore ? "overshoot" : "undershoot";
  const issueFraction =
    known.filter((kill) => kill.classification === primaryIssue).length /
    known.length;
  if (issueFraction < 0.35) return null;

  const severityCounts =
    primaryIssue === "overshoot"
      ? analysis.severityCounts.overshoot
      : analysis.severityCounts.undershoot;
  const severity: SeverityGrade =
    severityCounts.severe >=
    Math.max(2, severityCounts.moderate + severityCounts.slight)
      ? "severe"
      : severityCounts.moderate >= severityCounts.slight
        ? "moderate"
        : "slight";

  // `cm/360` moves inversely to in-game sensitivity. These are training
  // doses, intentionally much stronger than a normal tuning recommendation:
  // overshoot gets a higher sens (lower cm/360), undershoot gets a lower sens
  // (higher cm/360). The upper bound avoids turning one noisy run into an
  // unusable recommendation.
  const baseDose =
    severity === "severe" ? 0.38 : severity === "moderate" ? 0.29 : 0.2;
  const dose = clamp(
    baseDose * clamp(0.75 + issueFraction * 0.8, 0.95, 1.15),
    0.18,
    0.45,
  );
  const signedChange = primaryIssue === "overshoot" ? -dose : dose;
  const recommended = Math.max(0.01, current * (1 + signedChange));
  const changePct = (recommended / current - 1) * 100;
  const direction = signedChange < 0 ? "faster" : "slower";
  const avgMagnitude =
    primaryIssue === "overshoot"
      ? overshootMagnitude / Math.max(1, overshootScore)
      : undershootMagnitude / Math.max(1, undershootScore);
  // The reason string is assembled at call time (this function only runs from
  // render/effect paths), so translate() reads the active locale correctly.
  const clickNote =
    movingClicks / known.length > 0.35
      ? translate("history.trace.sensClickNote")
      : "";
  const reason = translate("history.trace.sensReason", {
    severity: translate(SEVERITY_LABEL_KEYS[severity]),
    issue: translate(ISSUE_LABEL_KEYS[primaryIssue]),
    pct: Math.round(issueFraction * 100),
    clickNote,
    sens: recommended.toFixed(2),
    pctChange: Math.abs(Math.round(changePct)),
    direction: translate(
      primaryIssue === "overshoot"
        ? "history.trace.sensLowerCm360"
        : "history.trace.sensHigherCm360",
    ),
  });

  return {
    current,
    recommended,
    changePct,
    direction,
    reason,
    primaryIssue,
    avgMagnitudePixels: avgMagnitude,
    severity,
  };
}
