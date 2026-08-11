import { Widget } from "@/shared/components";
import type { ChartConfig } from "@/shared/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import { useStore } from "@/shared/hooks";
import {
  CHART_SERIES_COLORS,
  CHART_STYLE,
  getScenarioName,
} from "@/shared/lib";
import type { Session } from "@/shared/types";
import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";

type ScenarioUsagePoint = {
  label: string;
  scenario: string;
  runs: number;
};

type SessionScenarioRadarWidgetProps = {
  session?: Session | null;
  title?: string;
  description?: string;
  className?: string;
};

const scenarioUsageConfig: ChartConfig = {
  runs: {
    label: "Runs",
    color: CHART_SERIES_COLORS.scoreCurrent,
  },
};

export function SessionScenarioRadarWidget({
  session,
  title = "Session Scenario Mix",
  description = "Scenarios played this session and how much you played each one.",
  className,
}: SessionScenarioRadarWidgetProps) {
  const storeSessions = useStore((state) => state.sessions);
  const currentSession = session ?? storeSessions[0] ?? null;

  const scenarioUsage = useMemo(() => {
    if (!currentSession) return [] as ScenarioUsagePoint[];

    const counts = new Map<string, number>();

    for (const item of currentSession.items) {
      const scenarioName = getScenarioName(item).trim();
      if (!scenarioName) continue;
      counts.set(scenarioName, (counts.get(scenarioName) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => {
        const byCount = right[1] - left[1];
        if (byCount !== 0) return byCount;
        return left[0].localeCompare(right[0]);
      })
      .map(([scenario, runs]) => ({
        label: truncateScenarioLabel(scenario),
        scenario,
        runs,
      }));
  }, [currentSession]);

  const maxRuns =
    scenarioUsage.length > 0
      ? Math.max(...scenarioUsage.map((point) => point.runs))
      : 1;

  return (
    <Widget
      title={title}
      description={description}
      modalTitle={title}
      modalContent={renderBody(true)}
      className={className}
    >
      {renderBody(false)}
    </Widget>
  );

  function renderBody(expanded: boolean) {
    if (!currentSession) {
      return (
        <EmptyState message="No active session data yet. Play a scenario to populate this widget." />
      );
    }

    if (scenarioUsage.length === 0) {
      return (
        <EmptyState message="No scenario names found in this session yet." />
      );
    }

    return (
      <SessionScenarioRadarChart
        points={scenarioUsage}
        maxRuns={maxRuns}
        expanded={expanded}
      />
    );
  }
}

function SessionScenarioRadarChart({
  points,
  maxRuns,
  expanded,
}: {
  points: ScenarioUsagePoint[];
  maxRuns: number;
  expanded: boolean;
}) {
  const angleTickSize = expanded
    ? points.length >= 8
      ? "0.625rem"
      : points.length >= 6
        ? "0.6875rem"
        : "0.75rem"
    : points.length >= 8
      ? "0.5625rem"
      : points.length >= 6
        ? "0.625rem"
        : "0.6875rem";
  const outerRadius = expanded
    ? points.length >= 8
      ? "64%"
      : points.length >= 6
        ? "70%"
        : "78%"
    : points.length >= 8
      ? "58%"
      : points.length >= 6
        ? "64%"
        : "72%";

  return (
    <ChartContainer
      config={scenarioUsageConfig}
      className="aspect-auto h-full w-full"
    >
      <RadarChart
        data={points}
        cx="50%"
        cy="52%"
        outerRadius={outerRadius}
        margin={{ top: 20, right: 28, left: 28, bottom: 12 }}
      >
        <PolarGrid
          gridType="circle"
          radialLines={false}
          stroke="var(--border-strong)"
          fill="none"
        />
        <PolarAngleAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{
            fill: "var(--surface-muted-foreground)",
            fontSize: angleTickSize,
          }}
        />
        <PolarRadiusAxis
          domain={[0, Math.max(1, maxRuns)]}
          tickCount={4}
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{
            fill: "var(--surface-muted-foreground)",
            fontSize: "0.6875rem",
          }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.scenario ?? null
              }
            />
          }
        />
        <Radar
          isAnimationActive={false}
          dataKey="runs"
          stroke="var(--color-runs)"
          fill="var(--color-runs)"
          fillOpacity={0.25}
          dot={{
            r: CHART_STYLE.scatterPointRadius,
            fill: "var(--color-runs)",
            strokeWidth: 0,
          }}
        />
      </RadarChart>
    </ChartContainer>
  );
}

function truncateScenarioLabel(label: string): string {
  if (label.length <= 18) return label;
  return `${label.slice(0, 17)}...`;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-surface-muted-strong p-4 text-sm text-surface-muted-foreground">
      {message}
    </div>
  );
}
