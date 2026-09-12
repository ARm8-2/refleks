import {
  Button,
  InfoTooltip,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Widget,
} from "@/shared/components";
import {
  useAnimatedNumber,
  useInView,
  usePersistedState,
  useReveal,
  REVEAL_DELAY_MS,
} from "@/shared/hooks";
import { CHART_SERIES_COLORS, STORAGE_KEYS, useI18n } from "@/shared/lib";
import { Pencil, Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { RecentSessionSnapshot } from "../../hooks/useRecentSessionSnapshot";

const PHASE_SWATCH = {
  warmup: "var(--phase-warmup)",
  warmupFill: "var(--phase-warmup-soft)",
  peak: "var(--phase-peak)",
  peakFill: "var(--phase-peak-soft)",
  diminishing: "var(--phase-diminishing)",
  diminishingFill: "var(--phase-diminishing-soft)",
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

type SessionProgressTargetEditorProps = {
  targetRuns: number;
  isCustom: boolean;
  onChange: (nextTarget: number | null) => void;
};

function SessionProgressTargetEditor({
  targetRuns,
  isCustom,
  onChange,
}: SessionProgressTargetEditorProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draftTarget, setDraftTarget] = useState(targetRuns);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveOnCloseRef = useRef(true);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    setDraftTarget(targetRuns);
  }, [open, targetRuns]);

  function adjustDraftTarget(delta: number) {
    setDraftTarget((current) => Math.max(1, current + delta));
  }

  function commitTarget(rawValue: string) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setDraftTarget(targetRuns);
      return;
    }

    onChange(Math.max(1, Math.round(parsed)));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (saveOnCloseRef.current) {
        commitTarget(String(draftTarget));
      } else {
        saveOnCloseRef.current = true;
        setDraftTarget(targetRuns);
      }
    }

    setOpen(nextOpen);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTarget(String(draftTarget));
      setOpen(false);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      saveOnCloseRef.current = false;
      setOpen(false);
      setDraftTarget(targetRuns);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={isCustom ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          title={t("overview.sessionProgress.editTarget")}
        >
          <span className="tabular-nums">{targetRuns}</span>
          <span className="text-surface-muted-foreground">
            {isCustom
              ? t("overview.sessionProgress.target")
              : t("overview.sessionProgress.targetAuto")}
          </span>
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-2">
        <div className="space-y-2">
          <div className="px-1 text-[0.625rem] font-medium uppercase tracking-wide text-surface-muted-foreground">
            {t("overview.sessionProgress.targetRuns")}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-surface-muted-foreground"
              onMouseDown={(event) => {
                event.preventDefault();
                adjustDraftTarget(-1);
              }}
            >
              <span className="text-base leading-none">−</span>
            </Button>
            <Input
              ref={inputRef}
              type="number"
              min={1}
              value={draftTarget}
              onChange={(event) =>
                setDraftTarget(
                  Math.max(1, Number(event.currentTarget.value) || 1),
                )
              }
              onKeyDown={handleKeyDown}
              onBlur={(event) => commitTarget(event.currentTarget.value)}
              className="h-8 w-full rounded-xl px-2 text-center text-sm font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-surface-muted-foreground"
              onMouseDown={(event) => {
                event.preventDefault();
                adjustDraftTarget(1);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <span className="text-xs text-surface-muted-foreground">
              {isCustom
                ? t("overview.sessionProgress.customTarget")
                : t("overview.sessionProgress.automaticTarget")}
            </span>
            <div className="flex items-center gap-1">
              {isCustom && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    saveOnCloseRef.current = false;
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("common.actions.reset")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SessionProgressWidget({
  snapshot,
}: {
  snapshot: RecentSessionSnapshot;
}) {
  const { t } = useI18n();
  const {
    currentSession,
    currentRuns,
    suggestedRuns,
    warmupRuns,
    peakStart,
    peakEnd,
    diminishingReturnsAt,
  } = snapshot;

  const [customTarget, setCustomTarget] = usePersistedState<number | null>(
    STORAGE_KEYS.overviewSessionProgressTargetRuns,
    null,
  );
  const targetRuns = customTarget ?? suggestedRuns;
  const isCustom = customTarget !== null;

  // Gauge geometry is expressed as a fraction of the full circle. The scale
  // (maxRun) includes the live run count and the target/suggested values change
  // as history streams in, so animating fractions lets every load update ease
  // into place instead of snapping the arc back.
  const maxRun = Math.max(targetRuns, diminishingReturnsAt, currentRuns, 12);

  const { ref: gaugeRef, inView } = useInView<HTMLDivElement>();
  const revealed = useReveal(inView, REVEAL_DELAY_MS);
  const animation = {
    active: revealed,
    // The reveal delay above already gates the first tween; later data updates
    // (the target and run count stream in) animate immediately.
    delayMs: 0,
    durationMs: 900,
  };
  const runFrac = useAnimatedNumber(clamp01(currentRuns / maxRun), {
    ...animation,
    initial: 0,
  });
  const pctFrac = useAnimatedNumber(
    targetRuns > 0 ? clamp01(currentRuns / targetRuns) : 0,
    { ...animation, initial: 0 },
  );
  const runCount = useAnimatedNumber(currentRuns, {
    ...animation,
    initial: 0,
  });
  // Phase bands and the target marker animate the same way, so when the
  // recommendation changes mid-load the whole gauge resettles smoothly instead
  // of redrawing the bands in one jump.
  const warmupFrac = useAnimatedNumber(clamp01(warmupRuns / maxRun), {
    ...animation,
    initial: 0,
  });
  const peakStartFrac = useAnimatedNumber(clamp01((peakStart - 1) / maxRun), {
    ...animation,
    initial: 0,
  });
  const peakEndFrac = useAnimatedNumber(clamp01(peakEnd / maxRun), {
    ...animation,
    initial: 0,
  });
  const dimFrac = useAnimatedNumber(clamp01(diminishingReturnsAt / maxRun), {
    ...animation,
    initial: 1,
  });
  const targetFrac = useAnimatedNumber(clamp01(targetRuns / maxRun), {
    ...animation,
    initial: 0,
  });

  if (!currentSession) {
    return (
      <Widget title={t("overview.sessionProgress.title")}>
        <div className="flex h-full items-center justify-center rounded-xl bg-surface-muted-strong p-4 text-sm text-surface-muted-foreground">
          {t("overview.sessionProgress.empty")}
        </div>
      </Widget>
    );
  }

  const pct = Math.round(pctFrac * 100);
  const shownRuns = Math.round(runCount);

  const showCustomTargetMarker = isCustom && targetRuns < suggestedRuns;

  const outerR = 86;
  const innerR = 64;
  const cx = 100;
  const cy = 100;
  const toAngle = (frac: number) =>
    ((90 - clamp01(frac) * 360) * Math.PI) / 180;
  const targetAngle = toAngle(targetFrac);
  const targetMarkerRadius = (outerR + innerR) / 2;
  const targetMarkerInnerRadius = targetMarkerRadius - 4;
  const targetMarkerOuterRadius = targetMarkerRadius + 4;
  const targetMarkerX1 = cx + targetMarkerInnerRadius * Math.cos(targetAngle);
  const targetMarkerY1 = cy - targetMarkerInnerRadius * Math.sin(targetAngle);
  const targetMarkerX2 = cx + targetMarkerOuterRadius * Math.cos(targetAngle);
  const targetMarkerY2 = cy - targetMarkerOuterRadius * Math.sin(targetAngle);

  function arcPath(startFrac: number, endFrac: number): string {
    const a1 = toAngle(startFrac);
    const a2 = toAngle(endFrac);
    const x1 = cx + outerR * Math.cos(a1);
    const y1 = cy - outerR * Math.sin(a1);
    const x2 = cx + outerR * Math.cos(a2);
    const y2 = cy - outerR * Math.sin(a2);
    const ix1 = cx + innerR * Math.cos(a2);
    const iy1 = cy - innerR * Math.sin(a2);
    const ix2 = cx + innerR * Math.cos(a1);
    const iy2 = cy - innerR * Math.sin(a1);
    const sweep = Math.abs(a1 - a2) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${sweep} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${sweep} 0 ${ix2} ${iy2} Z`;
  }

  return (
    <Widget
      title={t("overview.sessionProgress.title")}
      headerAction={
        <SessionProgressTargetEditor
          targetRuns={targetRuns}
          isCustom={isCustom}
          onChange={setCustomTarget}
        />
      }
    >
      <div
        ref={gaugeRef}
        className="relative mx-auto flex flex-1 items-center justify-center"
      >
        <div className="relative aspect-square w-full max-w-[10rem] shrink-0">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <circle
              cx={cx}
              cy={cy}
              r={(outerR + innerR) / 2}
              fill="none"
              stroke="var(--surface-muted)"
              strokeWidth={outerR - innerR}
            />

            <path d={arcPath(0, warmupFrac)} fill={PHASE_SWATCH.warmupFill} />
            <path
              d={arcPath(peakStartFrac, peakEndFrac)}
              fill={PHASE_SWATCH.peakFill}
            />
            {dimFrac < 1 && (
              <path
                d={arcPath(dimFrac, 1)}
                fill={PHASE_SWATCH.diminishingFill}
              />
            )}

            {runFrac > 0 && (
              <path
                d={arcPath(0, runFrac)}
                fill={CHART_SERIES_COLORS.scoreHistory}
                opacity={0.55}
              />
            )}

            {showCustomTargetMarker && (
              <line
                x1={targetMarkerX1}
                y1={targetMarkerY1}
                x2={targetMarkerX2}
                y2={targetMarkerY2}
                className="stroke-primary"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            )}

            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-2xl font-bold"
            >
              {shownRuns}
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-surface-muted-foreground text-[0.6875rem]"
            >
              {t("overview.sessionProgress.targetSuffix", {
                count: targetRuns,
              })}
            </text>
            <text
              x={cx}
              y={cy + 22}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-surface-muted-foreground text-[0.625rem]"
            >
              {pct}%
            </text>
          </svg>
        </div>

        <div className="absolute bottom-0 right-0">
          <InfoTooltip side="left">
            <div className="space-y-1.5 text-[0.6875rem]">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: PHASE_SWATCH.warmup }}
                />
                <span className="text-popover-foreground/70">
                  {t("overview.sessionProgress.warmup")}
                </span>
                <span className="ml-auto font-medium text-popover-foreground">
                  1–{warmupRuns}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: PHASE_SWATCH.peak }}
                />
                <span className="text-popover-foreground/70">
                  {t("overview.sessionProgress.peak")}
                </span>
                <span className="ml-auto font-medium text-popover-foreground">
                  {peakStart}–{peakEnd}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: PHASE_SWATCH.diminishing }}
                />
                <span className="text-popover-foreground/70">
                  {t("overview.sessionProgress.diminishing")}
                </span>
                <span className="ml-auto font-medium text-popover-foreground">
                  {diminishingReturnsAt}+
                </span>
              </div>
            </div>
          </InfoTooltip>
        </div>
      </div>
    </Widget>
  );
}
