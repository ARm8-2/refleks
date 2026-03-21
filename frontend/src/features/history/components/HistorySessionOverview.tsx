import { Input, Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { cn } from '@/shared/lib'
import type { Session } from '@/shared/types'
import { ChevronDown, ChevronUp, Clock3, Gamepad2, Layers3, Minus, Search, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { HistoryRun, ScenarioSummary, ScenarioTrendPoint } from '../lib/historyModels'
import {
  buildSessionScenarioSummaries,
  buildSessionScenarioTrendPoints,
  formatDurationLabel,
  formatNumber,
  formatScore,
  formatSessionDateRange,
  formatSessionTitle,
  readSessionActivePlaytimeMs,
  readSessionDurationMs,
  readUniqueScenarioCount
} from '../lib/historyModels'

type Props = {
  session: Session | null
  sessions: Session[]
  sessionRuns: HistoryRun[]
  selectedScenario: string | null
  onSelectScenario: (name: string | null) => void
  onSelectRun: (runId: string) => void
  globalPbByScenario: Map<string, HistoryRun>
}

export function HistorySessionOverview({ session, sessions, sessionRuns, selectedScenario, onSelectScenario, onSelectRun, globalPbByScenario }: Props) {
  const [scenarioGridExpanded, setScenarioGridExpanded] = useState(false)
  const [scenarioQuery, setScenarioQuery] = useState('')

  const scenarioSummaries = useMemo(
    () => (session ? buildSessionScenarioSummaries(session, sessions) : []),
    [session, sessions],
  )

  const filteredSummaries = useMemo(() => {
    const q = scenarioQuery.trim().toLowerCase()
    if (!q) return scenarioSummaries
    return scenarioSummaries.filter(s => s.name.toLowerCase().includes(q))
  }, [scenarioSummaries, scenarioQuery])

  const displayedSummaries = scenarioGridExpanded ? filteredSummaries : filteredSummaries.slice(0, 3)

  const trendPoints = useMemo(
    () => (selectedScenario ? buildSessionScenarioTrendPoints(selectedScenario, sessionRuns) : []),
    [selectedScenario, sessionRuns],
  )

  const selectedSummary = selectedScenario ? scenarioSummaries.find(s => s.name === selectedScenario) : null

  if (!session) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center rounded-xl bg-card p-5">
        <p className="text-sm text-muted-foreground">Select a session</p>
      </section>
    )
  }

  const notes = session.notes?.trim()

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-card">
      <div className="px-5 pt-5 pb-1">
        <div className="font-medium text-foreground">{formatSessionTitle(session)}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{formatSessionDateRange(session)}</div>
      </div>

      <div className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCell icon={<Layers3 className="h-4 w-4" />} label="Runs" value={String(session.items.length)} sub={`${readUniqueScenarioCount(session)} scenarios`} />
          <MetricCell icon={<Clock3 className="h-4 w-4" />} label="Length" value={formatDurationLabel(readSessionDurationMs(session))} />
          <MetricCell icon={<Gamepad2 className="h-4 w-4" />} label="Playtime" value={formatDurationLabel(readSessionActivePlaytimeMs(session))} />
        </div>

        {notes && (
          <div className="mt-4 rounded-xl bg-secondary px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm text-foreground">{notes}</p>
          </div>
        )}

        {/* Scenario grid */}
        {scenarioSummaries.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setScenarioGridExpanded(v => !v)}
              className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {scenarioGridExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Scenarios ({scenarioSummaries.length})
            </button>

            {scenarioGridExpanded && scenarioSummaries.length > 3 && (
              <div className="relative mt-2 w-full max-w-sm">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={scenarioQuery}
                  onChange={e => setScenarioQuery(e.target.value)}
                  placeholder="Search scenarios..."
                  className="h-9 pl-8"
                />
              </div>
            )}

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {displayedSummaries.map(summary => (
                <ScenarioCard
                  key={summary.name}
                  summary={summary}
                  selected={selectedScenario === summary.name}
                  onSelect={() => onSelectScenario(selectedScenario === summary.name ? null : summary.name)}
                />
              ))}
            </div>

            {!scenarioGridExpanded && filteredSummaries.length > 3 && (
              <button
                type="button"
                onClick={() => setScenarioGridExpanded(true)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                +{filteredSummaries.length - 3} more
              </button>
            )}
          </div>
        )}

        {/* Scenario trend: metrics + chart */}
        {selectedScenario && selectedSummary && trendPoints.length > 0 && (() => {
          const pb = globalPbByScenario.get(selectedScenario)
          return (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <SmallMetric label="Session best" value={formatScore(selectedSummary.bestScore)} />
                <SmallMetric label="Latest" value={formatScore(trendPoints[trendPoints.length - 1].score)} />
                {pb ? (
                  <button
                    type="button"
                    onClick={() => onSelectRun(pb.id)}
                    className="rounded-xl bg-secondary px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    title="Inspect personal best"
                  >
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Trophy className="h-3 w-3 text-amber-500" />
                      All-time PB
                    </div>
                    <div className="text-lg font-semibold text-foreground">{formatScore(pb.score)}</div>
                  </button>
                ) : (
                  <SmallMetric label="Runs" value={formatNumber(trendPoints.length, 0)} />
                )}
              </div>

              <ScenarioTrendChart
                scenarioName={selectedScenario}
                points={trendPoints}
                onClickPoint={runId => onSelectRun(runId)}
              />
            </div>
          )
        })()}
      </div>
    </section>
  )
}

function MetricCell({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  )
}

function ScenarioCard({ summary, selected, onSelect }: { summary: ScenarioSummary; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-accent shadow-sm' : 'bg-secondary hover:bg-accent',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{summary.name}</div>
        <div className="text-xs text-muted-foreground">
          {formatScore(summary.bestScore)} · {summary.count} {summary.count === 1 ? 'run' : 'runs'}
        </div>
      </div>
      {summary.trend === 'up' && <TrendingUp className="h-4 w-4 shrink-0 text-green-500" />}
      {summary.trend === 'down' && <TrendingDown className="h-4 w-4 shrink-0 text-red-500" />}
      {summary.trend === 'same' && <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </button>
  )
}

const dualChartConfig: ChartConfig = {
  score: { label: 'Score', color: 'var(--chart-2)' },
  accuracy: { label: 'Accuracy %', color: 'var(--chart-4)' },
}

function ScenarioTrendChart({
  scenarioName,
  points,
  onClickPoint,
}: {
  scenarioName: string
  points: ScenarioTrendPoint[]
  onClickPoint: (runId: string) => void
}) {
  const chartId = useId().replace(/:/g, '')
  const hasAccuracy = points.some(p => p.accuracy != null && p.accuracy > 0)
  const scoreDomain = useMemo(() => buildScoreDomain(points.map(point => point.score)), [points])

  const handleChartClick = (state: { activeTooltipIndex?: number } | null) => {
    if (!state || state.activeTooltipIndex == null) return
    const point = points[state.activeTooltipIndex]
    if (point?.runId) onClickPoint(point.runId)
  }

  const chart = (expanded: boolean) => {
    const chartHeight = expanded ? 'h-[320px]' : 'h-[200px]'

    return (
      <ChartContainer config={dualChartConfig} className={`aspect-auto w-full ${chartHeight}`}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: 6, bottom: 0 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
          <YAxis
            yAxisId="score"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={56}
            tickFormatter={v => formatNumber(v, 0)}
            domain={scoreDomain}
          />
          {hasAccuracy && (
            <YAxis
              yAxisId="accuracy"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={44}
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
            />
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? null}
              />
            }
          />
          <Line
            yAxisId="score"
            isAnimationActive={false}
            type="monotone"
            dataKey="score"
            stroke="var(--color-score)"
            strokeWidth={2.25}
            dot={{ r: expanded ? 2.75 : 2, fill: 'var(--color-score)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          {hasAccuracy && (
            <Line
              yAxisId="accuracy"
              isAnimationActive={false}
              type="monotone"
              dataKey="accuracy"
              stroke="var(--color-accuracy)"
              strokeWidth={1.75}
              strokeDasharray="4 3"
              dot={{ r: expanded ? 2 : 1.5, fill: 'var(--color-accuracy)', strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ChartContainer>
    )
  }

  return (
    <Widget
      title={scenarioName}
      className="bg-secondary hover:bg-muted"
      modalTitle={`${scenarioName} — Trend`}
      modalContent={chart(true)}
    >
      {chart(false)}
    </Widget>
  )
}

function buildScoreDomain(scores: number[]): [number, number] {
  const values = scores.filter(value => Number.isFinite(value) && value > 0)
  if (values.length === 0) return [0, 1]

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    const pad = Math.max(1, Math.round(max * 0.04))
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]
  }

  const span = max - min
  const pad = Math.max(1, Math.round(span * 0.18))
  const lower = Math.max(0, Math.floor(min - pad))
  const upper = Math.ceil(max + pad)
  return upper > lower ? [lower, upper] : [Math.max(0, lower - 1), lower + 1]
}
