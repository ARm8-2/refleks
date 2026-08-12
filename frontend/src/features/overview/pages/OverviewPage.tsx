import { PerformanceVsSensWidget } from "@/features/history/components/PerformanceVsSensWidget";
import { SessionScenarioRadarWidget } from "@/features/history/components/SessionScenarioRadarWidget";
import { Loading } from "@/shared/components";
import { useI18n } from "@/shared/lib";
import { useStore } from "@/shared/hooks";
import { BenchmarkOverviewWidget } from "../components/BenchmarkOverviewWidget";
import {
  LastRunWidget,
  RecentScoresWidget,
  SessionPerformanceWidget,
  SessionProgressWidget,
  SessionTimeWidget,
  StreakPlaytimeWidget,
} from "../components/SessionWidgets";
import { useRecentSessionSnapshot } from "../hooks/useRecentSessionSnapshot";

export function OverviewPage() {
  const { t } = useI18n();
  const snapshot = useRecentSessionSnapshot();
  const sessions = useStore((s) => s.sessions);
  const runHydration = useStore((s) => s.runHydration);

  if (sessions.length === 0 && runHydration.loading) {
    const label =
      runHydration.total > 0
        ? t("overview.page.loadingHistoryProgress", {
            loaded: Math.min(runHydration.loaded, runHydration.total),
            total: runHydration.total,
          })
        : t("overview.page.loadingHistory");

    return <Loading label={label} />;
  }

  return (
    <div className="flex-1 overflow-auto text-sm">
      <div className="grid min-w-0 gap-4 p-5">
        {/* Row 1: Session metrics (2×2) + progress & performance */}
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="col-span-1 md:col-span-2 xl:col-span-2 grid grid-cols-2 gap-4 min-w-0">
            <SessionTimeWidget snapshot={snapshot} />
            <StreakPlaytimeWidget snapshot={snapshot} />
            <LastRunWidget snapshot={snapshot} />
            <SessionPerformanceWidget snapshot={snapshot} />
          </div>

          <div className="col-span-1 md:col-span-2 xl:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2 min-w-0">
            <SessionProgressWidget snapshot={snapshot} />
            <RecentScoresWidget snapshot={snapshot} />
          </div>
        </div>

        <BenchmarkOverviewWidget />

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <PerformanceVsSensWidget
            allowScopeSelection
            className="h-[21.25rem]"
          />
          <SessionScenarioRadarWidget className="h-[21.25rem]" />
        </div>
      </div>
    </div>
  );
}
