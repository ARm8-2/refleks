import { Button } from '@/shared/components'
import type { StatKey } from '@/shared/types'
import { ArrowRightLeft, PinOff } from 'lucide-react'
import {
  buildRunStats,
  formatDurationLabel,
  formatPercent,
  formatRunTimestamp,
  formatScore,
  formatSessionTitle,
  type HistoryRun,
} from '../../lib/historyModels'
import { CompareMetric, CompareStatRow, HeroStat, StatRow, StatsGroup } from './shared'

/** Read a raw numeric value from a run's stats map. */
function readNumericStat(run: HistoryRun, key: StatKey): number | null {
  const raw = run.item.stats?.summary[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  return null
}

/** Read a formatted stat value produced by buildRunStats. */
function readFormattedStat(run: HistoryRun, key: StatKey): string {
  const all = buildRunStats(run.item)
  return all.find(s => s.key === key)?.value ?? '–'
}

/** Percentage change from A to B. Returns null when A is zero. */
function computeDelta(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null
  return ((b - a) / Math.abs(a)) * 100
}

type CategorizedStats = { category: string; stats: Array<{ key: StatKey; label: string; value: string }> }[]

function getCategorizedStats(run: HistoryRun): CategorizedStats {
  const all = buildRunStats(run.item)
  const buckets = new Map<string, Array<{ key: StatKey; label: string; value: string }>>()

  for (const s of all) {
    const cat = s.category
    let arr = buckets.get(cat)
    if (!arr) { arr = []; buckets.set(cat, arr) }
    arr.push({ key: s.key, label: s.label, value: s.value })
  }

  return [...buckets.entries()].map(([category, stats]) => ({ category, stats }))
}

export function StatsTab({ primaryRun, compareRun, onClearPrimaryRun, onClearComparison }: {
  primaryRun: HistoryRun
  compareRun: HistoryRun | null
  onClearPrimaryRun: () => void
  onClearComparison: () => void
}) {
  if (compareRun) {
    return (
      <CompareStatsView
        primaryRun={primaryRun}
        compareRun={compareRun}
        onClearPrimaryRun={onClearPrimaryRun}
        onClearComparison={onClearComparison}
      />
    )
  }

  const categories = getCategorizedStats(primaryRun)

  return (
    <>
      <div className="min-w-0">
        <div className="font-medium text-foreground">{primaryRun.scenarioName}</div>
        <div className="mt-0.5 text-xs text-surface-muted-foreground">
          {formatRunTimestamp(primaryRun.playedAt)} · {formatSessionTitle(primaryRun.session)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <HeroStat label="Score" value={formatScore(primaryRun.score)} />
        <HeroStat label="Accuracy" value={formatPercent(primaryRun.accuracy)} />
        <HeroStat label="Duration" value={formatDurationLabel(primaryRun.durationMs)} />
      </div>

      {categories.map(({ category, stats }) => (
        <StatsGroup key={category} label={category}>
          {stats.map(s => <StatRow key={s.label} label={s.label} value={s.value} />)}
        </StatsGroup>
      ))}

      {primaryRun.item.fileName && (
        <div className="text-[11px] text-surface-muted-foreground truncate" title={primaryRun.item.filePath || primaryRun.item.fileName}>
          {primaryRun.item.fileName}
        </div>
      )}
    </>
  )
}

function CompareStatsView({ primaryRun, compareRun, onClearPrimaryRun, onClearComparison }: {
  primaryRun: HistoryRun
  compareRun: HistoryRun
  onClearPrimaryRun: () => void
  onClearComparison: () => void
}) {
  const primaryCats = getCategorizedStats(primaryRun)
  const compareCats = getCategorizedStats(compareRun)

  const primaryMaps = new Map<string, Map<string, string>>()
  for (const { category, stats } of primaryCats) {
    primaryMaps.set(category, new Map(stats.map(s => [s.label, s.value])))
  }
  const compareMaps = new Map<string, Map<string, string>>()
  for (const { category, stats } of compareCats) {
    compareMaps.set(category, new Map(stats.map(s => [s.label, s.value])))
  }

  const allCategories = [...new Set([...primaryCats.map(c => c.category), ...compareCats.map(c => c.category)])]

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start justify-between gap-2 rounded-xl bg-surface-subtle px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-surface-muted-foreground">Pinned</div>
            <div className="mt-0.5 font-medium text-foreground truncate">{primaryRun.scenarioName}</div>
            <div className="text-[11px] text-surface-muted-foreground">{formatRunTimestamp(primaryRun.playedAt)}</div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClearPrimaryRun}>
            <PinOff className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-start justify-between gap-2 rounded-xl bg-surface-subtle px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-surface-muted-foreground">Compare</div>
            <div className="mt-0.5 font-medium text-foreground truncate">{compareRun.scenarioName}</div>
            <div className="text-[11px] text-surface-muted-foreground">{formatRunTimestamp(compareRun.playedAt)}</div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClearComparison}>
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {(() => {
        const ttkA = readNumericStat(primaryRun, 'avgTtk')
        const ttkB = readNumericStat(compareRun, 'avgTtk')

        return (
          <div className="grid grid-cols-3 gap-3">
            <CompareMetric
              label="Score"
              a={formatScore(primaryRun.score)}
              b={formatScore(compareRun.score)}
              delta={computeDelta(primaryRun.score, compareRun.score)}
              lowerIsBetter={false}
            />
            <CompareMetric
              label="Accuracy"
              a={formatPercent(primaryRun.accuracy)}
              b={formatPercent(compareRun.accuracy)}
              delta={computeDelta(primaryRun.accuracy ?? 0, compareRun.accuracy ?? 0)}
              lowerIsBetter={false}
            />
            <CompareMetric
              label="Avg TTK"
              a={readFormattedStat(primaryRun, 'avgTtk')}
              b={readFormattedStat(compareRun, 'avgTtk')}
              delta={ttkA != null && ttkB != null ? computeDelta(ttkA, ttkB) : null}
              lowerIsBetter
            />
          </div>
        )
      })()}

      {allCategories.map(cat => {
        const pMap = primaryMaps.get(cat) ?? new Map<string, string>()
        const cMap = compareMaps.get(cat) ?? new Map<string, string>()
        const mergedKeys = [...new Set([...pMap.keys(), ...cMap.keys()])]
        if (mergedKeys.length === 0) return null
        return (
          <StatsGroup key={cat} label={cat}>
            {mergedKeys.map(key => (
              <CompareStatRow key={key} label={key} a={pMap.get(key) ?? '–'} b={cMap.get(key) ?? '–'} />
            ))}
          </StatsGroup>
        )
      })}
    </>
  )
}
