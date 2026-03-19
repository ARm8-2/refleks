import { ArrowRightLeft, Columns2, Layers, PanelRightClose, PinOff, Rows2, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, Scatter, ScatterChart, XAxis, YAxis } from 'recharts'
import { Button, Widget } from '../../../shared/components'
import type { ChartConfig } from '../../../shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../../shared/components/ui/chart'
import { usePersistedState } from '../../../shared/hooks'
import { cn } from '../../../shared/lib'
import type { StatKey } from '../../../shared/types'
import type { HistoryRun } from '../lib/historyModels'
import { buildRunStats, formatDurationLabel, formatNumber, formatPercent, formatRunTimestamp, formatScore, formatSessionTitle } from '../lib/historyModels'
import { computeScenarioAnalysis, type ScenarioAnalysis } from '../lib/scenarioAnalysis'

export type InspectorTab = 'stats' | 'analysis' | 'trace'

const tabs: { value: InspectorTab; label: string }[] = [
  { value: 'stats', label: 'Stats' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'trace', label: 'Trace' },
]

type Props = {
  primaryRun: HistoryRun | null
  compareRun: HistoryRun | null
  activeTab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  onClose: () => void
  onClearPrimaryRun: () => void
  onClearComparison: () => void
  isPrimaryPb: boolean
  onComparePb: () => void
}

export function HistoryRunDetailPane({
  primaryRun,
  compareRun,
  activeTab,
  onTabChange,
  onClose,
  onClearPrimaryRun,
  onClearComparison,
  isPrimaryPb,
  onComparePb,
}: Props) {
  const [overlay, setOverlay] = usePersistedState('refleks.history.analysisOverlay', false)

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-card">
      {/* Header: tabs + actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-1 rounded-xl bg-secondary p-1">
          {tabs.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {primaryRun && !isPrimaryPb && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onComparePb}
              title="Compare with personal best"
            >
              <Trophy className="mr-1 h-3.5 w-3.5" />
              vs PB
            </Button>
          )}
          {compareRun && activeTab === 'analysis' && (
            <Button
              variant={overlay ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setOverlay(o => !o)}
              title={overlay ? 'Show charts side by side' : 'Overlay both runs on the same charts'}
            >
              {overlay
                ? <><Columns2 className="mr-1 h-3.5 w-3.5" />Side by side</>
                : <><Layers className="mr-1 h-3.5 w-3.5" />Overlay</>
              }
            </Button>
          )}
          {compareRun && (
            <Button variant="ghost" size="sm" onClick={onClearComparison}>
              <Rows2 className="mr-1 h-3.5 w-3.5" />
              Single
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} title="Close inspector">
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!primaryRun ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Select a run to inspect</p>
        </div>
      ) : (
        <div className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-5 pt-2 space-y-4">
          {activeTab === 'stats' && (
            <StatsTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              onClearPrimaryRun={onClearPrimaryRun}
              onClearComparison={onClearComparison}
            />
          )}
          {activeTab === 'analysis' && (
            <AnalysisTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              overlay={overlay}
            />
          )}
          {activeTab === 'trace' && (
            <TraceTab
              primaryRun={primaryRun}
              compareRun={compareRun}
            />
          )}
        </div>
      )}
    </section>
  )
}

/* ─── Stats tab ─── */

/** Read a raw numeric value from a run's stats map. */
function readNumericStat(run: HistoryRun, key: StatKey): number | null {
  const raw = run.item.stats?.[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  return null
}

/** Read a formatted stat value produced by buildRunStats. */
function readFormattedStat(run: HistoryRun, key: StatKey): string {
  const all = buildRunStats(run.item)
  return all.find(s => s.label === key)?.value ?? '–'
}

/** Percentage change from A to B. Returns null when A is zero. */
function computeDelta(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null
  return ((b - a) / Math.abs(a)) * 100
}

const STAT_CATEGORIES: [string, StatKey[]][] = [
  ['Overview', ['Score', 'Kills', 'Hit Count', 'Accuracy']],
  ['Accuracy Details', ['Hit Count', 'Miss Count', 'Total Overshots', 'Damage Done', 'Damage Taken']],
  ['Timing', ['Fight Time', 'Time Remaining', 'Avg TTK', 'Real Avg TTK', 'Pause Count', 'Pause Duration', 'Challenge Start', 'Duration']],
  ['Controls', ['Sens Scale', 'Sens Increment', 'Horiz Sens', 'Vert Sens', 'DPI', 'cm/360']],
  ['Display', ['FOV', 'FOVScale', 'Resolution', 'Hide Gun', 'Crosshair', 'Crosshair Scale', 'Crosshair Color']],
  ['Technical', ['Input Lag', 'Max FPS (config)', 'Avg FPS', 'Resolution Scale']],
  ['Game Information', ['Scenario', 'Hash', 'Game Version', 'Score', 'Date Played', 'Distance Traveled', 'MBS Points', 'Challenge Start']],
  ['Additional Stats', ['Midairs', 'Midaired', 'Directs', 'Directed', 'Deaths', 'Avg Target Scale', 'Avg Time Dilation', 'Reloads']],
]

/** Map each stat label into its category. First match wins. */
function buildCategoryLookup(): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const [cat, keys] of STAT_CATEGORIES) {
    for (const k of keys) {
      if (!lookup.has(k)) lookup.set(k, cat)
    }
  }
  return lookup
}
const CATEGORY_LOOKUP = buildCategoryLookup()

type CategorizedStats = { category: string; stats: Array<{ label: string; value: string }> }[]

function getCategorizedStats(run: HistoryRun): CategorizedStats {
  const all = buildRunStats(run.item)
  const buckets = new Map<string, Array<{ label: string; value: string }>>()

  for (const s of all) {
    const cat = CATEGORY_LOOKUP.get(s.label) ?? 'Other'
    let arr = buckets.get(cat)
    if (!arr) { arr = []; buckets.set(cat, arr) }
    arr.push(s)
  }

  // Return in the defined order, skipping empty categories; uncategorized go to "Other"
  const result: CategorizedStats = []
  const definedCats = new Set(STAT_CATEGORIES.map(([cat]) => cat))
  for (const [cat] of STAT_CATEGORIES) {
    const stats = buckets.get(cat)
    if (stats && stats.length > 0) result.push({ category: cat, stats })
  }
  const otherStats = buckets.get('Other')
  if (otherStats && otherStats.length > 0 && !definedCats.has('Other')) {
    result.push({ category: 'Other', stats: otherStats })
  }
  return result
}

function StatsTab({ primaryRun, compareRun, onClearPrimaryRun, onClearComparison }: {
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
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-foreground">{primaryRun.scenarioName}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatRunTimestamp(primaryRun.playedAt)} · {formatSessionTitle(primaryRun.session)}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClearPrimaryRun}>
          <PinOff className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      {/* Performance hero cards */}
      <div className="grid grid-cols-3 gap-3">
        <HeroStat label="Score" value={formatScore(primaryRun.score)} />
        <HeroStat label="Accuracy" value={formatPercent(primaryRun.accuracy)} />
        <HeroStat label="Duration" value={formatDurationLabel(primaryRun.durationMs)} />
      </div>

      {/* Category groups */}
      {categories.map(({ category, stats }) => (
        <StatsGroup key={category} label={category}>
          {stats.map(s => <StatRow key={s.label} label={s.label} value={s.value} />)}
        </StatsGroup>
      ))}

      {/* File */}
      {primaryRun.item.fileName && (
        <div className="text-[11px] text-muted-foreground truncate" title={primaryRun.item.filePath || primaryRun.item.fileName}>
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

  // Build lookup maps per category for each run
  const primaryMaps = new Map<string, Map<string, string>>()
  for (const { category, stats } of primaryCats) {
    primaryMaps.set(category, new Map(stats.map(s => [s.label, s.value])))
  }
  const compareMaps = new Map<string, Map<string, string>>()
  for (const { category, stats } of compareCats) {
    compareMaps.set(category, new Map(stats.map(s => [s.label, s.value])))
  }

  // Merge categories from both runs, preserving defined order
  const allCategories = [...new Set([...primaryCats.map(c => c.category), ...compareCats.map(c => c.category)])]
  const orderedCategories = STAT_CATEGORIES
    .map(([cat]) => cat)
    .filter(cat => allCategories.includes(cat))

  return (
    <>
      {/* Runs header */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Pinned</div>
            <div className="mt-0.5 font-medium text-foreground truncate">{primaryRun.scenarioName}</div>
            <div className="text-[11px] text-muted-foreground">{formatRunTimestamp(primaryRun.playedAt)}</div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClearPrimaryRun}>
            <PinOff className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-start justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Compare</div>
            <div className="mt-0.5 font-medium text-foreground truncate">{compareRun.scenarioName}</div>
            <div className="text-[11px] text-muted-foreground">{formatRunTimestamp(compareRun.playedAt)}</div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClearComparison}>
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Performance comparison */}
      {(() => {
        const ttkA = readNumericStat(primaryRun, 'Avg TTK')
        const ttkB = readNumericStat(compareRun, 'Avg TTK')

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
              a={readFormattedStat(primaryRun, 'Avg TTK')}
              b={readFormattedStat(compareRun, 'Avg TTK')}
              delta={ttkA != null && ttkB != null ? computeDelta(ttkA, ttkB) : null}
              lowerIsBetter
            />
          </div>
        )
      })()}

      {/* Category groups with side-by-side values */}
      {orderedCategories.map(cat => {
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

/* ─── Analysis tab ─── */

type ChartData = {
  events: Array<Record<string, unknown>>
  ttk: Array<Record<string, unknown>>
  scatter: Array<{ x: number; y: number }>
}

function fmtTimeTick(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function buildChartData(analysis: ScenarioAnalysis): ChartData {
  return {
    events: analysis.timeSec.map((t, i) => ({
      timeSec: +t.toFixed(2),
      accOverTime: +(analysis.accOverTime[i] * 100).toFixed(1),
      realTTK: +analysis.realTTK[i].toFixed(3),
    })),
    ttk: analysis.timeSec.map((t, i) => ({
      timeSec: +t.toFixed(2),
      realTTK: +analysis.realTTK[i].toFixed(3),
      ma5: +analysis.movingAvg.ma5[i].toFixed(3),
    })),
    scatter: analysis.kpm.map((k, i) => ({
      x: +k.toFixed(1),
      y: +(analysis.perKillAcc[i] * 100).toFixed(1),
    })),
  }
}

/* Chart configs */
const eventsConfig: ChartConfig = {
  accOverTime: { label: 'Accuracy', color: 'var(--chart-2)' },
  realTTK: { label: 'TTK (s)', color: 'var(--chart-4)' },
}

const ttkConfig: ChartConfig = {
  realTTK: { label: 'TTK (s)', color: 'var(--chart-4)' },
  ma5: { label: 'MA(5)', color: 'var(--chart-2)' },
}

const scatterConfig: ChartConfig = {
  scatter: { label: 'Kill', color: 'var(--chart-2)' },
}

/* Overlay configs – two series per chart */
const eventsOverlayConfig: ChartConfig = {
  accOverTime: { label: 'Pinned Acc', color: 'var(--chart-2)' },
  realTTK: { label: 'Pinned TTK', color: 'var(--chart-4)' },
  cmpAccOverTime: { label: 'Compare Acc', color: 'var(--chart-1)' },
  cmpRealTTK: { label: 'Compare TTK', color: 'var(--chart-5)' },
}

const ttkOverlayConfig: ChartConfig = {
  realTTK: { label: 'Pinned TTK', color: 'var(--chart-4)' },
  ma5: { label: 'Pinned MA(5)', color: 'var(--chart-2)' },
  cmpRealTTK: { label: 'Compare TTK', color: 'var(--chart-1)' },
  cmpMa5: { label: 'Compare MA(5)', color: 'var(--chart-5)' },
}

const scatterOverlayConfig: ChartConfig = {
  pinned: { label: 'Pinned', color: 'var(--chart-2)' },
  compare: { label: 'Compare', color: 'var(--chart-1)' },
}

function AnalysisTab({ primaryRun, compareRun, overlay }: { primaryRun: HistoryRun; compareRun: HistoryRun | null; overlay: boolean }) {
  const primaryAnalysis = useMemo(() => computeScenarioAnalysis(primaryRun.item), [primaryRun])
  const compareAnalysis = useMemo(() => (compareRun ? computeScenarioAnalysis(compareRun.item) : null), [compareRun])

  if (!primaryAnalysis) {
    return (
      <div className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
        Not enough event data to analyze. At least 2 kills are required.
      </div>
    )
  }

  const primary = buildChartData(primaryAnalysis)

  /* ── Single run ── */
  if (!compareAnalysis) {
    return (
      <div className="space-y-3">
        <SummaryMetrics analysis={primaryAnalysis} />
        <Widget
          title="Kills over time"
          className="bg-secondary hover:bg-muted"
          modalTitle="Kills over time"
          modalContent={<EventsChart data={primary.events} height="h-[360px]" />}
        >
          <EventsChart data={primary.events} height="h-[160px]" />
        </Widget>
        <div className="grid gap-3 lg:grid-cols-2">
          <Widget
            title="TTK trend"
            description={`Slope: ${primaryAnalysis.movingAvg.slope >= 0 ? '+' : ''}${primaryAnalysis.movingAvg.slope.toFixed(4)}s/kill · R² ${primaryAnalysis.movingAvg.r2.toFixed(3)}`}
            className="bg-secondary hover:bg-muted"
            modalTitle="TTK moving average"
            modalContent={<TTKChart data={primary.ttk} height="h-[360px]" />}
          >
            <TTKChart data={primary.ttk} height="h-[160px]" />
          </Widget>
          <Widget
            title="Accuracy vs speed"
            description={`Pearson r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
            className="bg-secondary hover:bg-muted"
            modalTitle="Accuracy vs speed"
            modalContent={<ScatterPlot data={primary.scatter} height="h-[360px]" />}
          >
            <ScatterPlot data={primary.scatter} height="h-[160px]" />
          </Widget>
        </div>
      </div>
    )
  }

  /* ── Comparison ── */
  const compare = buildChartData(compareAnalysis)

  return (
    <div className="space-y-3">
      {/* Summary metrics */}
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryMetrics analysis={primaryAnalysis} label="Pinned" />
        <SummaryMetrics analysis={compareAnalysis} label="Compare" />
      </div>

      {overlay ? (
        <OverlayCharts
          primary={primary}
          compare={compare}
          primaryAnalysis={primaryAnalysis}
          compareAnalysis={compareAnalysis}
        />
      ) : (
        <SplitCharts
          primary={primary}
          compare={compare}
          primaryAnalysis={primaryAnalysis}
          compareAnalysis={compareAnalysis}
        />
      )}
    </div>
  )
}

/* ── Split view: each chart type side by side ── */

function SplitCharts({
  primary,
  compare,
  primaryAnalysis,
  compareAnalysis,
}: {
  primary: ChartData
  compare: ChartData
  primaryAnalysis: ScenarioAnalysis
  compareAnalysis: ScenarioAnalysis
}) {
  return (
    <div className="space-y-3">
      {/* Events */}
      <div className="grid gap-3 md:grid-cols-2">
        <Widget
          title="Kills over time — Pinned"
          className="bg-secondary hover:bg-muted"
          modalTitle="Kills over time — Pinned"
          modalContent={<EventsChart data={primary.events} height="h-[360px]" />}
        >
          <EventsChart data={primary.events} height="h-[140px]" />
        </Widget>
        <Widget
          title="Kills over time — Compare"
          className="bg-secondary hover:bg-muted"
          modalTitle="Kills over time — Compare"
          modalContent={<EventsChart data={compare.events} height="h-[360px]" />}
        >
          <EventsChart data={compare.events} height="h-[140px]" />
        </Widget>
      </div>
      {/* TTK */}
      <div className="grid gap-3 md:grid-cols-2">
        <Widget
          title="TTK trend — Pinned"
          description={`Slope: ${primaryAnalysis.movingAvg.slope >= 0 ? '+' : ''}${primaryAnalysis.movingAvg.slope.toFixed(4)}s/kill`}
          className="bg-secondary hover:bg-muted"
          modalTitle="TTK trend — Pinned"
          modalContent={<TTKChart data={primary.ttk} height="h-[360px]" />}
        >
          <TTKChart data={primary.ttk} height="h-[140px]" />
        </Widget>
        <Widget
          title="TTK trend — Compare"
          description={`Slope: ${compareAnalysis.movingAvg.slope >= 0 ? '+' : ''}${compareAnalysis.movingAvg.slope.toFixed(4)}s/kill`}
          className="bg-secondary hover:bg-muted"
          modalTitle="TTK trend — Compare"
          modalContent={<TTKChart data={compare.ttk} height="h-[360px]" />}
        >
          <TTKChart data={compare.ttk} height="h-[140px]" />
        </Widget>
      </div>
      {/* Scatter */}
      <div className="grid gap-3 md:grid-cols-2">
        <Widget
          title="Acc vs speed — Pinned"
          description={`r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
          className="bg-secondary hover:bg-muted"
          modalTitle="Accuracy vs speed — Pinned"
          modalContent={<ScatterPlot data={primary.scatter} height="h-[360px]" />}
        >
          <ScatterPlot data={primary.scatter} height="h-[140px]" />
        </Widget>
        <Widget
          title="Acc vs speed — Compare"
          description={`r: ${compareAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
          className="bg-secondary hover:bg-muted"
          modalTitle="Accuracy vs speed — Compare"
          modalContent={<ScatterPlot data={compare.scatter} height="h-[360px]" />}
        >
          <ScatterPlot data={compare.scatter} height="h-[140px]" />
        </Widget>
      </div>
    </div>
  )
}

/* ── Overlay view: both runs on same chart ── */

function mergeByTime(
  a: Array<Record<string, unknown>>,
  b: Array<Record<string, unknown>>,
  prefix: string,
  valueKeys: string[],
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = []
  for (const row of a) {
    const r: Record<string, unknown> = { timeSec: row.timeSec }
    for (const k of valueKeys) r[k] = row[k]
    rows.push(r)
  }
  for (const row of b) {
    const r: Record<string, unknown> = { timeSec: row.timeSec }
    for (const k of valueKeys) r[`${prefix}${k[0].toUpperCase()}${k.slice(1)}`] = row[k]
    rows.push(r)
  }
  rows.sort((x, y) => (x.timeSec as number) - (y.timeSec as number))
  return rows
}

function OverlayCharts({
  primary,
  compare,
  primaryAnalysis,
  compareAnalysis,
}: {
  primary: ChartData
  compare: ChartData
  primaryAnalysis: ScenarioAnalysis
  compareAnalysis: ScenarioAnalysis
}) {
  const eventsOverlay = useMemo(
    () => mergeByTime(primary.events, compare.events, 'cmp', ['accOverTime', 'realTTK']),
    [primary.events, compare.events],
  )
  const ttkOverlay = useMemo(
    () => mergeByTime(primary.ttk, compare.ttk, 'cmp', ['realTTK', 'ma5']),
    [primary.ttk, compare.ttk],
  )

  return (
    <div className="space-y-3">
      {/* Events overlay */}
      <Widget
        title="Kills over time"
        className="bg-secondary hover:bg-muted"
        modalTitle="Kills over time — Overlay"
        modalContent={<EventsChartOverlay data={eventsOverlay} height="h-[360px]" />}
      >
        <EventsChartOverlay data={eventsOverlay} height="h-[160px]" />
      </Widget>
      <div className="grid gap-3 lg:grid-cols-2">
        {/* TTK overlay */}
        <Widget
          title="TTK trend"
          description={`Pinned slope: ${primaryAnalysis.movingAvg.slope >= 0 ? '+' : ''}${primaryAnalysis.movingAvg.slope.toFixed(4)} · Compare: ${compareAnalysis.movingAvg.slope >= 0 ? '+' : ''}${compareAnalysis.movingAvg.slope.toFixed(4)}`}
          className="bg-secondary hover:bg-muted"
          modalTitle="TTK trend — Overlay"
          modalContent={<TTKChartOverlay data={ttkOverlay} height="h-[360px]" />}
        >
          <TTKChartOverlay data={ttkOverlay} height="h-[160px]" />
        </Widget>
        {/* Scatter overlay */}
        <Widget
          title="Accuracy vs speed"
          description={`Pinned r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)} · Compare: ${compareAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
          className="bg-secondary hover:bg-muted"
          modalTitle="Accuracy vs speed — Overlay"
          modalContent={<ScatterPlotOverlay primary={primary.scatter} compare={compare.scatter} height="h-[360px]" />}
        >
          <ScatterPlotOverlay primary={primary.scatter} compare={compare.scatter} height="h-[160px]" />
        </Widget>
      </div>
    </div>
  )
}

/* ── Summary metrics ── */

function SummaryMetrics({ analysis, label }: { analysis: ScenarioAnalysis; label?: string }) {
  const { summary } = analysis
  const fmtS = (v: number) => `${v.toFixed(2)}s`
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Kills" value={String(summary.kills)} />
        <MiniStat label="Accuracy" value={fmtPct(summary.finalAcc)} />
        <MiniStat label="Avg TTK" value={fmtS(summary.avgTTK)} />
        <MiniStat label="Median TTK" value={fmtS(summary.medianTTK)} />
        <MiniStat label="Avg KPM" value={summary.meanKPM.toFixed(1)} />
        <MiniStat label="TTK σ" value={fmtS(summary.stdTTK)} />
      </div>
    </div>
  )
}

/* ── Individual chart components ── */

function EventsChart({ data, height }: { data: Array<Record<string, unknown>>; height: string }) {
  return (
    <ChartContainer config={eventsConfig} className={`aspect-auto w-full ${height}`}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis type="number" dataKey="timeSec" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} tickFormatter={fmtTimeTick} />
        <YAxis yAxisId="acc" tickLine={false} axisLine={false} tickMargin={8} width={44} domain={[0, 100]} tickFormatter={v => `${v}%`} />
        <YAxis yAxisId="ttk" orientation="right" tickLine={false} axisLine={false} tickMargin={8} width={40} tickFormatter={v => `${v}s`} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtTimeTick(Number(v))} />} />
        <Line yAxisId="acc" isAnimationActive={false} type="monotone" dataKey="accOverTime" stroke="var(--color-accOverTime)" strokeWidth={2} dot={false} />
        <Line yAxisId="ttk" isAnimationActive={false} type="monotone" dataKey="realTTK" stroke="var(--color-realTTK)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

function TTKChart({ data, height }: { data: Array<Record<string, unknown>>; height: string }) {
  return (
    <ChartContainer config={ttkConfig} className={`aspect-auto w-full ${height}`}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis type="number" dataKey="timeSec" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} tickFormatter={fmtTimeTick} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tickFormatter={v => `${v}s`} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtTimeTick(Number(v))} />} />
        <Line isAnimationActive={false} type="monotone" dataKey="realTTK" stroke="var(--color-realTTK)" strokeWidth={1.5} dot={{ r: 1.5, fill: 'var(--color-realTTK)', strokeWidth: 0 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="ma5" stroke="var(--color-ma5)" strokeWidth={2.25} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

function ScatterPlot({ data, height }: { data: Array<{ x: number; y: number }>; height: string }) {
  return (
    <ChartContainer config={scatterConfig} className={`aspect-auto w-full ${height}`}>
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name="KPM" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis type="number" dataKey="y" name="Accuracy %" tickLine={false} axisLine={false} tickMargin={8} width={44} domain={[0, 100]} tickFormatter={v => `${v}%`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={() => 'Kill'}
              formatter={(value, name) => {
                if (name === 'x') return [`${value} KPM`, 'Speed']
                if (name === 'y') return [`${value}%`, 'Accuracy']
                return [String(value), String(name)]
              }}
            />
          }
        />
        <Scatter data={data} fill="var(--color-scatter)" r={3} isAnimationActive={false} />
      </ScatterChart>
    </ChartContainer>
  )
}

/* ── Overlay chart components ── */

function EventsChartOverlay({ data, height }: { data: Array<Record<string, unknown>>; height: string }) {
  return (
    <ChartContainer config={eventsOverlayConfig} className={`aspect-auto w-full ${height}`}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis type="number" dataKey="timeSec" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} tickFormatter={fmtTimeTick} />
        <YAxis yAxisId="acc" tickLine={false} axisLine={false} tickMargin={8} width={44} domain={[0, 100]} tickFormatter={v => `${v}%`} />
        <YAxis yAxisId="ttk" orientation="right" tickLine={false} axisLine={false} tickMargin={8} width={40} tickFormatter={v => `${v}s`} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtTimeTick(Number(v))} />} />
        <Line yAxisId="acc" isAnimationActive={false} type="monotone" dataKey="accOverTime" stroke="var(--color-accOverTime)" strokeWidth={2} dot={false} connectNulls />
        <Line yAxisId="ttk" isAnimationActive={false} type="monotone" dataKey="realTTK" stroke="var(--color-realTTK)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
        <Line yAxisId="acc" isAnimationActive={false} type="monotone" dataKey="cmpAccOverTime" stroke="var(--color-cmpAccOverTime)" strokeWidth={2} dot={false} opacity={0.7} connectNulls />
        <Line yAxisId="ttk" isAnimationActive={false} type="monotone" dataKey="cmpRealTTK" stroke="var(--color-cmpRealTTK)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} opacity={0.7} connectNulls />
      </LineChart>
    </ChartContainer>
  )
}

function TTKChartOverlay({ data, height }: { data: Array<Record<string, unknown>>; height: string }) {
  return (
    <ChartContainer config={ttkOverlayConfig} className={`aspect-auto w-full ${height}`}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis type="number" dataKey="timeSec" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} tickFormatter={fmtTimeTick} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tickFormatter={v => `${v}s`} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtTimeTick(Number(v))} />} />
        <Line isAnimationActive={false} type="monotone" dataKey="realTTK" stroke="var(--color-realTTK)" strokeWidth={1.5} dot={{ r: 1.5, fill: 'var(--color-realTTK)', strokeWidth: 0 }} connectNulls />
        <Line isAnimationActive={false} type="monotone" dataKey="ma5" stroke="var(--color-ma5)" strokeWidth={2.25} dot={false} connectNulls />
        <Line isAnimationActive={false} type="monotone" dataKey="cmpRealTTK" stroke="var(--color-cmpRealTTK)" strokeWidth={1.5} dot={{ r: 1.5, fill: 'var(--color-cmpRealTTK)', strokeWidth: 0 }} opacity={0.7} connectNulls />
        <Line isAnimationActive={false} type="monotone" dataKey="cmpMa5" stroke="var(--color-cmpMa5)" strokeWidth={2.25} dot={false} opacity={0.7} connectNulls />
      </LineChart>
    </ChartContainer>
  )
}

function ScatterPlotOverlay({ primary, compare, height }: { primary: Array<{ x: number; y: number }>; compare: Array<{ x: number; y: number }>; height: string }) {
  return (
    <ChartContainer config={scatterOverlayConfig} className={`aspect-auto w-full ${height}`}>
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name="KPM" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis type="number" dataKey="y" name="Accuracy %" tickLine={false} axisLine={false} tickMargin={8} width={44} domain={[0, 100]} tickFormatter={v => `${v}%`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={() => 'Kill'}
              formatter={(value, name) => {
                if (name === 'x') return [`${value} KPM`, 'Speed']
                if (name === 'y') return [`${value}%`, 'Accuracy']
                return [String(value), String(name)]
              }}
            />
          }
        />
        <Scatter name="pinned" data={primary} fill="var(--color-pinned)" r={3} isAnimationActive={false} />
        <Scatter name="compare" data={compare} fill="var(--color-compare)" r={3} isAnimationActive={false} opacity={0.7} />
      </ScatterChart>
    </ChartContainer>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  )
}

/* ─── Trace tab (placeholder) ─── */

function TraceTab({ primaryRun, compareRun }: { primaryRun: HistoryRun; compareRun: HistoryRun | null }) {
  return (
    <div className={cn('grid gap-3', compareRun && 'xl:grid-cols-2')}>
      <TraceCard run={primaryRun} label={compareRun ? 'Pinned' : 'Selected'} />
      {compareRun && <TraceCard run={compareRun} label="Compare" />}
    </div>
  )
}

function TraceCard({ run, label }: { run: HistoryRun; label: string }) {
  const hasTrace = run.item.hasTrace || (run.item.mouseTrace && run.item.mouseTrace.length > 0)

  return (
    <div className="rounded-xl bg-secondary p-4 space-y-3">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 font-medium text-foreground">{run.scenarioName}</div>
      </div>
      {hasTrace ? (
        <div className="rounded-lg bg-card p-3">
          <div className="text-xs text-muted-foreground">
            {run.item.mouseTrace ? `${run.item.mouseTrace.length} trace points` : 'Trace data available'}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Mouse movement visualization coming soon.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-card p-3 text-sm text-muted-foreground">
          No mouse trace data for this run. Enable mouse tracking in settings to record traces.
        </div>
      )}
    </div>
  )
}

/* ─── Shared sub-components ─── */

function StatsGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

function CompareMetric({ label, a, b, delta, lowerIsBetter }: {
  label: string
  a: string
  b: string
  delta?: number | null
  lowerIsBetter?: boolean
}) {
  const showDelta = delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.1
  const isImproved = showDelta && (lowerIsBetter ? delta < 0 : delta > 0)

  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {showDelta && (
          <span className={cn('text-[10px] font-medium', isImproved ? 'text-emerald-500' : 'text-red-400')}>
            {delta > 0 ? '+' : ''}{formatNumber(delta, 1)}%
          </span>
        )}
      </div>
      <div className="mt-1 space-y-0.5 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">A</span>
          <span className="font-medium text-foreground">{a}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">B</span>
          <span className="font-medium text-foreground">{b}</span>
        </div>
      </div>
    </div>
  )
}

function CompareStatRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <div className="flex items-baseline gap-4 text-sm tabular-nums">
        <span className="font-medium text-foreground">{a}</span>
        <span className="font-medium text-foreground">{b}</span>
      </div>
    </div>
  )
}
