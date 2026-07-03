import { Widget, WidgetEmpty } from "@/shared/components";
import { cn } from "@/shared/lib";
import { Gauge } from "lucide-react";
import type { RecentSessionSnapshot } from "../../hooks/useRecentSessionSnapshot";
import {
  getPerformanceAccent,
  getStatusIcon,
  getToneBadgeClasses,
} from "./shared";

export function SessionPerformanceWidget({
  snapshot,
}: {
  snapshot: RecentSessionSnapshot;
}) {
  if (!snapshot.currentSession)
    return <WidgetEmpty icon={Gauge} label="Performance" />;

  const { statusTone, performanceValue, performanceDetail, statusLabel } =
    snapshot;
  const StatusIcon = getStatusIcon(statusTone);

  return (
    <Widget
      icon={Gauge}
      iconClassName={getPerformanceAccent(statusTone)}
      title="Performance"
      headerAction={
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            getToneBadgeClasses(statusTone),
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </span>
      }
    >
      <div
        className={cn(
          "text-lg font-semibold",
          getPerformanceAccent(statusTone),
        )}
      >
        {performanceValue}
      </div>
      <div className="mt-0.5 text-xs text-surface-muted-foreground">
        {performanceDetail}
      </div>
    </Widget>
  );
}
