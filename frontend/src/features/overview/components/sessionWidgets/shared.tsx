import { buildScoreDomain as buildSharedScoreDomain } from "@/shared/lib";
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
    return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  return <TrendingDown className="h-3.5 w-3.5 text-warning" />;
}

export function formatScore(score: number): string {
  return score >= 1000 ? `${(score / 1000).toFixed(1)}k` : score.toFixed(0);
}

export function formatScoreCompact(score: number): string {
  if (score >= 10000) return `${(score / 1000).toFixed(1)}k`;
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`;
  return score.toFixed(0);
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
      return "bg-success-soft text-success";
    case "warning":
      return "bg-warning-soft text-warning-foreground";
    case "neutral":
      return "bg-primary-soft text-primary";
    case "muted":
    default:
      return "bg-muted-soft text-muted-foreground";
  }
}

export function getPerformanceAccent(tone: SnapshotTone): string {
  switch (tone) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "neutral":
      return "text-primary";
    case "muted":
    default:
      return "text-muted-foreground";
  }
}

export function buildScoreDomain(
  scores: number[],
  referenceScores: number[] = [],
): [number, number] {
  return buildSharedScoreDomain(scores, referenceScores);
}
