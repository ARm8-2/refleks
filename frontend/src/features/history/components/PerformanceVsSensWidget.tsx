import { formatNumber } from "@/features/benchmarks/lib/detailFormatting";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Widget,
} from "@/shared/components";
import type { ChartConfig } from "@/shared/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import { usePersistedState, useStore } from "@/shared/hooks";
import {
  CHART_SERIES_COLORS,
  CHART_STYLE,
  STORAGE_KEYS,
  getScenarioName,
  readRunAccuracy,
  readRunScore,
  readRunTimestamp,
} from "@/shared/lib";
import type { RunRecord, Session } from "@/shared/types";
import { useMemo } from "react";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts";

type MetricKey = "score" | "accuracy" | "ttk";
type DataScopeKey = "session" | "all";

type SensitivityPoint = {
  x: number;
  performance: number;
  rawSensitivity: number;
  runLabel: string;
};

type PerformanceVsSensWidgetProps = {
  sessions?: Session[];
  scenarioName?: string | null;
  title?: string;
  description?: string;
  className?: string;
  allowScopeSelection?: boolean;
};

const metricOptions: Array<{ value: MetricKey; label: string }> = [
  { value: "score", label: "Score" },
  { value: "accuracy", label: "Accuracy (%)" },
  { value: "ttk", label: "Real Avg TTK (s)" },
];

const metricColors: Record<MetricKey, string> = {
  score: CHART_SERIES_COLORS.scoreHistory,
  accuracy: CHART_SERIES_COLORS.accuracy,
  ttk: CHART_SERIES_COLORS.ttk,
};

const scopeOptions: Array<{ value: DataScopeKey; label: string }> = [
  { value: "session", label: "This Session" },
  { value: "all", label: "All History" },
];

const DEFAULT_METRIC: MetricKey = "score";
const DEFAULT_SCOPE: DataScopeKey = "all";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function PerformanceVsSensWidget({
  sessions,
  scenarioName,
  title = "Performance vs Sensitivity",
  description,
  className,
  allowScopeSelection = false,
}: PerformanceVsSensWidgetProps) {
  const storeSessions = useStore((state) => state.sessions);
  const currentSession = storeSessions[0] ?? null;
  const [storedMetric, setStoredMetric] = usePersistedState<MetricKey>(
    STORAGE_KEYS.performanceVsSensMetric,
    DEFAULT_METRIC,
  );
  const [storedScope, setStoredScope] = usePersistedState<DataScopeKey>(
    STORAGE_KEYS.performanceVsSensScope,
    DEFAULT_SCOPE,
  );

  const metric = isMetricKey(storedMetric) ? storedMetric : DEFAULT_METRIC;
  const scope = isDataScopeKey(storedScope) ? storedScope : DEFAULT_SCOPE;

  const showScopeSelector = allowScopeSelection && sessions === undefined;
  const sourceSessions =
    sessions ??
    (showScopeSelector && scope === "session"
      ? currentSession
        ? [currentSession]
        : []
      : storeSessions);

  const chartData = useMemo(
    () => buildChartData(sourceSessions, scenarioName ?? null, metric),
    [metric, scenarioName, sourceSessions],
  );
  const metricLabel =
    metricOptions.find((option) => option.value === metric)?.label ??
    "Performance";
  const scopeLabel = sessions
    ? "This Session"
    : ((showScopeSelector
        ? scopeOptions.find((option) => option.value === scope)?.label
        : "All History") ?? "All History");
  const headerActions = (
    <div className="flex items-center gap-2">
      {showScopeSelector && (
        <Select
          value={scope}
          onValueChange={(value) =>
            setStoredScope(isDataScopeKey(value) ? value : DEFAULT_SCOPE)
          }
        >
          <SelectTrigger className="h-7 w-auto min-w-0 max-w-[11.25rem] px-2 text-xs bg-surface-subtle">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            {scopeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={metric}
        onValueChange={(value) =>
          setStoredMetric(isMetricKey(value) ? value : DEFAULT_METRIC)
        }
      >
        <SelectTrigger className="h-7 w-auto min-w-0 max-w-[11.25rem] px-2 text-xs bg-surface-subtle">
          <SelectValue placeholder="Metric" />
        </SelectTrigger>
        <SelectContent>
          {metricOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (!chartData.scenarioName) {
    return (
      <Widget
        title={title}
        description={
          description ??
          "Play a scenario to compare sensitivity against performance."
        }
        headerAction={headerActions}
        className={className}
      >
        <EmptyState message="No recent scenario found yet. Play a run with cm/360 data to populate this widget." />
      </Widget>
    );
  }

  if (chartData.points.length === 0) {
    return (
      <Widget
        title={title}
        description={
          description ??
          `${chartData.scenarioName} · ${metricLabel} · ${scopeLabel}`
        }
        headerAction={headerActions}
        className={className}
      >
        <EmptyState
          message={`No usable sensitivity data found for ${chartData.scenarioName}.`}
        />
      </Widget>
    );
  }

  const modalTitle = `${chartData.scenarioName} · ${title}`;

  return (
    <Widget
      title={title}
      description={
        description ??
        `${chartData.scenarioName} · ${chartData.points.length} runs · ${metricLabel} · ${scopeLabel}`
      }
      headerAction={headerActions}
      modalTitle={modalTitle}
      modalControls={headerActions}
      modalContent={
        <PerformanceVsSensChartContent
          data={chartData}
          metric={metric}
          metricLabel={metricLabel}
        />
      }
      className={className}
    >
      <PerformanceVsSensChartContent
        data={chartData}
        metric={metric}
        metricLabel={metricLabel}
      />
    </Widget>
  );
}

function PerformanceVsSensChartContent({
  data,
  metric,
  metricLabel,
}: {
  data: ReturnType<typeof buildChartData>;
  metric: MetricKey;
  metricLabel: string;
}) {
  const chartConfig: ChartConfig = {
    performance: {
      label: metricLabel,
      color: metricColors[metric],
    },
  };

  return (
    <div className="h-full w-full">
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-full w-full"
      >
        <ScatterChart margin={{ top: 12, right: 12, left: 6, bottom: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={data.xDomain}
            tickFormatter={(value) => formatNumber(value, 1)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={56}
            domain={data.yDomain}
            tickFormatter={(value) => formatMetricTick(value, metric)}
          />

          <ChartTooltip
            shared={false}
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as
                    SensitivityPoint | undefined;
                  return point?.runLabel ?? null;
                }}
                formatter={(value, _name, item) => {
                  const point = item?.payload as SensitivityPoint | undefined;
                  // Only show formatter for the performance dataKey, not for x-axis
                  if (!point || item.dataKey !== "performance") return null;

                  return (
                    <div className="grid gap-0.5 text-popover-foreground/75">
                      <div>
                        Sensitivity:{" "}
                        <span className="font-medium text-popover-foreground">
                          {formatNumber(point.rawSensitivity, 2)} cm/360
                        </span>
                      </div>
                      <div>
                        {metricLabel}:{" "}
                        <span className="font-medium text-popover-foreground">
                          {formatMetricValue(Number(value), metric)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
            }
          />

          <Scatter
            name="performance"
            data={data.points}
            dataKey="performance"
            fill="var(--color-performance)"
            stroke="var(--color-performance)"
            isAnimationActive={false}
            r={CHART_STYLE.scatterPointRadius}
          />
        </ScatterChart>
      </ChartContainer>
    </div>
  );
}

function buildChartData(
  sessions: Session[],
  scenarioName: string | null,
  metric: MetricKey,
) {
  let resolvedScenarioName = scenarioName?.trim() || null;

  if (!resolvedScenarioName) {
    for (const session of sessions) {
      for (const item of session.items) {
        const name = getScenarioName(item).trim();
        if (!name) continue;
        resolvedScenarioName = name;
        break;
      }

      if (resolvedScenarioName) break;
    }
  }

  if (!resolvedScenarioName) {
    return {
      scenarioName: null as string | null,
      points: [] as SensitivityPoint[],
      xDomain: [0, 1] as [number, number],
      yDomain: [0, 1] as [number, number],
    };
  }

  const points: SensitivityPoint[] = [];
  let runIndex = 0;

  for (const session of sessions) {
    for (const item of session.items) {
      if (getScenarioName(item).trim() !== resolvedScenarioName) continue;

      const rawSensitivity = Number(item.stats?.summary.cm360 ?? 0);
      if (!Number.isFinite(rawSensitivity) || rawSensitivity <= 0) continue;

      const performance = readMetricValue(item, metric);
      if (performance === null) continue;

      const timestamp = readTimestamp(item);
      runIndex += 1;

      points.push({
        x: rawSensitivity,
        performance,
        rawSensitivity,
        runLabel: formatRunLabel(timestamp, runIndex),
      });
    }
  }

  if (points.length === 0) {
    return {
      scenarioName: resolvedScenarioName,
      points: [] as SensitivityPoint[],
      xDomain: [0, 1] as [number, number],
      yDomain: [0, 1] as [number, number],
    };
  }

  const xDomain = buildNumericDomain(
    points.map((point) => point.x),
    0.08,
    0.5,
  );
  const yDomain = buildNumericDomain(
    points.map((point) => point.performance),
    0.12,
    metric === "ttk" ? 0.03 : 1,
  );

  return {
    scenarioName: resolvedScenarioName,
    points,
    xDomain,
    yDomain,
  };
}

function readMetricValue(item: RunRecord, metric: MetricKey): number | null {
  if (metric === "score") {
    return readRunScore(item);
  }

  if (metric === "accuracy") {
    const accuracy = readRunAccuracy(item);
    return accuracy !== null && Number.isFinite(accuracy) ? accuracy : null;
  }

  const ttk = Number(item.stats?.summary.realAvgTtk ?? NaN);
  return Number.isFinite(ttk) ? ttk : null;
}

function readTimestamp(item: RunRecord): number {
  return readRunTimestamp(item);
}

function isMetricKey(value: string): value is MetricKey {
  return metricOptions.some((option) => option.value === value);
}

function isDataScopeKey(value: string): value is DataScopeKey {
  return scopeOptions.some((option) => option.value === value);
}

function buildNumericDomain(
  values: number[],
  padRatio: number,
  minPad: number,
): [number, number] {
  if (values.length === 0) return [0, 1];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(minPad, Math.abs(min) * padRatio);
    return [min - pad, max + pad];
  }

  const span = max - min;
  const pad = Math.max(span * padRatio, minPad);
  return [min - pad, max + pad];
}

function formatRunLabel(timestamp: number, runIndex: number): string {
  if (timestamp <= 0) return `Run ${runIndex}`;
  return `Run ${runIndex} · ${dateTimeFormatter.format(new Date(timestamp))}`;
}

function formatMetricTick(value: number, metric: MetricKey): string {
  return formatMetricValue(value, metric);
}

function formatMetricValue(value: number, metric: MetricKey): string {
  if (metric === "accuracy") return `${formatNumber(value, 1)}%`;
  if (metric === "ttk") return `${formatNumber(value, 3)}s`;
  return formatNumber(value, 0);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-surface-muted-strong p-4 text-sm text-surface-muted-foreground">
      {message}
    </div>
  );
}
