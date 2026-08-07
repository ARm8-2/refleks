import { formatNumber } from "@/features/benchmarks/lib/detailFormatting";
import { useLocaleFormat } from "@/i18n";
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
import { useTranslation } from "react-i18next";
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

const metricOptions: MetricKey[] = ["score", "accuracy", "ttk"];
const METRIC_LABEL_KEYS = {
  score: "performance.metrics.score",
  accuracy: "performance.metrics.accuracy",
  ttk: "performance.metrics.ttk",
} as const;

const metricColors: Record<MetricKey, string> = {
  score: CHART_SERIES_COLORS.scoreHistory,
  accuracy: CHART_SERIES_COLORS.accuracy,
  ttk: CHART_SERIES_COLORS.ttk,
};

const scopeOptions: DataScopeKey[] = ["session", "all"];
const SCOPE_LABEL_KEYS = {
  session: "performance.scopes.session",
  all: "performance.scopes.all",
} as const;

const DEFAULT_METRIC: MetricKey = "score";
const DEFAULT_SCOPE: DataScopeKey = "all";

const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function PerformanceVsSensWidget({
  sessions,
  scenarioName,
  title,
  description,
  className,
  allowScopeSelection = false,
}: PerformanceVsSensWidgetProps) {
  const { t } = useTranslation("history");
  const locale = useLocaleFormat();
  const resolvedTitle = title ?? t("performance.title");
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
    () =>
      buildChartData(sourceSessions, scenarioName ?? null, metric, (timestamp, runIndex) =>
        t("performance.runLabel", {
          index: runIndex,
          date:
            timestamp > 0
              ? locale.dateTimeFormatter(dateTimeFormatOptions).format(new Date(timestamp))
              : "",
        }),
      ),
    [locale, metric, scenarioName, sourceSessions, t],
  );
  const metricLabel = t(METRIC_LABEL_KEYS[metric]);
  const scopeLabel = sessions
    ? t("performance.scopes.session")
    : t(SCOPE_LABEL_KEYS[showScopeSelector ? scope : "all"]);
  const headerActions = (
    <div className="flex items-center gap-2">
      {showScopeSelector && (
        <Select
          value={scope}
          onValueChange={(value) =>
            setStoredScope(isDataScopeKey(value) ? value : DEFAULT_SCOPE)
          }
        >
          <SelectTrigger className="h-7 w-auto min-w-0 max-w-[180px] px-2 text-xs bg-surface-subtle">
            <SelectValue placeholder={t("performance.scope")} />
          </SelectTrigger>
          <SelectContent>
            {scopeOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {t(SCOPE_LABEL_KEYS[option])}
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
        <SelectTrigger className="h-7 w-auto min-w-0 max-w-[180px] px-2 text-xs bg-surface-subtle">
          <SelectValue placeholder={t("performance.metric")} />
        </SelectTrigger>
        <SelectContent>
          {metricOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {t(METRIC_LABEL_KEYS[option])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (!chartData.scenarioName) {
    return (
      <Widget
        title={resolvedTitle}
        description={
          description ??
          t("performance.playDescription")
        }
        headerAction={headerActions}
        className={className}
      >
        <EmptyState message={t("performance.noRecentScenario")} />
      </Widget>
    );
  }

  if (chartData.points.length === 0) {
    return (
      <Widget
        title={resolvedTitle}
        description={
          description ??
          `${chartData.scenarioName} · ${metricLabel} · ${scopeLabel}`
        }
        headerAction={headerActions}
        className={className}
      >
        <EmptyState
          message={t("performance.noUsableData", { scenario: chartData.scenarioName })}
        />
      </Widget>
    );
  }

  const modalTitle = t("performance.modalTitle", {
    scenario: chartData.scenarioName,
    title: resolvedTitle,
  });

  return (
    <Widget
      title={resolvedTitle}
      description={
        description ??
        t("performance.description", {
          scenario: chartData.scenarioName,
          count: chartData.points.length,
          metric: metricLabel,
          scope: scopeLabel,
        })
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
  const { t } = useTranslation("history");
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
                        {t("performance.sensitivity")}: {" "}
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
  formatLabel: (timestamp: number, runIndex: number) => string,
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
        runLabel: formatLabel(timestamp, runIndex),
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
  return metricOptions.includes(value as MetricKey);
}

function isDataScopeKey(value: string): value is DataScopeKey {
  return scopeOptions.includes(value as DataScopeKey);
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
