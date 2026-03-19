import type { ScenarioRecord, ScenarioStats } from '../types'

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = trimmed.replaceAll(',', '').replace('%', '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDurationMs(value: unknown): number {
  const numeric = parseNumber(value)
  if (numeric !== null && numeric > 0) {
    return numeric * 1000
  }

  if (typeof value !== 'string') return 0

  const parts = value.trim().split(':').map(part => Number.parseFloat(part))
  if (parts.length < 2 || parts.some(part => !Number.isFinite(part))) {
    return 0
  }

  let seconds = 0
  for (const part of parts) {
    seconds = seconds * 60 + part
  }

  return seconds > 0 ? seconds * 1000 : 0
}

export function getScenarioName(input: ScenarioRecord | { fileName?: string; stats?: ScenarioStats }): string {
  const stats = input.stats
  const direct = readString(stats?.['Scenario'])
  if (direct) return direct

  const fileName = readString(input.fileName)
  if (fileName.includes(' - ')) {
    return fileName.split(' - ')[0].trim()
  }

  return fileName
}

export function readScenarioTimestamp(item: ScenarioRecord): number {
  const raw = item.stats?.['Date Played']
  if (!raw) return 0

  const timestamp = Date.parse(String(raw))
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function readScenarioScore(item: ScenarioRecord): number {
  return parseNumber(item.stats?.['Score']) ?? 0
}

export function readScenarioAccuracy(item: ScenarioRecord): number | null {
  const raw = parseNumber(item.stats?.['Accuracy'])
  if (raw === null) return null
  // Values in 0–1 range are ratios (0.85 = 85%); normalize to percentage
  return raw > 0 && raw <= 1 ? raw * 100 : raw
}

export function readScenarioDurationMs(item: ScenarioRecord): number {
  return parseDurationMs(
    item.stats?.['Duration']
    ?? item.stats?.['Scenario Time']
    ?? item.stats?.['Time'],
  )
}
