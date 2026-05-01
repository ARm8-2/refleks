const DEFAULT_SCORE_DOMAIN: [number, number] = [0, 1]
const MIN_PAD = 1
const FLAT_DOMAIN_PAD_RATIO = 0.04
const SPAN_PAD_RATIO = 0.18
const THRESHOLD_DOMAIN_PAD_RATIO = 0.12
const THRESHOLD_SPAN_FOCUS_MULTIPLIER = 3

type DomainOptions = {
  flatPadRatio?: number
  spanPadRatio?: number
}

function sanitizePositive(values: number[]): number[] {
  return values.filter(value => Number.isFinite(value) && value > 0)
}

function finalizeDomain(lower: number, upper: number): [number, number] {
  if (upper > lower) return [lower, upper]
  return [Math.max(0, lower - 1), lower + 1]
}

export function buildScoreDomain(scores: number[], referenceScores: number[] = [], options: DomainOptions = {}): [number, number] {
  const values = sanitizePositive([...scores, ...referenceScores])
  if (values.length === 0) return DEFAULT_SCORE_DOMAIN

  const flatPadRatio = options.flatPadRatio ?? FLAT_DOMAIN_PAD_RATIO
  const spanPadRatio = options.spanPadRatio ?? SPAN_PAD_RATIO

  const min = Math.min(...values)
  const max = Math.max(...values)

  if (min === max) {
    const pad = Math.max(MIN_PAD, Math.round(max * flatPadRatio))
    return finalizeDomain(Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad))
  }

  const span = max - min
  const pad = Math.max(MIN_PAD, Math.round(span * spanPadRatio))
  return finalizeDomain(Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad))
}

export function buildThresholdAnchoredScoreDomain(scores: number[], thresholds: number[]): [number, number] {
  const scoreValues = sanitizePositive(scores)
  if (scoreValues.length === 0) return DEFAULT_SCORE_DOMAIN

  const scoreMin = Math.min(...scoreValues)
  const scoreMax = Math.max(...scoreValues)
  const scoreSpan = Math.max(MIN_PAD, scoreMax - scoreMin)

  const sortedStops = thresholds
    .filter(value => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)

  const lowerStop = [...sortedStops].reverse().find(stop => stop <= scoreMin)
  const upperStop = sortedStops.find(stop => stop >= scoreMax)

  let baseMin = lowerStop ?? scoreMin
  let baseMax = upperStop ?? scoreMax
  const baseSpan = Math.max(MIN_PAD, baseMax - baseMin)
  if (baseSpan > scoreSpan * THRESHOLD_SPAN_FOCUS_MULTIPLIER) {
    baseMin = scoreMin
    baseMax = scoreMax
  }

  const pad = Math.max(MIN_PAD, Math.round(Math.max(MIN_PAD, baseMax - baseMin) * THRESHOLD_DOMAIN_PAD_RATIO))
  return finalizeDomain(Math.max(0, Math.floor(baseMin - pad)), Math.ceil(baseMax + pad))
}
