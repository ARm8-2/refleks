import type { ReactNode } from 'react'
import { useMemo } from 'react'
import type { ScenarioRecord } from '../../../types/ipc'

type StatKey = string

// Categories requested by the user. We also augment a couple of extras.
const CATEGORY_DEFS: Record<string, StatKey[]> = {
  'Overview': ['Score', 'Kills', 'Hit Count', 'Accuracy'],
  'Accuracy Details': ['Hit Count', 'Miss Count', 'Total Overshots', 'Damage Done', 'Damage Taken'],
  'Timing': ['Fight Time', 'Time Remaining', 'Avg TTK', 'Real Avg TTK', 'Pause Count', 'Pause Duration', 'Challenge Start'],
  'Controls': ['Sens Scale', 'Sens Increment', 'Horiz Sens', 'Vert Sens', 'DPI', 'cm/360'],
  'Display': ['FOV', 'FOVScale', 'Resolution', 'Hide Gun', 'Crosshair', 'Crosshair Scale', 'Crosshair Color'],
  'Technical': ['Input Lag', 'Max FPS (config)', 'Avg FPS', 'Resolution Scale'],
  'Game Information': ['Scenario', 'Hash', 'Game Version', 'Score', 'Date Played', 'Distance Traveled', 'MBS Points', 'Challenge Start'],
  'Additional Stats': ['Midairs', 'Midaired', 'Directs', 'Directed', 'Deaths', 'Avg Target Scale', 'Avg Time Dilation', 'Reloads'],
}

function isNumber(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v) }

function formatPercent(value: number, digits = 2) {
  return `${value.toFixed(digits)}%`
}

function formatSeconds(value: number, digits = 3) {
  return `${value.toFixed(digits)} s`
}

function asBoolLabel(v: unknown) {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string') {
    const s = v.toLowerCase()
    if (s === 'true') return 'Yes'
    if (s === 'false') return 'No'
  }
  return String(v)
}

function hexToRgb(hex: string) {
  const clean = hex.replace(/^#/, '')
  if (clean.length === 8) {
    // AARRGGBB -> RRGGBB
    return `#${clean.slice(2, 8)}`
  }
  if (clean.length === 6) return `#${clean}`
  if (clean.length === 3) return `#${clean.split('').map(c => c + c).join('')}`
  return `#000000`
}

function formatValue(key: string, raw: unknown): ReactNode {
  // Special-case common fields
  if (key === 'Accuracy' && isNumber(raw)) {
    const pct = raw <= 1 ? raw * 100 : raw
    return formatPercent(pct, 2)
  }
  if ((key.includes('TTK') || key === 'Fight Time' || key === 'Pause Duration' || key === 'Time Remaining') && isNumber(raw)) {
    return formatSeconds(raw, 3)
  }
  if (key === 'Resolution Scale' && isNumber(raw)) {
    return formatPercent(raw, 0)
  }
  if ((key.includes('FPS')) && isNumber(raw)) {
    return key === 'Avg FPS' ? raw.toFixed(1) : Math.round(raw).toString()
  }
  if (key === 'Crosshair Color' && typeof raw === 'string') {
    const color = hexToRgb(raw)
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-sm border border-[var(--border-primary)]" style={{ backgroundColor: color }} />
        <span className="tabular-nums">{raw}</span>
      </span>
    )
  }
  if (key === 'Hide Gun') {
    return asBoolLabel(raw)
  }
  if (key === 'Date Played' && typeof raw === 'string') {
    // ISO-8601 from backend
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d.toLocaleString()
  }
  // Default formatting
  if (isNumber(raw)) {
    // Keep reasonable precision, no trailing zeros for integers
    const isInt = Math.abs(raw - Math.round(raw)) < 1e-9
    return isInt ? String(Math.round(raw)) : raw.toFixed(3).replace(/\.0+$/, '')
  }
  return String(raw)
}

function StatList({
  stats,
  keys,
}: {
  stats: Record<string, any>
  keys: string[]
}) {
  return (
    <dl className="space-y-3 text-xs">
      {keys.map(k => {
        if (!(k in stats)) return null
        const v = stats[k]
        return (
          <div key={k} className="flex items-start justify-between gap-3">
            <dt className="text-[var(--text-secondary)] flex-shrink-0">{k}</dt>
            <dd className="text-[var(--text-primary)] flex-1 text-right break-words min-w-0 tabular-nums">{formatValue(k, v)}</dd>
          </div>
        )
      })}
    </dl>
  )
}

type RawBoxProps = { title: string; children: ReactNode }

function RawBox({ title, children }: RawBoxProps) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="text-sm font-medium text-[var(--text-primary)] truncate" title={title}>{title}</div>
      </div>
      <div className="p-3">
        {children}
      </div>
    </div>
  )
}

type OverviewCardsProps = { stats: Record<string, any> }

function OverviewCards({ stats }: OverviewCardsProps) {
  const keys: StatKey[] = ['Score', 'Kills', 'Hit Count', 'Accuracy']
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {keys.map(k => {
        if (!(k in stats)) return null
        const v = stats[k]
        return (
          <div key={k} className="bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)] p-3">
            <div className="text-[var(--text-secondary)] text-xs mb-1">{k}</div>
            <div className="text-[var(--accent-primary)] text-xl font-semibold tabular-nums">{formatValue(k, v)}</div>
          </div>
        )
      })}
    </div>
  )
}

type RawTabProps = { item: ScenarioRecord }

export function RawTab({ item }: RawTabProps) {
  const stats = item.stats

  const categories = useMemo(() => CATEGORY_DEFS, [])

  // Make sure keys don't duplicate across categories (first wins)
  const orderedEntries = useMemo(() => Object.entries(categories), [categories])
  const deDuped = useMemo(() => {
    const used = new Set<string>()
    return orderedEntries.map(([title, keys]) => {
      const filtered = keys.filter(k => {
        if (used.has(k)) return false
        used.add(k)
        return true
      })
      return [title, filtered] as [string, string[]]
    })
  }, [orderedEntries])

  // Collect keys that aren't covered by our categories and show them last
  const categorizedKeys = useMemo(() => new Set(deDuped.flatMap(([, keys]) => keys)), [deDuped])
  const extraKeys = useMemo(() => Object.keys(stats).filter(k => !categorizedKeys.has(k)), [stats, categorizedKeys])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {deDuped.map(([title, keys]) => (
          <RawBox key={title} title={title}>
            {title === 'Overview' ? (
              <OverviewCards stats={stats} />
            ) : (
              <StatList stats={stats} keys={keys} />
            )}
          </RawBox>
        ))}

        {extraKeys.length > 0 && (
          <RawBox title="Other Fields">
            <StatList stats={stats} keys={extraKeys} />
          </RawBox>
        )}
      </div>
    </div>
  )
}
