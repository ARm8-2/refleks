import { Widget } from '@/shared/components'
import type { ChartConfig } from '@/shared/components/ui/chart'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/components/ui/chart'
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, Scatter, ScatterChart, XAxis, YAxis } from 'recharts'
import type { HistoryRun } from '../../lib/historyModels'
import { computeScenarioAnalysis, type ScenarioAnalysis } from '../../lib/scenarioAnalysis'

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

export function AnalysisTab({ primaryRun, compareRun, overlay }: { primaryRun: HistoryRun; compareRun: HistoryRun | null; overlay: boolean }) {
  const primaryAnalysis = useMemo(() => computeScenarioAnalysis(primaryRun.item), [primaryRun])
  const compareAnalysis = useMemo(() => (compareRun ? computeScenarioAnalysis(compareRun.item) : null), [compareRun])

  if (!primaryAnalysis) {
    return (
      <div className="rounded-xl bg-surface-subtle p-4 text-sm text-surface-muted-foreground">
        Not enough event data to analyze. At least 2 kills are required.
      </div>
    )
  }

  const primary = buildChartData(primaryAnalysis)

  if (!compareAnalysis) {
    return (
      <div className="space-y-3">
        <SummaryMetrics analysis={primaryAnalysis} />
        <Widget
          title="Kills over time"
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="Kills over time"
          modalContent={<EventsChart data={primary.events} height="h-[360px]" />}
        >
          <EventsChart data={primary.events} height="h-[160px]" />
        </Widget>
        <div className="grid gap-3 lg:grid-cols-2">
          <Widget
            title="TTK trend"
            description={`Slope: ${primaryAnalysis.movingAvg.slope >= 0 ? '+' : ''}${primaryAnalysis.movingAvg.slope.toFixed(4)}s/kill · R² ${primaryAnalysis.movingAvg.r2.toFixed(3)}`}
            className="bg-surface-subtle hover:bg-surface-muted"
            modalTitle="TTK moving average"
            modalContent={<TTKChart data={primary.ttk} height="h-[360px]" />}
          >
            <TTKChart data={primary.ttk} height="h-[160px]" />
          </Widget>
          <Widget
            title="Accuracy vs speed"
            description={`Pearson r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
            className="bg-surface-subtle hover:bg-surface-muted"
            modalTitle="Accuracy vs speed"
            modalContent={<ScatterPlot data={primary.scatter} height="h-[360px]" />}
          >
            <ScatterPlot data={primary.scatter} height="h-[160px]" />
          </Widget>
        </div>
      </div>
    )
  }

  const compare = buildChartData(compareAnalysis)

  return (
    <div className="space-y-3">
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
      <div className="grid gap-3 md:grid-cols-2">
        <Widget
          title="Kills over time — Pinned"
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="Kills over time — Pinned"
          modalContent={<EventsChart data={primary.events} height="h-[360px]" />}
        >
          <EventsChart data={primary.events} height="h-[140px]" />
        </Widget>
        <Widget
          title="Kills over time — Compare"
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="Kills over time — Compare"
          modalContent={<EventsChart data={compare.events} height="h-[360px]" />}
        >
          <EventsChart data={compare.events} height="h-[140px]" />
        </Widget>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Widget
          title="TTK trend — Pinned"
          description={`Slope: ${primaryAnalysis.movingAvg.slope >= 0 ? '+' : ''}${primaryAnalysis.movingAvg.slope.toFixed(4)}s/kill`}
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="TTK trend — Pinned"
          modalContent={<TTKChart data={primary.ttk} height="h-[360px]" />}
        >
          <TTKChart data={primary.ttk} height="h-[140px]" />
        </Widget>
        <Widget
          title="TTK trend — Compare"
          description={`Slope: ${compareAnalysis.movingAvg.slope >= 0 ? '+' : ''}${compareAnalysis.movingAvg.slope.toFixed(4)}s/kill`}
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="TTK trend — Compare"
          modalContent={<TTKChart data={compare.ttk} height="h-[360px]" />}
        >
          <TTKChart data={compare.ttk} height="h-[140px]" />
        </Widget>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Widget
          title="Acc vs speed — Pinned"
          description={`r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="Accuracy vs speed — Pinned"
          modalContent={<ScatterPlot data={primary.scatter} height="h-[360px]" />}
        >
          <ScatterPlot data={primary.scatter} height="h-[140px]" />
        </Widget>
        <Widget
          title="Acc vs speed — Compare"
          description={`r: ${compareAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="Accuracy vs speed — Compare"
          modalContent={<ScatterPlot data={compare.scatter} height="h-[360px]" />}
        >
          <ScatterPlot data={compare.scatter} height="h-[140px]" />
        </Widget>
      </div>
    </div>
  )
}

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
      <Widget
        title="Kills over time"
        className="bg-surface-subtle hover:bg-surface-muted"
        modalTitle="Kills over time — Overlay"
        modalContent={<EventsChartOverlay data={eventsOverlay} height="h-[360px]" />}
      >
        <EventsChartOverlay data={eventsOverlay} height="h-[160px]" />
      </Widget>
      <div className="grid gap-3 lg:grid-cols-2">
        <Widget
          title="TTK trend"
          description={`Pinned slope: ${primaryAnalysis.movingAvg.slope >= 0 ? '+' : ''}${primaryAnalysis.movingAvg.slope.toFixed(4)} · Compare: ${compareAnalysis.movingAvg.slope >= 0 ? '+' : ''}${compareAnalysis.movingAvg.slope.toFixed(4)}`}
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="TTK trend — Overlay"
          modalContent={<TTKChartOverlay data={ttkOverlay} height="h-[360px]" />}
        >
          <TTKChartOverlay data={ttkOverlay} height="h-[160px]" />
        </Widget>
        <Widget
          title="Accuracy vs speed"
          description={`Pinned r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)} · Compare: ${compareAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
          className="bg-surface-subtle hover:bg-surface-muted"
          modalTitle="Accuracy vs speed — Overlay"
          modalContent={<ScatterPlotOverlay primary={primary.scatter} compare={compare.scatter} height="h-[360px]" />}
        >
          <ScatterPlotOverlay primary={primary.scatter} compare={compare.scatter} height="h-[160px]" />
        </Widget>
      </div>
    </div>
  )
}

function SummaryMetrics({ analysis, label }: { analysis: ScenarioAnalysis; label?: string }) {
  const { summary } = analysis
  const fmtS = (v: number) => `${v.toFixed(2)}s`
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs font-medium text-surface-muted-foreground">{label}</div>}
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
    <div className="rounded-lg bg-surface px-2.5 py-2">
      <div className="text-[10px] text-surface-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  )
}
