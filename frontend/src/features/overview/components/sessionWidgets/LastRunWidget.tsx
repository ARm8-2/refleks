import { Widget, WidgetEmpty } from "@/shared/components";
import { Activity, Crosshair } from "lucide-react";
import type { RecentSessionSnapshot } from "../../hooks/useRecentSessionSnapshot";
import { useTranslation } from "react-i18next";
import { formatPercent, formatScore, TrendIndicator } from "./shared";

export function LastRunWidget({
  snapshot,
}: {
  snapshot: RecentSessionSnapshot;
}) {
  const { t } = useTranslation("overview");
  if (!snapshot.currentSession)
    return <WidgetEmpty icon={Activity} label={t("widgets.lastRun")} />;

  const {
    lastRunScore,
    lastRunAccuracy,
    lastRunScoreTrend,
    lastRunAccTrend,
    lastRunScenario,
    recentScores,
  } = snapshot;

  if (lastRunScore === null && lastRunAccuracy === null) {
    return (
      <Widget icon={Activity} title={t("widgets.lastRun")}>
        <p className="text-lg font-semibold text-surface-muted-foreground">
          --
        </p>
        <p className="mt-0.5 text-xs text-surface-muted-foreground">
          {t("lastRun.noScore")}
        </p>
      </Widget>
    );
  }

  return (
    <Widget
      icon={Activity}
      title={t("widgets.lastRun")}
      headerAction={
        lastRunScenario ? (
          <span
            className="max-w-[120px] truncate text-[11px] text-surface-muted-foreground"
            title={lastRunScenario}
          >
            {lastRunScenario}
          </span>
        ) : null
      }
    >
      <div className="flex items-center gap-4">
        {lastRunScore !== null && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-foreground">
              {formatScore(lastRunScore)}
            </span>
            <TrendIndicator trend={lastRunScoreTrend} />
          </div>
        )}
        {lastRunAccuracy !== null && (
          <div className="flex items-baseline gap-1.5">
            <Crosshair className="h-3 w-3 text-surface-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {formatPercent(lastRunAccuracy)}
            </span>
            <TrendIndicator trend={lastRunAccTrend} />
          </div>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-surface-muted-foreground">
        <span>
          {lastRunScoreTrend !== null
            ? t("lastRun.trend")
            : t("lastRun.scoreAccuracy")}
        </span>
        {recentScores.length > 0 && (
          <span className="ml-auto tabular-nums">
            {recentScores.length === 1
              ? t("lastRun.run_one", { count: recentScores.length })
              : t("lastRun.run_other", { count: recentScores.length })}
          </span>
        )}
      </div>
    </Widget>
  );
}
