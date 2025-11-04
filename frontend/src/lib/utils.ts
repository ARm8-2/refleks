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

// Human-friendly duration like "1h 2m 3s" for session totals
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const parts: string[] = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (!h && (s || parts.length === 0)) parts.push(`${s}s`)
  return parts.join(' ')
}

// Short relative time like "1 hr ago", "2 d ago", or "now".
export function formatRelativeAgoShort(input: string | number | Date | undefined, maxMonths = 12): string {
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
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'now'
  const minutes = Math.floor(sec / 60)
  if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hr ago' : `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? '1 d ago' : `${days} d ago`
  if (days < 30) {
    const weeks = Math.max(1, Math.floor(days / 7))
    return weeks === 1 ? '1 wk ago' : `${weeks} wk ago`
  }
  const months = Math.max(1, Math.floor(days / 30))
  const m = Math.min(months, Math.max(1, Math.floor(maxMonths)))
  return m === 1 ? '1 mo ago' : `${m} mo ago`
}

export function formatPct01(v: any): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return '—'
  return (n * 100).toFixed(1) + '%'
}

export function formatSeconds(v: any): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!isFinite(n)) return '—'
  return `${n.toFixed(2)}s`
}
