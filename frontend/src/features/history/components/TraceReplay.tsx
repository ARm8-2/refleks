import { Modal, TogglePill } from "@/shared/components";
import { Slider } from "@/shared/components/ui/slider";
import { usePersistedState } from "@/shared/hooks";
import { cn, STORAGE_KEYS } from "@/shared/lib";
import type { MousePoint } from "@/shared/types/ipc";
import {
  CircleDot,
  Eye,
  LineSquiggle,
  Link,
  Maximize2,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TargetInferenceFrame } from "../lib/targetInference";
import type {
  ClickMode,
  TraceColors,
  TraceHighlight,
  TrailMode,
} from "../lib/traceRenderer";
import {
  computeBounds,
  computeMergedBounds,
  findPointIndex,
  fitScale,
  formatTraceTime,
  renderTrace,
} from "../lib/traceRenderer";
import { useTracePlayback } from "../lib/useTracePlayback";

/* ─── CSS variable → RGB tuple ─── */

function cssVarRGB(
  name: string,
  fallback: [number, number, number],
): [number, number, number] {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  // handle hex (#rrggbb)
  const hex = raw.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex)
    return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
  // handle rgb values
  const rgb = raw.match(/(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return fallback;
}

function cssVarColor(name: string, fallback: string): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

function withAlpha(color: string, a: number): string {
  const rgb = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (rgb)
    return `rgba(${parseInt(rgb[1], 16)},${parseInt(rgb[2], 16)},${parseInt(rgb[3], 16)},${a})`;
  const rgbFunc = color.match(
    /^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i,
  );
  if (rgbFunc)
    return `rgba(${Number(rgbFunc[1])},${Number(rgbFunc[2])},${Number(rgbFunc[3])},${a})`;
  return color;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/* ─── Component ─── */

type TraceReplayProps = {
  points: MousePoint[];
  resolution?: string;
  comparePoints?: MousePoint[];
  compareResolution?: string;
  layout?: "overlay" | "split";
  highlight?: TraceHighlight;
  targetInference?: Array<TargetInferenceFrame | null>;
  compareTargetInference?: Array<TargetInferenceFrame | null>;
  seekToMs?: number | null;
  onReset?: () => void;
  onHighlightChange?: (highlight: TraceHighlight | null) => void;
};

const SPEED_MIN = 0.1;
const SPEED_MAX = 4;
const SPEED_DEFAULT = 1;

export function TraceReplay({
  points,
  resolution,
  comparePoints,
  compareResolution,
  layout = "overlay",
  highlight,
  targetInference,
  compareTargetInference,
  seekToMs,
  onReset,
  onHighlightChange,
}: TraceReplayProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTraceSet, setModalTraceSet] = useState<
    "primary" | "compare" | "both"
  >("both");
  const openModal = useCallback((traceSet: "primary" | "compare" | "both") => {
    setModalTraceSet(traceSet);
    setModalOpen(true);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const splitCanvasRef = useRef<HTMLCanvasElement>(null);
  const splitWrapRef = useRef<HTMLDivElement>(null);
  // Modal: use state-based ref so effects re-run when Dialog mounts the element
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalWrapRef = useRef<HTMLDivElement>(null);
  const [modalCanvasEl, setModalCanvasEl] = useState<HTMLCanvasElement | null>(
    null,
  );
  const modalCanvasCallbackRef = useCallback((el: HTMLCanvasElement | null) => {
    modalCanvasRef.current = el;
    setModalCanvasEl(el);
  }, []);
  const centerRef = useRef<{ cx: number; cy: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const dragCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const panRafRef = useRef<number | null>(null);

  // Persisted options
  const [speed, setSpeed] = usePersistedState(
    STORAGE_KEYS.traceSpeed,
    SPEED_DEFAULT,
  );
  const [trailMode, setTrailMode] = usePersistedState<TrailMode>(
    STORAGE_KEYS.traceTrail,
    "all",
  );
  const [autoFollow, setAutoFollow] = usePersistedState(
    STORAGE_KEYS.traceFollow,
    false,
  );
  const [clickMode, setClickMode] = usePersistedState<ClickMode>(
    STORAGE_KEYS.traceClicks,
    "down",
  );
  const [zoom, setZoom] = usePersistedState(STORAGE_KEYS.traceZoom, 1);
  const [syncByTime, setSyncByTime] = usePersistedState(
    STORAGE_KEYS.traceSyncByTime,
    false,
  );
  const [showTargetInference, setShowTargetInference] = usePersistedState(
    STORAGE_KEYS.traceTargetInference,
    false,
  );

  const hasTargetInference = useMemo(
    () =>
      Boolean(
        targetInference?.some(Boolean) || compareTargetInference?.some(Boolean),
      ),
    [compareTargetInference, targetInference],
  );

  const autoFollowRef = useRef(autoFollow);
  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);

  // Compare mode: auto-default to trail=2s + follow when entering overlay
  const hasCompare = comparePoints != null && comparePoints.length > 1;
  const isSplit = layout === "split" && hasCompare;
  const prevHadCompare = useRef(false);
  useEffect(() => {
    if (hasCompare && !prevHadCompare.current) {
      setTrailMode("last2");
      setAutoFollow(true);
    }
    prevHadCompare.current = hasCompare;
  }, [hasCompare]);

  // Derived data — merged bounds when comparing
  const primaryBounds = useMemo(
    () => computeBounds(points, resolution),
    [points, resolution],
  );
  const compareBoundsVal = useMemo(
    () =>
      hasCompare ? computeBounds(comparePoints!, compareResolution) : null,
    [hasCompare, comparePoints, compareResolution],
  );
  const bounds = useMemo(
    () =>
      compareBoundsVal
        ? computeMergedBounds(primaryBounds, compareBoundsVal)
        : primaryBounds,
    [primaryBounds, compareBoundsVal],
  );
  const [transformTick, setTransformTick] = useState(0);

  // Playback
  const onIndexChange = useCallback(
    (idx: number) => {
      if (!autoFollowRef.current || points.length === 0) return;
      const i = Math.max(0, Math.min(points.length - 1, idx - 1));
      const p = points[i];
      if (p) centerRef.current = { cx: p.x, cy: p.y };
    },
    [points],
  );

  const [state, actions] = useTracePlayback(points, speed, onIndexChange);
  const { playIndex, isPlaying, progressMs, durationMs } = state;

  const t0 = points[0]?.ts ?? 0;

  const [isDragging, setIsDragging] = useState(false);

  // Bounded playback: when a highlight exists and playback reaches its end, loop back to start
  // But if user is dragging, don't loop—let them seek outside bounds. Instead, deselect the highlight.
  useEffect(() => {
    if (!highlight || !isPlaying) return;

    const curTs =
      points[Math.max(0, Math.min(points.length - 1, playIndex))]?.ts ?? t0;
    const { startTs: boundStart, endTs: boundEnd } = highlight;

    // If user is dragging and we're outside bounds, deselect the highlight
    if (isDragging && (curTs < boundStart || curTs > boundEnd)) {
      onHighlightChange?.(null);
      return;
    }

    // If we've exceeded the bound end and NOT dragging, loop back to start
    if (!isDragging && curTs >= boundEnd) {
      actions.seekTo(boundStart - t0);
    }
  }, [
    highlight,
    playIndex,
    isPlaying,
    isDragging,
    points,
    actions,
    t0,
    onHighlightChange,
  ]);

  // Theme colors (computed once, refreshed on theme change)
  const colors = useMemo((): TraceColors => {
    const primary = cssVarColor("--primary", "var(--primary)");
    const destructive = cssVarColor("--destructive", "var(--destructive)");
    const fg = cssVarColor("--trace-click", "#f8fafc");
    return {
      accentRGB: cssVarRGB("--primary", [60, 131, 246]),
      dangerRGB: cssVarRGB("--destructive", [239, 67, 67]),
      startPoint: withAlpha(primary, 0.9),
      endPoint: withAlpha(destructive, 0.9),
      marker: fg,
      markerBorder: cssVarColor("--trace-click-ring", "#ffffffcc"),
      boxFill: cssVarColor("--trace-box-fill", "#2a2a2a66"),
      boxStroke: cssVarColor("--trace-box-stroke", "#5a5a5a88"),
    };
  }, []);

  const compareColorSet = useMemo((): TraceColors => {
    const fg = cssVarColor("--trace-click", "#f8fafc");
    const compareStart = cssVarColor("--trace-compare", "var(--trace-compare)");
    const compareEnd = cssVarColor(
      "--trace-compare-end",
      "var(--trace-compare-end)",
    );
    return {
      accentRGB: cssVarRGB("--trace-compare", [20, 184, 166]),
      dangerRGB: cssVarRGB("--trace-compare-end", [234, 179, 8]),
      startPoint: withAlpha(compareStart, 0.9),
      endPoint: withAlpha(compareEnd, 0.9),
      marker: fg,
      markerBorder: cssVarColor("--trace-click-ring", "#ffffffcc"),
      boxFill: cssVarColor("--trace-box-fill", "#2a2a2a66"),
      boxStroke: cssVarColor("--trace-box-stroke", "#5a5a5a88"),
    };
  }, []);

  // Reset view when points change
  useEffect(() => {
    setZoom(1);
    centerRef.current = { cx: bounds.cx, cy: bounds.cy };
  }, [points]);

  // External seek (e.g. from kill selection in analysis)
  useEffect(() => {
    if (seekToMs == null || !Number.isFinite(seekToMs) || points.length === 0)
      return;
    actions.seekTo(seekToMs - (points[0]?.ts ?? 0));
    const i = findPointIndex(points, seekToMs);
    const p = points[Math.max(0, Math.min(points.length - 1, i))];
    if (p) centerRef.current = { cx: p.x, cy: p.y };
    setTransformTick((t) => t + 1);
  }, [seekToMs]);

  // ── Drawing ──
  const drawToCanvas = useCallback(
    (
      canvas: HTMLCanvasElement | null,
      wrap: HTMLDivElement | null,
      traceSet: "primary" | "compare" | "both" = "both",
    ) => {
      const pts = traceSet === "compare" ? comparePoints : points;
      if (!canvas || !wrap || !pts || pts.length === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.max(320, wrap.clientWidth);
      const cssH = Math.max(200, wrap.clientHeight);

      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const idx = clamp(playIndex, 0, points.length - 1);
      const curT = points[idx].ts;
      const center = centerRef.current ?? { cx: bounds.cx, cy: bounds.cy };

      // Primary trace
      if (traceSet !== "compare") {
        let startIdx = 0;
        let endIdx = Math.min(playIndex, points.length);
        if (trailMode === "last2") {
          startIdx = findPointIndex(points, curT - 2000);
        }
        const count = Math.max(1, endIdx - startIdx);
        const step = count > 10000 ? Math.ceil(count / 10000) : 1;
        renderTrace(ctx, {
          width: cssW,
          height: cssH,
          points,
          startIdx,
          endIdx,
          step,
          bounds,
          zoom,
          center,
          trailMode,
          clickMode,
          curT,
          colors,
          highlight,
          targetFrame: showTargetInference ? targetInference?.[idx] : undefined,
        });
      }

      // Compare trace
      if (traceSet !== "primary" && comparePoints && comparePoints.length > 1) {
        const ct0 = comparePoints[0].ts;
        const ctN = comparePoints[comparePoints.length - 1].ts;
        const cDuration = Math.max(1, ctN - ct0);
        const cCurT = syncByTime
          ? ct0 + progressMs
          : ct0 + (durationMs > 0 ? progressMs / durationMs : 0) * cDuration;
        let cEndIdx = findPointIndex(comparePoints, cCurT);
        if (
          cEndIdx < comparePoints.length &&
          comparePoints[cEndIdx].ts <= cCurT
        )
          cEndIdx++;
        cEndIdx = Math.min(cEndIdx, comparePoints.length);
        let cStartIdx = 0;
        if (trailMode === "last2") {
          cStartIdx = findPointIndex(comparePoints, cCurT - 2000);
        }
        const cCount = Math.max(1, cEndIdx - cStartIdx);
        const cStep = cCount > 10000 ? Math.ceil(cCount / 10000) : 1;

        // In split 'compare' canvas, draw bounding box; in overlay, skip it
        const drawBox = traceSet === "compare";
        renderTrace(ctx, {
          width: cssW,
          height: cssH,
          points: comparePoints,
          startIdx: cStartIdx,
          endIdx: cEndIdx,
          step: cStep,
          bounds,
          zoom,
          center,
          trailMode,
          clickMode,
          curT: cCurT,
          colors: traceSet === "compare" ? colors : compareColorSet,
          drawBox,
          targetFrame: showTargetInference
            ? compareTargetInference?.[
                Math.max(0, Math.min(comparePoints.length - 1, cEndIdx - 1))
              ]
            : undefined,
        });
      }
    },
    [
      points,
      comparePoints,
      playIndex,
      trailMode,
      clickMode,
      bounds,
      zoom,
      colors,
      compareColorSet,
      durationMs,
      progressMs,
      syncByTime,
      highlight,
      showTargetInference,
      targetInference,
      compareTargetInference,
    ],
  );

  useEffect(() => {
    if (modalOpen) {
      drawToCanvas(modalCanvasRef.current, modalWrapRef.current, modalTraceSet);
    } else if (isSplit) {
      drawToCanvas(canvasRef.current, wrapRef.current, "primary");
      drawToCanvas(splitCanvasRef.current, splitWrapRef.current, "compare");
    } else {
      drawToCanvas(canvasRef.current, wrapRef.current, "both");
    }
  }, [drawToCanvas, transformTick, modalOpen, isSplit, modalTraceSet]);

  // Redraw on modal open (layout changes)
  useEffect(() => {
    if (modalOpen) {
      const id = requestAnimationFrame(() => setTransformTick((t) => t + 1));
      return () => cancelAnimationFrame(id);
    }
  }, [modalOpen]);

  // ── Resize ──
  useEffect(() => {
    const redraw = () => setTransformTick((t) => t + 1);
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, []);

  // ── Interaction: wheel zoom + drag pan (single effect, one set of window listeners) ──
  useEffect(() => {
    const canvases: HTMLCanvasElement[] = [];
    if (modalCanvasEl) {
      canvases.push(modalCanvasEl);
    } else {
      if (canvasRef.current) canvases.push(canvasRef.current);
      if (splitCanvasRef.current) canvases.push(splitCanvasRef.current);
    }
    if (canvases.length === 0) return;

    // Wheel zoom (per-canvas listener, no duplication issue)
    const onWheel = (e: WheelEvent) => {
      const canvas = e.currentTarget as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cssW = rect.width;
      const cssH = rect.height;
      const scale = fitScale(cssW, cssH, bounds.w, bounds.h, zoom);
      const baseScale = fitScale(cssW, cssH, bounds.w, bounds.h, 1);
      const scrCX = cssW / 2;
      const scrCY = cssH / 2;
      if (!centerRef.current)
        centerRef.current = { cx: bounds.cx, cy: bounds.cy };
      const { cx, cy } = centerRef.current;

      const bx0 = scrCX + (bounds.minX - cx) * scale;
      const by0 = scrCY + (bounds.minY - cy) * scale;
      const bx1 = scrCX + (bounds.minX + bounds.w - cx) * scale;
      const by1 = scrCY + (bounds.minY + bounds.h - cy) * scale;
      const rx = Math.min(bx0, bx1),
        ry = Math.min(by0, by1);
      const rw = Math.abs(bx1 - bx0),
        rh = Math.abs(by1 - by0);
      if (mx < rx || mx > rx + rw || my < ry || my > ry + rh) return;

      e.preventDefault();
      const newZoom = clamp(zoom * Math.pow(1.001, -e.deltaY), 0.1, 50);
      const newScale = baseScale * newZoom;
      const dataX = cx + (mx - scrCX) / scale;
      const dataY = cy + (my - scrCY) / scale;
      centerRef.current = {
        cx: dataX - (mx - scrCX) / newScale,
        cy: dataY - (my - scrCY) / newScale,
      };
      setZoom(newZoom);
    };

    // Drag pan (single window listener, tracks which canvas initiated the drag)
    const onDown = (e: PointerEvent) => {
      const canvas = e.currentTarget as HTMLCanvasElement;
      canvas.setPointerCapture(e.pointerId);
      dragCanvasRef.current = canvas;
      dragRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current || !dragCanvasRef.current) return;
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      dragRef.current = { x: e.clientX, y: e.clientY };
      const rect = dragCanvasRef.current.getBoundingClientRect();
      const scale = fitScale(rect.width, rect.height, bounds.w, bounds.h, zoom);
      if (!centerRef.current)
        centerRef.current = { cx: bounds.cx, cy: bounds.cy };
      centerRef.current = {
        cx: centerRef.current.cx - dx / scale,
        cy: centerRef.current.cy - dy / scale,
      };
      if (panRafRef.current == null) {
        panRafRef.current = requestAnimationFrame(() => {
          panRafRef.current = null;
          setTransformTick((t) => t + 1);
        });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (dragCanvasRef.current) {
        try {
          dragCanvasRef.current.releasePointerCapture(e.pointerId);
        } catch {}
      }
      dragRef.current = null;
      dragCanvasRef.current = null;
      if (panRafRef.current != null) {
        cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
    };

    canvases.forEach((c) => {
      c.addEventListener("wheel", onWheel, { passive: false });
      c.addEventListener("pointerdown", onDown);
    });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      canvases.forEach((c) => {
        c.removeEventListener("wheel", onWheel);
        c.removeEventListener("pointerdown", onDown);
      });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (panRafRef.current != null) cancelAnimationFrame(panRafRef.current);
    };
  }, [bounds, zoom, modalCanvasEl, layout]);

  // Speed label
  const speedLabel =
    speed === Math.round(speed) ? `${speed}x` : `${speed.toFixed(1)}x`;
  const isDefaultSpeed = Math.abs(speed - SPEED_DEFAULT) < 0.05;

  const renderControls = (inModal: boolean) => (
    <div className="shrink-0 space-y-2">
      {/* Timeline scrubber */}
      <TimelineScrubber
        progressMs={progressMs}
        durationMs={durationMs}
        onSeek={actions.seekTo}
        onDraggingChange={setIsDragging}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Transport */}
        <div className="flex items-center gap-0.5 rounded-xl bg-surface-subtle p-1">
          <ControlBtn
            icon={<SkipBack className="h-3.5 w-3.5" />}
            title="Back 5s"
            onClick={() => actions.nudge(-5000)}
          />
          <ControlBtn
            icon={
              isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )
            }
            title={isPlaying ? "Pause" : "Play"}
            onClick={actions.toggle}
            active={isPlaying}
          />
          <ControlBtn
            icon={<SkipForward className="h-3.5 w-3.5" />}
            title="Forward 5s"
            onClick={() => actions.nudge(5000)}
          />
          <ControlBtn
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            title="Reset"
            onClick={() => {
              actions.reset();
              onReset?.();
            }}
          />
        </div>

        {/* Speed slider */}
        <div className="flex items-center gap-1.5 rounded-xl bg-surface-subtle p-1 pl-2.5">
          <span className="text-[11px] font-medium text-surface-muted-foreground">
            Speed
          </span>
          <Slider
            value={[speed]}
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={0.1}
            onValueChange={([v]) => setSpeed(v)}
            className="w-24"
          />
          <span className="min-w-[2.5rem] text-center text-[11px] font-medium tabular-nums text-surface-muted-foreground">
            {speedLabel}
          </span>
          <ControlBtn
            icon={<RotateCcw className="h-3 w-3" />}
            title="Reset speed to 1×"
            onClick={() => setSpeed(SPEED_DEFAULT)}
            disabled={isDefaultSpeed}
          />
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-0.5 rounded-xl bg-surface-subtle p-1">
          <OptionToggle
            icon={<LineSquiggle className="h-3.5 w-3.5" />}
            label={trailMode === "all" ? "All" : "2s"}
            title={`Trail: ${trailMode === "all" ? "Full path" : "Last 2 seconds"}`}
            onClick={() => setTrailMode((m) => (m === "all" ? "last2" : "all"))}
          />
          <OptionToggle
            icon={<Eye className="h-3.5 w-3.5" />}
            label={autoFollow ? "Follow" : "Static"}
            title={autoFollow ? "Following cursor" : "Static view"}
            active={autoFollow}
            onClick={() => setAutoFollow((f) => !f)}
          />
          <OptionToggle
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
            label={
              clickMode === "none"
                ? "Off"
                : clickMode === "down"
                  ? "Down"
                  : "All"
            }
            title={`Click markers: ${clickMode}`}
            onClick={() =>
              setClickMode((m) =>
                m === "down" ? "all" : m === "all" ? "none" : "down",
              )
            }
          />
          {hasTargetInference && (
            <OptionToggle
              icon={<CircleDot className="h-3.5 w-3.5" />}
              label={showTargetInference ? "Target" : "Target"}
              title={
                showTargetInference
                  ? "Hide target inference"
                  : "Show target inference"
              }
              active={showTargetInference}
              onClick={() => setShowTargetInference((v) => !v)}
            />
          )}
        </div>

        {/* Sync toggle (compare mode only) */}
        {hasCompare && (
          <div className="flex items-center gap-0.5 rounded-xl bg-surface-subtle p-1">
            <OptionToggle
              icon={<Link className="h-3.5 w-3.5" />}
              label={syncByTime ? "Time" : "Ratio"}
              title={
                syncByTime
                  ? "Synced by elapsed time"
                  : "Synced by progress percentage"
              }
              active={syncByTime}
              onClick={() => setSyncByTime((v) => !v)}
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderCanvasOverlay = (traceSet: "primary" | "compare" | "both") => (
    <>
      <div className="absolute right-2 top-2 rounded-lg bg-surface/80 px-2 py-0.5 text-[10px] font-medium text-surface-muted-foreground backdrop-blur">
        {Math.round(zoom * 100)}%
      </div>
      <button
        type="button"
        onClick={() => openModal(traceSet)}
        title="Expand"
        className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-lg bg-surface/80 text-surface-muted-foreground backdrop-blur transition-colors hover:bg-surface hover:text-foreground"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </>
  );

  return (
    <>
      {/* Inline view */}
      <div className="flex h-full flex-col gap-2">
        {isSplit ? (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
            <div className="flex min-h-0 flex-col gap-1">
              <div className="text-[11px] font-medium text-surface-muted-foreground">
                Pinned
              </div>
              <div
                ref={wrapRef}
                className="relative min-h-0 flex-1 rounded-xl bg-surface-subtle"
              >
                <canvas
                  ref={canvasRef}
                  className="block h-full w-full cursor-grab rounded-xl active:cursor-grabbing"
                />
                {renderCanvasOverlay("primary")}
              </div>
            </div>
            <div className="flex min-h-0 flex-col gap-1">
              <div className="text-[11px] font-medium text-surface-muted-foreground">
                Compare
              </div>
              <div
                ref={splitWrapRef}
                className="relative min-h-0 flex-1 rounded-xl bg-surface-subtle"
              >
                <canvas
                  ref={splitCanvasRef}
                  className="block h-full w-full cursor-grab rounded-xl active:cursor-grabbing"
                />
                {renderCanvasOverlay("compare")}
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={wrapRef}
            className="relative min-h-0 flex-1 rounded-xl bg-surface-subtle"
          >
            <canvas
              ref={canvasRef}
              className="block h-full w-full cursor-grab rounded-xl active:cursor-grabbing"
            />
            {hasCompare && <TraceLegend />}
            {renderCanvasOverlay("both")}
          </div>
        )}
        {!modalOpen && renderControls(false)}
      </div>

      {/* Modal view */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalTraceSet === "primary"
            ? "Mouse Trace \u2013 Pinned"
            : modalTraceSet === "compare"
              ? "Mouse Trace \u2013 Compare"
              : "Mouse Trace"
        }
        className="flex flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div
            ref={modalWrapRef}
            className="relative min-h-0 flex-1 rounded-xl bg-surface-subtle"
          >
            <canvas
              ref={modalCanvasCallbackRef}
              className="block h-full w-full cursor-grab rounded-xl active:cursor-grabbing"
            />
            {modalTraceSet === "both" && hasCompare && <TraceLegend />}
            <div className="absolute right-2 top-2 rounded-lg bg-surface/80 px-2 py-0.5 text-[10px] font-medium text-surface-muted-foreground backdrop-blur">
              {Math.round(zoom * 100)}%
            </div>
          </div>
          {renderControls(true)}
        </div>
      </Modal>
    </>
  );
}

/* ─── Timeline scrubber ─── */

function TimelineScrubber({
  progressMs,
  durationMs,
  onSeek,
  onDraggingChange,
}: {
  progressMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  onDraggingChange?: (isDragging: boolean) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const lastSeekPctRef = useRef(0);

  // Only update pct from progressMs if not currently dragging
  const pct = isDragging
    ? lastSeekPctRef.current
    : durationMs > 0
      ? (progressMs / durationMs) * 100
      : 0;

  const handleValueChange = useCallback(
    ([v]: number[]) => {
      lastSeekPctRef.current = v;
      onSeek((v / 100) * durationMs);
    },
    [durationMs, onSeek],
  );

  const handlePointerDown = useCallback(() => {
    setIsDragging(true);
    onDraggingChange?.(true);
  }, [onDraggingChange]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    onDraggingChange?.(false);
  }, [onDraggingChange]);

  const handlePointerLeave = useCallback(() => {
    setIsDragging(false);
    onDraggingChange?.(false);
  }, [onDraggingChange]);

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <Slider
          value={[pct]}
          min={0}
          max={100}
          step={0.1}
          onValueChange={handleValueChange}
        />
      </div>
      <span className="min-w-[6.5rem] text-right font-mono text-[11px] text-surface-muted-foreground">
        {formatTraceTime(progressMs)} / {formatTraceTime(durationMs)}
      </span>
    </div>
  );
}

/* ─── Small UI pieces ─── */

function ControlBtn({
  icon,
  title,
  onClick,
  active,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lg transition-colors",
        disabled
          ? "text-surface-muted-foreground/30 cursor-default"
          : active
            ? "bg-surface-muted text-foreground"
            : "text-surface-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}

function OptionToggle({
  icon,
  label,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <TogglePill
      onClick={onClick}
      title={title}
      active={active}
      className="gap-1"
    >
      {icon}
      {label}
    </TogglePill>
  );
}

function TraceLegend() {
  return (
    <div className="absolute left-2 top-2 flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 rounded-md bg-surface/80 px-2 py-0.5 text-[10px] font-medium backdrop-blur">
        <span className="inline-block h-2 w-2 rounded-full bg-primary" />
        <span className="text-surface-muted-foreground">Pinned</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-md bg-surface/80 px-2 py-0.5 text-[10px] font-medium backdrop-blur">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "var(--trace-compare)" }}
        />
        <span className="text-surface-muted-foreground">Compare</span>
      </div>
    </div>
  );
}
