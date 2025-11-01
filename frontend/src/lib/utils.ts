import type { ScenarioRecord } from '../types/ipc';

export function getScenarioName(it: ScenarioRecord | { fileName?: string; stats?: Record<string, any> }): string {
  const stats = (it as any).stats as Record<string, any> | undefined
  const direct = stats?.['Scenario']
  if (typeof direct === 'string' && direct.trim().length > 0) return direct
  const fn = (it as any).fileName as string | undefined
  if (typeof fn === 'string' && fn.includes(' - ')) return fn.split(' - ')[0]
  return String(direct ?? fn ?? '')
}

// Safe accessor for the "Date Played" field, accepting both spaced and unspaced variants
export function getDatePlayed(stats: Record<string, any> | undefined): string {
  if (!stats) return ''
  return String(stats['Date Played'] ?? stats['DatePlayed'] ?? '')
}

// Return a user-friendly representation for recent dates (today / N days ago)
// Falls back to the raw date string when parsing fails or the date is older than 7 days.
export function formatDatePlayed(stats: Record<string, any> | undefined): string {
  const raw = getDatePlayed(stats)
  if (!raw) return ''
  // Try to parse common YYYY-MM-DD or YYYY.MM.DD with optional time
  let ts = NaN
  const ymd = raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/) // groups: y,m,d,h,m,s
  if (ymd) {
    const y = parseInt(ymd[1], 10)
    const mo = parseInt(ymd[2], 10) - 1
    const d = parseInt(ymd[3], 10)
    const hh = ymd[4] ? parseInt(ymd[4], 10) : 0
    const mm = ymd[5] ? parseInt(ymd[5], 10) : 0
    const ss = ymd[6] ? parseInt(ymd[6], 10) : 0
    ts = new Date(y, mo, d, hh, mm, ss).getTime()
  }
  if (!Number.isFinite(ts)) {
    const parsed = Date.parse(raw)
    if (Number.isFinite(parsed)) ts = parsed
  }
  if (!Number.isFinite(ts)) return raw

  const now = Date.now()
  const diff = now - ts
  const DAY = 24 * 3600 * 1000
  if (diff < 0) return 'today'
  if (diff < DAY) return 'today'
  const days = Math.floor(diff / DAY)
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`
  return raw
}

// Format an arbitrary date (ISO / timestamp / Date) as a short relative label
// for recent dates (today / N days ago) up to `maxDays`. Falls back to a
// locale date/time string for older dates or when parsing fails.
export function formatRelativeDate(input: string | number | Date | undefined, maxDays = 7): string {
  if (input == null) return ''
  let ts: number
  if (typeof input === 'number') ts = input
  else if (input instanceof Date) ts = input.getTime()
  else {
    ts = Number.isFinite(Number(input)) ? Number(input) : Date.parse(String(input))
  }
  if (!Number.isFinite(ts)) return String(input)

  const now = Date.now()
  const diff = now - ts
  const DAY = 24 * 3600 * 1000
  if (diff < 0) return 'today'
  if (diff < DAY) return 'today'
  const days = Math.floor(diff / DAY)
  if (days < maxDays) return days === 1 ? '1 day ago' : `${days} days ago`
  return new Date(ts).toLocaleString()
}
