import { Widget, WidgetEmpty } from "@/shared/components";
import { Clock3, Gamepad2 } from "lucide-react";
import type { RecentSessionSnapshot } from "../../hooks/useRecentSessionSnapshot";

export function SessionTimeWidget({
  snapshot,
}: {
  snapshot: RecentSessionSnapshot;
}) {
  if (!snapshot.currentSession)
    return <WidgetEmpty icon={Clock3} label="Session & Playtime" />;

  const {
    sessionLengthLabel,
    sessionLengthDetail,
    activePlaytimeLabel,
    activePlaytimeDetail,
  } = snapshot;

  return (
    <Widget icon={Clock3} title="Session & Playtime">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-foreground">
          {sessionLengthLabel}
        </span>
        <span className="text-xs text-surface-muted-foreground">
          {sessionLengthDetail}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Gamepad2 className="h-4 w-4 text-surface-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {activePlaytimeLabel}
        </span>
        <span className="text-xs text-surface-muted-foreground">
          {activePlaytimeDetail}
        </span>
      </div>
    </Widget>
  );
}
