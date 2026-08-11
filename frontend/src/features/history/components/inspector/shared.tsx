import { cn } from "@/shared/lib";
import type { ReactNode } from "react";
import { formatNumber } from "../../lib/historyModels";

export function StatsGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface-subtle p-3">
      <div className="mb-2 text-xs font-medium text-surface-muted-foreground">
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-subtle px-3 py-2.5">
      <div className="text-xs text-surface-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-surface-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function CompareMetric({
  label,
  a,
  b,
  delta,
  lowerIsBetter,
}: {
  label: string;
  a: string;
  b: string;
  delta?: number | null;
  lowerIsBetter?: boolean;
}) {
  const showDelta =
    delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.1;
  const isImproved = showDelta && (lowerIsBetter ? delta < 0 : delta > 0);

  return (
    <div className="rounded-xl bg-surface-subtle px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-surface-muted-foreground">{label}</span>
        {showDelta && (
          <span
            className={cn(
              "text-[0.625rem] font-medium",
              isImproved ? "text-emerald-500" : "text-red-400",
            )}
          >
            {delta > 0 ? "+" : ""}
            {formatNumber(delta, 1)}%
          </span>
        )}
      </div>
      <div className="mt-1 space-y-0.5 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-surface-muted-foreground">A</span>
          <span className="font-medium text-foreground">{a}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-surface-muted-foreground">B</span>
          <span className="font-medium text-foreground">{b}</span>
        </div>
      </div>
    </div>
  );
}

export function CompareStatRow({
  label,
  a,
  b,
}: {
  label: string;
  a: string;
  b: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-surface-muted-foreground flex-shrink-0">
        {label}
      </span>
      <div className="flex items-baseline gap-4 text-sm tabular-nums">
        <span className="font-medium text-foreground">{a}</span>
        <span className="font-medium text-foreground">{b}</span>
      </div>
    </div>
  );
}
