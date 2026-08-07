import { buildScoreDomain as buildSharedScoreDomain } from "@/shared/lib";
import { getActiveLocaleFormatters } from "@/i18n";
import {
  Gauge,
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { SnapshotTone } from "../../hooks/useRecentSessionSnapshot";

export function TrendIndicator({
  trend,
}: {
  trend: "up" | "down" | "flat" | null;
}) {
  if (!trend || trend === "flat") return null;
  if (trend === "up")
    return <TrendingUp className="h-3.5 w-3.5 text-[color:var(--success)]" />;
  return <TrendingDown className="h-3.5 w-3.5 text-[color:var(--warning)]" />;
}

export function formatScore(score: number): string {
  const formatter = getActiveLocaleFormatters();
  return score >= 1000
    ? `${formatter.formatNumber(score / 1000, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        useGrouping: false,
      })}k`
    : formatter.formatNumber(score, {
        maximumFractionDigits: 0,
        useGrouping: false,
      });
}

export function formatScoreCompact(score: number): string {
  return formatScore(score);
}

export function formatPercent(value: number): string {
  return getActiveLocaleFormatters().formatNumber(value, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function getStatusIcon(tone: SnapshotTone): LucideIcon {
  switch (tone) {
    case "success":
      return TrendingUp;
    case "warning":
      return TrendingDown;
    case "neutral":
      return Minus;
    case "muted":
    default:
      return Gauge;
  }
}

export function getToneBadgeClasses(tone: SnapshotTone): string {
  switch (tone) {
    case "success":
      return "bg-[color:var(--success-soft)] text-[color:var(--success)]";
    case "warning":
      return "bg-[color:var(--warning-soft)] text-[color:var(--warning-foreground)]";
    case "neutral":
      return "bg-primary-soft text-primary";
    case "muted":
    default:
      return "bg-surface-muted-soft text-surface-muted-foreground";
  }
}

export function getPerformanceAccent(tone: SnapshotTone): string {
  switch (tone) {
    case "success":
      return "text-[color:var(--success)]";
    case "warning":
      return "text-[color:var(--warning)]";
    case "neutral":
      return "text-primary";
    case "muted":
    default:
      return "text-surface-muted-foreground";
  }
}

export function buildScoreDomain(
  scores: number[],
  referenceScores: number[] = [],
): [number, number] {
  return buildSharedScoreDomain(scores, referenceScores);
}
