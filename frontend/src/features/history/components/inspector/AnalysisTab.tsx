import { Widget } from "@/shared/components";
import type { ChartConfig } from "@/shared/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import { CHART_SERIES_COLORS, CHART_STYLE, chartDot } from "@/shared/lib";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import { useRunPerformanceEvents } from "../../hooks/useRunPerformanceEvents";
import { useRunStatsEvents } from "../../hooks/useRunStatsEvents";
import {
  buildAnalysisChartData,
  type AnalysisChartData,
  type EventsChartPoint,
} from "../../lib/analysisChart";
import type { HistoryRun } from "../../lib/historyModels";
import {
  computeScenarioAnalysis,
  type ScenarioAnalysis,
} from "../../lib/scenarioAnalysis";

function fmtTimeTick(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTooltipTime(
  _: unknown,
  payload?: Array<{ payload?: { timeSec?: number } }>,
): string {
  return fmtTimeTick(Number(payload?.[0]?.payload?.timeSec ?? 0));
}

const eventsConfig: ChartConfig = {
  killsOverTime: { label: "Kills", color: CHART_SERIES_COLORS.scoreHistory },
  accOverTime: { label: "Accuracy", color: CHART_SERIES_COLORS.accuracy },
};

const ttkConfig: ChartConfig = {
  realTTK: { label: "TTK (s)", color: CHART_SERIES_COLORS.ttk },
  ma5: { label: "MA(5)", color: CHART_SERIES_COLORS.scoreHistory },
};

const scatterConfig: ChartConfig = {
  scatter: { label: "Kill", color: CHART_SERIES_COLORS.scoreHistory },
};

const eventsOverlayConfig: ChartConfig = {
  killsOverTime: {
    label: "Pinned Kills",
    color: CHART_SERIES_COLORS.scoreHistory,
  },
  accOverTime: { label: "Pinned Acc", color: CHART_SERIES_COLORS.accuracy },
  cmpKillsOverTime: {
    label: "Compare Kills",
    color: CHART_SERIES_COLORS.compare,
  },
  cmpAccOverTime: { label: "Compare Acc", color: CHART_SERIES_COLORS.compare },
};

const ttkOverlayConfig: ChartConfig = {
  realTTK: { label: "Pinned TTK", color: CHART_SERIES_COLORS.ttk },
  ma5: { label: "Pinned MA(5)", color: CHART_SERIES_COLORS.scoreHistory },
  cmpRealTTK: { label: "Compare TTK", color: CHART_SERIES_COLORS.compare },
  cmpMa5: { label: "Compare MA(5)", color: CHART_SERIES_COLORS.compare },
};

const scatterOverlayConfig: ChartConfig = {
  pinned: { label: "Pinned", color: CHART_SERIES_COLORS.scoreHistory },
  compare: { label: "Compare", color: CHART_SERIES_COLORS.compare },
};

export function AnalysisTab({
  primaryRun,
  compareRun,
  overlay,
}: {
  primaryRun: HistoryRun;
  compareRun: HistoryRun | null;
  overlay: boolean;
}) {
  const primaryEvents = useRunStatsEvents(primaryRun);
  const compareEvents = useRunStatsEvents(compareRun);
  const primaryPerformanceEvents = useRunPerformanceEvents(primaryRun);
  const comparePerformanceEvents = useRunPerformanceEvents(compareRun);

  const primaryAnalysis = useMemo(
    () =>
      primaryEvents
        ? computeScenarioAnalysis(primaryRun.item.stats.summary, primaryEvents)
        : null,
    [primaryRun.item.stats.summary, primaryEvents],
  );
  const compareAnalysis = useMemo(
    () =>
      compareRun && compareEvents
        ? computeScenarioAnalysis(compareRun.item.stats.summary, compareEvents)
        : null,
    [compareRun?.item.stats.summary, compareEvents],
  );

  const primary = useMemo(
    () =>
      primaryEvents && primaryPerformanceEvents
        ? buildAnalysisChartData(
            primaryAnalysis,
            primaryRun.item.stats.summary,
            primaryEvents,
            primaryPerformanceEvents,
            primaryRun.item.performances?.header?.challengeProfile?.timeLimit ??
              0,
          )
        : null,
    [
      primaryAnalysis,
      primaryRun.item.stats.summary,
      primaryEvents,
      primaryPerformanceEvents,
      primaryRun.item.performances,
    ],
  );
  const compare = useMemo(
    () =>
      compareRun && compareEvents && comparePerformanceEvents
        ? buildAnalysisChartData(
            compareAnalysis,
            compareRun.item.stats.summary,
            compareEvents,
            comparePerformanceEvents,
            compareRun.item.performances?.header?.challengeProfile?.timeLimit ??
              0,
          )
        : null,
    [compareAnalysis, compareEvents, comparePerformanceEvents, compareRun],
  );

  if (
    primaryEvents === null ||
    primaryPerformanceEvents === null ||
    (compareRun &&
      (compareEvents === null || comparePerformanceEvents === null))
  ) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-subtle p-6 text-center">
        <p className="text-sm text-surface-muted-foreground">
          Loading event data...
        </p>
      </div>
    );
  }

  if (!primary || primary.events.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-subtle p-6 text-center">
        <p className="text-sm text-surface-muted-foreground">
          No event data available for this run. Ensure Kovaak's is saving event
          details in the stats CSV.
        </p>
      </div>
    );
  }

  if (!compareAnalysis || !compare) {
    return (
      <div className="space-y-3">
        {primaryAnalysis && <SummaryMetrics analysis={primaryAnalysis} />}
        <Widget
          title="Accuracy over time"
          className="bg-surface-subtle h-[360px]"
          modalTitle="Accuracy over time"
          modalContent={
            <EventsChart
              data={primary.events}
              domainMax={primary.eventsDomainMax}
            />
          }
        >
          <EventsChart
            data={primary.events}
            domainMax={primary.eventsDomainMax}
          />
        </Widget>
        {primaryAnalysis ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <Widget
              title="TTK trend"
              description={`Slope: ${primaryAnalysis.movingAvg.slope >= 0 ? "+" : ""}${primaryAnalysis.movingAvg.slope.toFixed(4)}s/kill · R² ${primaryAnalysis.movingAvg.r2.toFixed(3)}`}
              className="bg-surface-subtle h-[360px]"
              modalTitle="TTK moving average"
              modalContent={<TTKChart data={primary.ttk} />}
            >
              <TTKChart data={primary.ttk} />
            </Widget>
            <Widget
              title="Accuracy vs speed"
              description={`Pearson r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
              className="bg-surface-subtle h-[360px]"
              modalTitle="Accuracy vs speed"
              modalContent={<ScatterPlot data={primary.scatter} />}
            >
              <ScatterPlot data={primary.scatter} />
            </Widget>
          </div>
        ) : (
          <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-subtle p-6 text-center">
            <p className="text-sm text-surface-muted-foreground">
              Waiting for the first kill to compute TTK trend, accuracy vs
              speed, and summary stats.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {primaryAnalysis && compareAnalysis && (
        <div className="grid gap-3 md:grid-cols-2">
          <SummaryMetrics analysis={primaryAnalysis} label="Pinned" />
          <SummaryMetrics analysis={compareAnalysis} label="Compare" />
        </div>
      )}

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
  );
}

function SplitCharts({
  primary,
  compare,
  primaryAnalysis,
  compareAnalysis,
}: {
  primary: AnalysisChartData;
  compare: AnalysisChartData;
  primaryAnalysis: ScenarioAnalysis | null;
  compareAnalysis: ScenarioAnalysis | null;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Widget
          title="Accuracy over time — Pinned"
          className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
          modalTitle="Accuracy over time — Pinned"
          modalContent={
            <EventsChart
              data={primary.events}
              domainMax={primary.eventsDomainMax}
            />
          }
        >
          <EventsChart
            data={primary.events}
            domainMax={primary.eventsDomainMax}
          />
        </Widget>
        <Widget
          title="Accuracy over time — Compare"
          className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
          modalTitle="Accuracy over time — Compare"
          modalContent={
            <EventsChart
              data={compare.events}
              domainMax={compare.eventsDomainMax}
            />
          }
        >
          <EventsChart
            data={compare.events}
            domainMax={compare.eventsDomainMax}
          />
        </Widget>
      </div>

      {primaryAnalysis && compareAnalysis && (
        <div className="grid gap-3 md:grid-cols-2">
          <Widget
            title="TTK trend — Pinned"
            description={`Slope: ${primaryAnalysis.movingAvg.slope >= 0 ? "+" : ""}${primaryAnalysis.movingAvg.slope.toFixed(4)}s/kill`}
            className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
            modalTitle="TTK trend — Pinned"
            modalContent={<TTKChart data={primary.ttk} />}
          >
            <TTKChart data={primary.ttk} />
          </Widget>
          <Widget
            title="TTK trend — Compare"
            description={`Slope: ${compareAnalysis.movingAvg.slope >= 0 ? "+" : ""}${compareAnalysis.movingAvg.slope.toFixed(4)}s/kill`}
            className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
            modalTitle="TTK trend — Compare"
            modalContent={<TTKChart data={compare.ttk} />}
          >
            <TTKChart data={compare.ttk} />
          </Widget>
        </div>
      )}

      {primaryAnalysis && compareAnalysis && (
        <div className="grid gap-3 md:grid-cols-2">
          <Widget
            title="Acc vs speed — Pinned"
            description={`r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
            className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
            modalTitle="Accuracy vs speed — Pinned"
            modalContent={<ScatterPlot data={primary.scatter} />}
          >
            <ScatterPlot data={primary.scatter} />
          </Widget>
          <Widget
            title="Acc vs speed — Compare"
            description={`r: ${compareAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
            className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
            modalTitle="Accuracy vs speed — Compare"
            modalContent={<ScatterPlot data={compare.scatter} />}
          >
            <ScatterPlot data={compare.scatter} />
          </Widget>
        </div>
      )}
    </div>
  );
}

function mergeByTime(
  a: Array<Record<string, unknown>>,
  b: Array<Record<string, unknown>>,
  prefix: string,
  valueKeys: string[],
): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  for (const row of a) {
    const merged: Record<string, unknown> = { timeSec: row.timeSec };
    for (const key of valueKeys) merged[key] = row[key];
    rows.push(merged);
  }

  for (const row of b) {
    const merged: Record<string, unknown> = { timeSec: row.timeSec };
    for (const key of valueKeys)
      merged[`${prefix}${key[0].toUpperCase()}${key.slice(1)}`] = row[key];
    rows.push(merged);
  }

  rows.sort(
    (left, right) => (left.timeSec as number) - (right.timeSec as number),
  );
  return rows;
}

function OverlayCharts({
  primary,
  compare,
  primaryAnalysis,
  compareAnalysis,
}: {
  primary: AnalysisChartData;
  compare: AnalysisChartData;
  primaryAnalysis: ScenarioAnalysis | null;
  compareAnalysis: ScenarioAnalysis | null;
}) {
  const eventsOverlay = useMemo(
    () =>
      mergeByTime(primary.events, compare.events, "cmp", [
        "killsOverTime",
        "accOverTime",
      ]),
    [primary.events, compare.events],
  );
  const ttkOverlay = useMemo(
    () => mergeByTime(primary.ttk, compare.ttk, "cmp", ["realTTK", "ma5"]),
    [primary.ttk, compare.ttk],
  );
  const eventsDomainMax = Math.max(
    primary.eventsDomainMax,
    compare.eventsDomainMax,
  );

  return (
    <div className="space-y-3">
      <Widget
        title="Accuracy over time"
        className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
        modalTitle="Accuracy over time — Overlay"
        modalContent={
          <EventsChartOverlay
            data={eventsOverlay}
            domainMax={eventsDomainMax}
          />
        }
      >
        <EventsChartOverlay data={eventsOverlay} domainMax={eventsDomainMax} />
      </Widget>
      {primaryAnalysis && compareAnalysis && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Widget
            title="TTK trend"
            description={`Pinned slope: ${primaryAnalysis.movingAvg.slope >= 0 ? "+" : ""}${primaryAnalysis.movingAvg.slope.toFixed(4)} · Compare: ${compareAnalysis.movingAvg.slope >= 0 ? "+" : ""}${compareAnalysis.movingAvg.slope.toFixed(4)}`}
            className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
            modalTitle="TTK trend — Overlay"
            modalContent={<TTKChartOverlay data={ttkOverlay} />}
          >
            <TTKChartOverlay data={ttkOverlay} />
          </Widget>
          <Widget
            title="Accuracy vs speed"
            description={`Pinned r: ${primaryAnalysis.scatter.corrKpmAcc.toFixed(3)} · Compare: ${compareAnalysis.scatter.corrKpmAcc.toFixed(3)}`}
            className="bg-surface-subtle hover:bg-surface-muted h-[360px]"
            modalTitle="Accuracy vs speed — Overlay"
            modalContent={
              <ScatterPlotOverlay
                primary={primary.scatter}
                compare={compare.scatter}
              />
            }
          >
            <ScatterPlotOverlay
              primary={primary.scatter}
              compare={compare.scatter}
            />
          </Widget>
        </div>
      )}
    </div>
  );
}

function SummaryMetrics({
  analysis,
  label,
}: {
  analysis: ScenarioAnalysis;
  label?: string;
}) {
  const { summary } = analysis;
  const fmtS = (value: number) => `${value.toFixed(2)}s`;
  const fmtPct = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="text-xs font-medium text-surface-muted-foreground">
          {label}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Kills" value={String(summary.kills)} />
        <MiniStat label="Accuracy" value={fmtPct(summary.finalAcc)} />
        <MiniStat label="Avg TTK" value={fmtS(summary.avgTTK)} />
        <MiniStat label="Median TTK" value={fmtS(summary.medianTTK)} />
        <MiniStat label="Avg KPM" value={summary.meanKPM.toFixed(1)} />
        <MiniStat label="TTK σ" value={fmtS(summary.stdTTK)} />
      </div>
    </div>
  );
}

function EventsChart({
  data,
  domainMax,
}: {
  data: EventsChartPoint[];
  domainMax: number;
}) {
  return (
    <ChartContainer
      config={eventsConfig}
      className={`aspect-auto w-full h-full`}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          type="number"
          dataKey="timeSec"
          domain={[0, domainMax]}
          allowDataOverflow
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickMargin={8}
          tickFormatter={fmtTimeTick}
        />
        <YAxis
          yAxisId="kills"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={40}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="acc"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={formatTooltipTime} />}
        />
        <Line
          yAxisId="kills"
          isAnimationActive={false}
          type="stepAfter"
          dataKey="killsOverTime"
          stroke="var(--color-killsOverTime)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="acc"
          isAnimationActive={false}
          type="monotone"
          dataKey="accOverTime"
          stroke="var(--color-accOverTime)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

function TTKChart({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <ChartContainer config={ttkConfig} className={`aspect-auto w-full h-full`}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          type="number"
          dataKey="timeSec"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickMargin={8}
          tickFormatter={fmtTimeTick}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          tickFormatter={(value) => `${value}s`}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={formatTooltipTime} />}
        />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="realTTK"
          stroke="var(--color-realTTK)"
          strokeWidth={CHART_STYLE.lineSecondaryWidth}
          dot={chartDot("var(--color-realTTK)", CHART_STYLE.pointRadiusSmall)}
        />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="ma5"
          stroke="var(--color-ma5)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

function ScatterPlot({ data }: { data: Array<{ x: number; y: number }> }) {
  return (
    <ChartContainer
      config={scatterConfig}
      className={`aspect-auto w-full h-full`}
    >
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="x"
          name="KPM"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Accuracy %"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={() => "Kill"}
              formatter={(value, name) => {
                if (name === "x") return [`${value} KPM`, "Speed"];
                if (name === "y") return [`${value}%`, "Accuracy"];
                return [String(value), String(name)];
              }}
            />
          }
        />
        <Scatter
          data={data}
          fill="var(--color-scatter)"
          r={CHART_STYLE.scatterPointRadius}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ChartContainer>
  );
}

function EventsChartOverlay({
  data,
  domainMax,
}: {
  data: Array<Record<string, unknown>>;
  domainMax: number;
}) {
  return (
    <ChartContainer
      config={eventsOverlayConfig}
      className={`aspect-auto w-full h-full`}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          type="number"
          dataKey="timeSec"
          domain={[0, domainMax]}
          allowDataOverflow
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickMargin={8}
          tickFormatter={fmtTimeTick}
        />
        <YAxis
          yAxisId="kills"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={40}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="acc"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={formatTooltipTime} />}
        />
        <Line
          yAxisId="kills"
          isAnimationActive={false}
          type="stepAfter"
          dataKey="killsOverTime"
          stroke="var(--color-killsOverTime)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="acc"
          isAnimationActive={false}
          type="monotone"
          dataKey="accOverTime"
          stroke="var(--color-accOverTime)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="kills"
          isAnimationActive={false}
          type="stepAfter"
          dataKey="cmpKillsOverTime"
          stroke="var(--color-cmpKillsOverTime)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
          opacity={0.7}
          connectNulls
        />
        <Line
          yAxisId="acc"
          isAnimationActive={false}
          type="monotone"
          dataKey="cmpAccOverTime"
          stroke="var(--color-cmpAccOverTime)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
          opacity={0.7}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

function TTKChartOverlay({ data }: { data: Array<Record<string, unknown>> }) {
  return (
    <ChartContainer
      config={ttkOverlayConfig}
      className={`aspect-auto w-full h-full`}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          type="number"
          dataKey="timeSec"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickMargin={8}
          tickFormatter={fmtTimeTick}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          tickFormatter={(value) => `${value}s`}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={formatTooltipTime} />}
        />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="realTTK"
          stroke="var(--color-realTTK)"
          strokeWidth={CHART_STYLE.lineSecondaryWidth}
          dot={chartDot("var(--color-realTTK)", CHART_STYLE.pointRadiusSmall)}
          connectNulls
        />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="ma5"
          stroke="var(--color-ma5)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
          connectNulls
        />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="cmpRealTTK"
          stroke="var(--color-cmpRealTTK)"
          strokeWidth={CHART_STYLE.lineSecondaryWidth}
          dot={chartDot(
            "var(--color-cmpRealTTK)",
            CHART_STYLE.pointRadiusSmall,
          )}
          opacity={0.7}
          connectNulls
        />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="cmpMa5"
          stroke="var(--color-cmpMa5)"
          strokeWidth={CHART_STYLE.linePrimaryWidth}
          dot={false}
          opacity={0.7}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

function ScatterPlotOverlay({
  primary,
  compare,
}: {
  primary: Array<{ x: number; y: number }>;
  compare: Array<{ x: number; y: number }>;
}) {
  return (
    <ChartContainer
      config={scatterOverlayConfig}
      className={`aspect-auto w-full h-full`}
    >
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="x"
          name="KPM"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Accuracy %"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={44}
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={() => "Kill"}
              formatter={(value, name) => {
                if (name === "x") return [`${value} KPM`, "Speed"];
                if (name === "y") return [`${value}%`, "Accuracy"];
                return [String(value), String(name)];
              }}
            />
          }
        />
        <Scatter
          name="pinned"
          data={primary}
          fill="var(--color-pinned)"
          r={CHART_STYLE.scatterPointRadius}
          isAnimationActive={false}
        />
        <Scatter
          name="compare"
          data={compare}
          fill="var(--color-compare)"
          r={CHART_STYLE.scatterPointRadius}
          isAnimationActive={false}
          opacity={0.7}
        />
      </ScatterChart>
    </ChartContainer>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-2.5 py-2">
      <div className="text-[10px] text-surface-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}
