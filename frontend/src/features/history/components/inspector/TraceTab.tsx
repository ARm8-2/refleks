import { InfoTooltip } from "@/shared/components";
import { cn, useI18n, type MessageKey } from "@/shared/lib";

import { Copy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRunPerformanceEvents } from "../../hooks/useRunPerformanceEvents";
import { useRunStatsEvents } from "../../hooks/useRunStatsEvents";
import { useRunTrace } from "../../hooks/useRunTrace";
import type { HistoryRun } from "../../lib/historyModels";
import {
  computeMouseTraceAnalysis,
  computeSuggestedSens,
  type KillAnalysis,
  type KillClassification,
  type MouseTraceAnalysis,
  type SensSuggestion,
} from "../../lib/mouseAnalysis";
import { computeTargetInference } from "../../lib/targetInference";
import type { TraceHighlight } from "../../lib/traceRenderer";
import { TraceReplay } from "../TraceReplay";

/* ─── Kill classification ─── */

const CLASSIFICATION_STYLES = {
  overshoot: {
    dot: "bg-red-400",
    text: "text-red-400",
    highlight: "rgba(239,68,68,0.8)",
  },
  undershoot: {
    dot: "bg-amber-400",
    text: "text-amber-400",
    highlight: "rgba(245,158,11,0.8)",
  },
  optimal: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    highlight: "rgba(16,185,129,0.8)",
  },
  unknown: {
    dot: "bg-surface-muted-foreground",
    text: "text-surface-muted-foreground",
    highlight: "rgba(148,163,184,0.8)",
  },
} as const;

const CLASSIFICATION_LABEL_KEYS: Record<KillClassification, MessageKey> = {
  overshoot: "history.trace.overshoot",
  undershoot: "history.trace.undershoot",
  optimal: "history.trace.optimal",
  unknown: "history.trace.unknown",
};

function getFlickStartTs(kill: KillAnalysis): number {
  return Math.max(kill.startMs, kill.movementOnsetMs - 40);
}

/* ─── Formatting helpers ─── */

function fmtNum(n: number, d = 1): string {
  return Number.isFinite(n) ? n.toFixed(d) : "-";
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/* ─── Component ─── */

export function TraceTab({
  primaryRun,
  compareRun,
  overlay,
}: {
  primaryRun: HistoryRun;
  compareRun: HistoryRun | null;
  overlay: boolean;
}) {
  const { t } = useI18n();
  const primaryPoints = useRunTrace(primaryRun);
  const comparePoints = useRunTrace(compareRun);
  const primaryEvents = useRunStatsEvents(primaryRun);
  const compareEvents = useRunStatsEvents(compareRun);
  const primaryPerformanceEvents = useRunPerformanceEvents(primaryRun);
  const comparePerformanceEvents = useRunPerformanceEvents(compareRun);
  const primaryResolution = String(
    primaryRun.item.stats.summary.resolution ?? "",
  );
  const compareResolution = String(
    compareRun?.item.stats.summary.resolution ?? "",
  );

  const [selectedKill, setSelectedKill] = useState<KillAnalysis | null>(null);

  // Reset selection when run changes
  useEffect(() => {
    setSelectedKill(null);
  }, [primaryRun]);

  // Compute analysis
  const analysis: MouseTraceAnalysis | null = useMemo(() => {
    if (!primaryPoints || primaryPoints.length === 0 || !primaryEvents)
      return null;
    return computeMouseTraceAnalysis(
      primaryRun.item.stats.summary,
      primaryEvents,
      primaryPoints,
      primaryRun.item.performances?.header,
    );
  }, [
    primaryEvents,
    primaryPoints,
    primaryRun.item.performances?.header,
    primaryRun.item.stats.summary,
  ]);

  const compareAnalysis: MouseTraceAnalysis | null = useMemo(() => {
    if (
      !compareRun ||
      !comparePoints ||
      comparePoints.length === 0 ||
      !compareEvents
    )
      return null;
    return computeMouseTraceAnalysis(
      compareRun.item.stats.summary,
      compareEvents,
      comparePoints,
      compareRun.item.performances?.header,
    );
  }, [
    compareEvents,
    comparePoints,
    compareRun,
    compareRun?.item.performances?.header,
  ]);

  const suggestion: SensSuggestion | null = useMemo(() => {
    if (!analysis) return null;
    return computeSuggestedSens(analysis, primaryRun.item.stats.summary);
  }, [analysis, primaryRun.item.stats.summary]);

  const primaryTargetInference = useMemo(() => {
    if (
      !primaryPoints ||
      primaryPoints.length === 0 ||
      !primaryPerformanceEvents
    )
      return [];
    return computeTargetInference(
      primaryPoints,
      primaryRun.item.performances?.header,
      primaryPerformanceEvents,
      analysis,
    );
  }, [
    analysis,
    primaryPerformanceEvents,
    primaryPoints,
    primaryRun.item.performances?.header,
  ]);

  const compareTargetInference = useMemo(() => {
    if (
      !compareRun ||
      !comparePoints ||
      comparePoints.length === 0 ||
      !comparePerformanceEvents
    )
      return [];
    return computeTargetInference(
      comparePoints,
      compareRun.item.performances?.header,
      comparePerformanceEvents,
      compareAnalysis,
    );
  }, [compareAnalysis, comparePerformanceEvents, comparePoints, compareRun]);

  // Highlight: show the last flick from the prior click to the current kill click
  const highlight: TraceHighlight | undefined = useMemo(() => {
    if (!selectedKill) return undefined;
    return {
      startTs: getFlickStartTs(selectedKill),
      endTs: selectedKill.endMs,
      color: CLASSIFICATION_STYLES[selectedKill.classification].highlight,
    };
  }, [selectedKill]);

  const seekToMs = selectedKill?.endMs ?? null;

  const handleKillClick = useCallback((kill: KillAnalysis) => {
    setSelectedKill((prev) => (prev?.killIdx === kill.killIdx ? null : kill));
  }, []);

  const clearSelection = useCallback(() => setSelectedKill(null), []);

  if (
    primaryPoints === null ||
    primaryEvents === null ||
    primaryPerformanceEvents === null ||
    (compareRun &&
      (comparePoints === null ||
        compareEvents === null ||
        comparePerformanceEvents === null))
  ) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-subtle p-6 text-center">
        <p className="text-sm text-surface-muted-foreground">
          {t("history.trace.loading")}
        </p>
      </div>
    );
  }

  if (!primaryPoints || primaryPoints.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-subtle p-6 text-center">
        <p className="text-sm text-surface-muted-foreground">
          {t("history.trace.noMouseTrace")}
        </p>
      </div>
    );
  }

  const hasCompare = comparePoints != null && comparePoints.length > 0;
  const hasAnalysis = analysis != null && analysis.kills.length > 0;

  return (
    <div className="space-y-3">
      <TraceReplay
        points={primaryPoints}
        resolution={primaryResolution || undefined}
        comparePoints={hasCompare ? comparePoints! : undefined}
        compareResolution={
          hasCompare ? compareResolution || undefined : undefined
        }
        layout={hasCompare && !overlay ? "split" : "overlay"}
        highlight={highlight}
        targetInference={primaryTargetInference}
        compareTargetInference={hasCompare ? compareTargetInference : undefined}
        seekToMs={seekToMs}
        onReset={clearSelection}
        onHighlightChange={(h) => h === null && setSelectedKill(null)}
      />

      {/* Analysis panel */}
      {hasAnalysis && (
        <AnalysisPanel
          analysis={analysis}
          suggestion={suggestion}
          selectedKillIdx={selectedKill?.killIdx ?? null}
          onKillClick={handleKillClick}
        />
      )}
    </div>
  );
}

/* ─── Analysis panel ─── */

function AnalysisPanel({
  analysis,
  suggestion,
  selectedKillIdx,
  onKillClick,
}: {
  analysis: MouseTraceAnalysis;
  suggestion: SensSuggestion | null;
  selectedKillIdx: number | null;
  onKillClick: (kill: KillAnalysis) => void;
}) {
  const { t } = useI18n();
  const { counts, kills } = analysis;
  const killListRef = useRef<HTMLDivElement>(null);

  // Scroll selected kill into view
  useEffect(() => {
    if (selectedKillIdx == null || !killListRef.current) return;
    const btn = killListRef.current.querySelector(
      `[data-kill="${selectedKillIdx}"]`,
    );
    btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedKillIdx]);

  return (
    <div className="shrink-0 space-y-1.5">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-2 pl-2 pr-3.5">
        <div className="flex items-center gap-2 text-xs text-surface-muted-foreground">
          {counts.overshoot > 0 && (
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  CLASSIFICATION_STYLES.overshoot.dot,
                )}
              />
              {t("history.trace.killsOvershoot", { count: counts.overshoot })}
            </span>
          )}
          {counts.undershoot > 0 && (
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  CLASSIFICATION_STYLES.undershoot.dot,
                )}
              />
              {t("history.trace.killsUndershoot", {
                count: counts.undershoot,
              })}
            </span>
          )}
          {counts.optimal > 0 && (
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  CLASSIFICATION_STYLES.optimal.dot,
                )}
              />
              {t("history.trace.killsOptimal", { count: counts.optimal })}
            </span>
          )}
          {counts.unknown > 0 && (
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  CLASSIFICATION_STYLES.unknown.dot,
                )}
              />
              {t("history.trace.killsUnknown", { count: counts.unknown })}
            </span>
          )}
          <span>·</span>
          <span>
            {t("history.trace.pathEff", {
              value: fmtPct(analysis.avgEfficiency),
            })}
          </span>
          <span className="text-[0.6875rem]">({analysis.coordinateSpace})</span>
          {analysis.skippedKillCount > 0 && (
            <span className="text-[0.6875rem]">
              {t("history.trace.outsideTrace", {
                count: analysis.skippedKillCount,
              })}
            </span>
          )}
        </div>
        <div className="ml-auto">
          <InfoTooltip side="left">
            <div className="max-w-xs space-y-1.5 text-[0.6875rem]">
              <p className="font-medium text-popover-foreground">
                {t("history.trace.mousePathAnalysis")}
              </p>
              <p className="text-popover-foreground/70">
                {t("history.trace.analysisDescription")}
              </p>
              <div className="space-y-0.5 text-popover-foreground/70">
                <p>
                  <span className={CLASSIFICATION_STYLES.overshoot.text}>
                    {t("history.trace.overshoot")}
                  </span>{" "}
                  — {t("history.trace.overshootDesc")}
                </p>
                <p>
                  <span className={CLASSIFICATION_STYLES.undershoot.text}>
                    {t("history.trace.undershoot")}
                  </span>{" "}
                  — {t("history.trace.undershootDesc")}
                </p>
                <p>
                  <span className={CLASSIFICATION_STYLES.optimal.text}>
                    {t("history.trace.optimal")}
                  </span>{" "}
                  — {t("history.trace.optimalDesc")}
                </p>
                <p>
                  <span className={CLASSIFICATION_STYLES.unknown.text}>
                    {t("history.trace.unknown")}
                  </span>{" "}
                  — {t("history.trace.unknownDesc")}
                </p>
              </div>
              {analysis.avgOvershootPixels > 0 && (
                <p className="text-popover-foreground/70">
                  {t("history.trace.avgOvershoot", {
                    value: fmtNum(analysis.avgOvershootPixels),
                  })}
                </p>
              )}
              {analysis.avgUndershootPixels > 0 && (
                <p className="text-popover-foreground/70">
                  {t("history.trace.avgUndershoot", {
                    value: fmtNum(analysis.avgUndershootPixels),
                  })}
                </p>
              )}
              <p className="text-popover-foreground/50">
                {t("history.trace.clickKillHint")}
              </p>
            </div>
          </InfoTooltip>
        </div>
      </div>

      {/* Sensitivity suggestion */}
      {suggestion ? (
        <SensSuggestionCard suggestion={suggestion} />
      ) : (
        <div className="rounded-xl bg-surface-subtle px-3 py-2 text-xs text-surface-muted-foreground">
          {t("history.trace.noSensSuggested")}
        </div>
      )}

      {/* Kill list — scrollable row */}
      <div
        ref={killListRef}
        className="scrollbar-compact flex gap-1 overflow-x-auto pb-0.5"
      >
        {kills.map((k) => (
          <KillChip
            key={k.killIdx}
            kill={k}
            selected={selectedKillIdx === k.killIdx}
            onClick={() => onKillClick(k)}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Kill chip ─── */

function KillChip({
  kill,
  selected,
  onClick,
}: {
  kill: KillAnalysis;
  selected: boolean;
  onClick: () => void;
}) {
  const px =
    kill.classification === "overshoot"
      ? kill.overshootPixels
      : kill.undershootPixels;
  const style = CLASSIFICATION_STYLES[kill.classification];
  const { t } = useI18n();

  const units =
    px > 0 ? ` ${t("history.trace.traceUnits", { value: fmtNum(px, 0) })}` : "";

  return (
    <button
      type="button"
      data-kill={kill.killIdx}
      onClick={onClick}
      title={t("history.trace.killChipTitle", {
        index: kill.killIdx,
        classification: t(CLASSIFICATION_LABEL_KEYS[kill.classification]),
        units,
        eff: fmtPct(kill.efficiency),
      })}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] tabular-nums transition-colors",
        selected
          ? "bg-surface-muted text-foreground"
          : "text-surface-muted-foreground hover:bg-surface-muted/50 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full shrink-0",
          style.dot,
        )}
      />
      #{kill.killIdx}
    </button>
  );
}

/* ─── Sensitivity suggestion card ─── */

function SensSuggestionCard({ suggestion }: { suggestion: SensSuggestion }) {
  const { t } = useI18n();
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.recommended.toFixed(2));
    } catch {
      // Fallback for unsupported environment
    }
  };

  return (
    <div className="rounded-xl bg-surface-subtle px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-surface-muted-foreground">
            {t("history.trace.suggestedTrainingSens")}
          </span>
          <span className="font-medium text-foreground">
            {fmtNum(suggestion.recommended, 2)} cm/360
          </span>
          <span className="text-[0.6875rem] text-surface-muted-foreground">
            ({suggestion.changePct >= 0 ? "+" : ""}
            {fmtNum(suggestion.changePct)}%)
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title={t("history.trace.copySens", {
              value: suggestion.recommended.toFixed(2),
            })}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-surface-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <InfoTooltip side="left">
          <div className="max-w-xs space-y-1 text-[0.6875rem]">
            <p className="font-medium text-popover-foreground">
              {t("history.trace.trainingSensitivity")}
            </p>
            <p className="text-popover-foreground/70">{suggestion.reason}</p>
          </div>
        </InfoTooltip>
      </div>
    </div>
  );
}
