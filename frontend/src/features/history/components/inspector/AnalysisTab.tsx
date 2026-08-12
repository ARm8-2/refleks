import { Widget } from "@/shared/components";
import type { ChartConfig } from "@/shared/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import {
  CHART_SERIES_COLORS,
  CHART_STYLE,
  chartDot,
  useI18n,
  type MessageKey,
} from "@/shared/lib";
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

// Chart series labels are catalog keys resolved at render time so they follow
// the active locale; dataKeys (the outer map keys) never translate.
type KeyedChartConfig = Record<
  string,
  { labelKey?: MessageKey; color: string }
>;

const eventsConfig: KeyedChartConfig = {
  killsOverTime: {
    labelKey: "history.analysis.chart.kills",
    color: CHART_SERIES_COLORS.scoreHistory,
  },
  accOverTime: {
    labelKey: "history.analysis.chart.accuracy",
    color: CHART_SERIES_COLORS.accuracy,
  },
};

const ttkConfig: KeyedChartConfig = {
  realTTK: {
    labelKey: "history.analysis.chart.ttk",
    color: CHART_SERIES_COLORS.ttk,
  },
  ma5: {
    labelKey: "history.analysis.chart.ma5",
    color: CHART_SERIES_COLORS.scoreHistory,
  },
};

const scatterConfig: KeyedChartConfig = {
  scatter: {
    labelKey: "history.analysis.chart.kill",
    color: CHART_SERIES_COLORS.scoreHistory,
  },
};

const eventsOverlayConfig: KeyedChartConfig = {
  killsOverTime: {
    labelKey: "history.analysis.chart.pinnedKills",
    color: CHART_SERIES_COLORS.scoreHistory,
  },
  accOverTime: {
    labelKey: "history.analysis.chart.pinnedAcc",
    color: CHART_SERIES_COLORS.accuracy,
  },
  cmpKillsOverTime: {
    labelKey: "history.analysis.chart.compareKills",
    color: CHART_SERIES_COLORS.compare,
  },
  cmpAccOverTime: {
    labelKey: "history.analysis.chart.compareAcc",
    color: CHART_SERIES_COLORS.compare,
  },
};

const ttkOverlayConfig: KeyedChartConfig = {
  realTTK: {
    labelKey: "history.analysis.chart.pinnedTtk",
    color: CHART_SERIES_COLORS.ttk,
  },
  ma5: {
    labelKey: "history.analysis.chart.pinnedMa5",
    color: CHART_SERIES_COLORS.scoreHistory,
  },
  cmpRealTTK: {
    labelKey: "history.analysis.chart.compareTtk",
    color: CHART_SERIES_COLORS.compare,
  },
  cmpMa5: {
    labelKey: "history.analysis.chart.compareMa5",
    color: CHART_SERIES_COLORS.compare,
  },
};

const scatterOverlayConfig: KeyedChartConfig = {
  pinned: {
    labelKey: "history.inspector.pinned",
    color: CHART_SERIES_COLORS.scoreHistory,
  },
  compare: {
    labelKey: "history.inspector.compare",
    color: CHART_SERIES_COLORS.compare,
  },
};

function useChartConfig(base: KeyedChartConfig): ChartConfig {
  const { t, locale } = useI18n();
  return useMemo<ChartConfig>(() => {
    const out: ChartConfig = {};
    for (const [key, entry] of Object.entries(base)) {
      const { labelKey, color } = entry;
      out[key] = { color, label: labelKey ? t(labelKey) : undefined };
    }
    return out;
    // `t` is referentially stable — the locale drives recomputation.
  }, [base, locale]);
}

export function AnalysisTab({
  primaryRun,
  compareRun,
  overlay,
}: {
  primaryRun: HistoryRun;
  compareRun: HistoryRun | null;
  overlay: boolean;
}) {
  const { t } = useI18n();
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
          {t("history.analysis.loadingEventData")}
        </p>
      </div>
    );
  }

  if (!primary || primary.events.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-subtle p-6 text-center">
        <p className="text-sm text-surface-muted-foreground">
          {t("history.analysis.noEventData")}
        </p>
      </div>
    );
  }

  if (!compareAnalysis || !compare) {
    return (
      <div className="space-y-3">
        {primaryAnalysis && <SummaryMetrics analysis={primaryAnalysis} />}
        <Widget
          title={t("history.analysis.accuracyOverTime")}
          className="bg-surface-subtle h-[22.5rem]"
          modalTitle={t("history.analysis.accuracyOverTime")}
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
              title={t("history.analysis.ttkTrend")}
              description={t("history.analysis.slopeLineWithR2", {
                slope: `${primaryAnalysis.movingAvg.slope >= 0 ? "+" : ""}${primaryAnalysis.movingAvg.slope.toFixed(4)}`,
                r2: primaryAnalysis.movingAvg.r2.toFixed(3),
              })}
              className="bg-surface-subtle h-[22.5rem]"
              modalTitle={t("history.analysis.ttkMovingAverage")}
              modalContent={<TTKChart data={primary.ttk} />}
            >
              <TTKChart data={primary.ttk} />
            </Widget>
            <Widget
              title={t("history.analysis.accuracyVsSpeed")}
              description={t("history.analysis.pearsonR", {
                r: primaryAnalysis.scatter.corrKpmAcc.toFixed(3),
              })}
              className="bg-surface-subtle h-[22.5rem]"
              modalTitle={t("history.analysis.accuracyVsSpeed")}
              modalContent={<ScatterPlot data={primary.scatter} />}
            >
              <ScatterPlot data={primary.scatter} />
            </Widget>
          </div>
        ) : (
          <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-subtle p-6 text-center">
            <p className="text-sm text-surface-muted-foreground">
              {t("history.analysis.waitingForFirstKill")}
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
          <SummaryMetrics
            analysis={primaryAnalysis}
            label={t("history.inspector.pinned")}
          />
          <SummaryMetrics
            analysis={compareAnalysis}
            label={t("history.inspector.compare")}
          />
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
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Widget
          title={t("history.analysis.accuracyOverTimePinned")}
          className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
          modalTitle={t("history.analysis.accuracyOverTimePinned")}
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
          title={t("history.analysis.accuracyOverTimeCompare")}
          className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
          modalTitle={t("history.analysis.accuracyOverTimeCompare")}
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
            title={t("history.analysis.ttkTrendPinned")}
            description={t("history.analysis.slopeLine", {
              slope: `${primaryAnalysis.movingAvg.slope >= 0 ? "+" : ""}${primaryAnalysis.movingAvg.slope.toFixed(4)}`,
            })}
            className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
            modalTitle={t("history.analysis.ttkTrendPinned")}
            modalContent={<TTKChart data={primary.ttk} />}
          >
            <TTKChart data={primary.ttk} />
          </Widget>
          <Widget
            title={t("history.analysis.ttkTrendCompare")}
            description={t("history.analysis.slopeLine", {
              slope: `${compareAnalysis.movingAvg.slope >= 0 ? "+" : ""}${compareAnalysis.movingAvg.slope.toFixed(4)}`,
            })}
            className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
            modalTitle={t("history.analysis.ttkTrendCompare")}
            modalContent={<TTKChart data={compare.ttk} />}
          >
            <TTKChart data={compare.ttk} />
          </Widget>
        </div>
      )}

      {primaryAnalysis && compareAnalysis && (
        <div className="grid gap-3 md:grid-cols-2">
          <Widget
            title={t("history.analysis.accVsSpeedPinned")}
            description={t("history.analysis.rLine", {
              r: primaryAnalysis.scatter.corrKpmAcc.toFixed(3),
            })}
            className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
            modalTitle={t("history.analysis.accuracyVsSpeedPinned")}
            modalContent={<ScatterPlot data={primary.scatter} />}
          >
            <ScatterPlot data={primary.scatter} />
          </Widget>
          <Widget
            title={t("history.analysis.accVsSpeedCompare")}
            description={t("history.analysis.rLine", {
              r: compareAnalysis.scatter.corrKpmAcc.toFixed(3),
            })}
            className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
            modalTitle={t("history.analysis.accuracyVsSpeedCompare")}
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
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <Widget
        title={t("history.analysis.accuracyOverTime")}
        className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
        modalTitle={t("history.analysis.accuracyOverTimeOverlay")}
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
            title={t("history.analysis.ttkTrend")}
            description={t("history.analysis.pinnedSlopeLine", {
              slope: `${primaryAnalysis.movingAvg.slope >= 0 ? "+" : ""}${primaryAnalysis.movingAvg.slope.toFixed(4)}`,
              compare: `${compareAnalysis.movingAvg.slope >= 0 ? "+" : ""}${compareAnalysis.movingAvg.slope.toFixed(4)}`,
            })}
            className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
            modalTitle={t("history.analysis.ttkTrendOverlay")}
            modalContent={<TTKChartOverlay data={ttkOverlay} />}
          >
            <TTKChartOverlay data={ttkOverlay} />
          </Widget>
          <Widget
            title={t("history.analysis.accuracyVsSpeed")}
            description={t("history.analysis.pinnedRLine", {
              primary: primaryAnalysis.scatter.corrKpmAcc.toFixed(3),
              compare: compareAnalysis.scatter.corrKpmAcc.toFixed(3),
            })}
            className="bg-surface-subtle hover:bg-surface-muted h-[22.5rem]"
            modalTitle={t("history.analysis.accuracyVsSpeedOverlay")}
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
  const { t } = useI18n();
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
        <MiniStat
          label={t("history.analysis.summary.kills")}
          value={String(summary.kills)}
        />
        <MiniStat
          label={t("history.analysis.summary.accuracy")}
          value={fmtPct(summary.finalAcc)}
        />
        <MiniStat
          label={t("history.analysis.summary.avgTtk")}
          value={fmtS(summary.avgTTK)}
        />
        <MiniStat
          label={t("history.analysis.summary.medianTtk")}
          value={fmtS(summary.medianTTK)}
        />
        <MiniStat
          label={t("history.analysis.summary.avgKpm")}
          value={summary.meanKPM.toFixed(1)}
        />
        <MiniStat
          label={t("history.analysis.summary.ttkSigma")}
          value={fmtS(summary.stdTTK)}
        />
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
  const config = useChartConfig(eventsConfig);
  return (
    <ChartContainer config={config} className={`aspect-auto w-full h-full`}>
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
  const config = useChartConfig(ttkConfig);
  return (
    <ChartContainer config={config} className={`aspect-auto w-full h-full`}>
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
  const config = useChartConfig(scatterConfig);
  const { t } = useI18n();
  return (
    <ChartContainer config={config} className={`aspect-auto w-full h-full`}>
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="x"
          name={t("history.analysis.chart.kpm")}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={t("history.analysis.chart.accuracyPct")}
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
              labelFormatter={() => t("history.analysis.chart.kill")}
              formatter={(value, name) => {
                if (name === "x")
                  return [
                    t("history.analysis.chart.kpmValue", {
                      value: String(value),
                    }),
                    t("history.analysis.chart.speed"),
                  ];
                if (name === "y")
                  return [`${value}%`, t("history.analysis.chart.accuracy")];
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
  const config = useChartConfig(eventsOverlayConfig);
  return (
    <ChartContainer config={config} className={`aspect-auto w-full h-full`}>
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
  const config = useChartConfig(ttkOverlayConfig);
  return (
    <ChartContainer config={config} className={`aspect-auto w-full h-full`}>
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
  const config = useChartConfig(scatterOverlayConfig);
  const { t } = useI18n();
  return (
    <ChartContainer config={config} className={`aspect-auto w-full h-full`}>
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="x"
          name={t("history.analysis.chart.kpm")}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={t("history.analysis.chart.accuracyPct")}
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
              labelFormatter={() => t("history.analysis.chart.kill")}
              formatter={(value, name) => {
                if (name === "x")
                  return [
                    t("history.analysis.chart.kpmValue", {
                      value: String(value),
                    }),
                    t("history.analysis.chart.speed"),
                  ];
                if (name === "y")
                  return [`${value}%`, t("history.analysis.chart.accuracy")];
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
      <div className="text-[0.625rem] text-surface-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}
