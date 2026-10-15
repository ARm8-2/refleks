import { describe, expect, it, vi } from "vitest";
import type { MousePoint } from "@/shared/types";
import {
  computeBounds,
  computeMergedBounds,
  findPointIndex,
  fitScale,
  formatTraceTime,
  renderTrace,
  type RenderOpts,
} from "./traceRenderer";

const points: MousePoint[] = [
  { ts: 0, x: 0, y: 0, buttons: 0 },
  { ts: 1_000, x: 50, y: 50, buttons: 1 },
  { ts: 2_000, x: 100, y: 100, buttons: 0 },
];

function makeContext() {
  return {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & {
    fillRect: ReturnType<typeof vi.fn>;
    strokeRect: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    arc: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
}

function makeRenderOpts(overrides: Partial<RenderOpts> = {}): RenderOpts {
  return {
    width: 200,
    height: 200,
    points,
    startIdx: 0,
    endIdx: points.length,
    step: 1,
    bounds: { w: 100, h: 100, minX: 0, minY: 0, cx: 50, cy: 50 },
    zoom: 1,
    center: { cx: 50, cy: 50 },
    trailMode: "all",
    clickMode: "all",
    curT: 2_000,
    colors: {
      accentRGB: [0, 0, 255],
      dangerRGB: [255, 0, 0],
      startPoint: "green",
      endPoint: "white",
      marker: "yellow",
      markerBorder: "black",
      boxFill: "gray",
      boxStroke: "silver",
    },
    ...overrides,
  };
}

describe("traceRenderer helpers", () => {
  it("finds the first point at or after the requested timestamp", () => {
    expect(findPointIndex(points, -1)).toBe(0);
    expect(findPointIndex(points, 1_000)).toBe(1);
    expect(findPointIndex(points, 1_001)).toBe(2);
    expect(findPointIndex(points, 5_000)).toBe(2);
    expect(findPointIndex([], 5_000)).toBe(0);
  });

  it("fits the trace inside the padded canvas and clamps zoom", () => {
    expect(fitScale(200, 100, 100, 50, 1)).toBeCloseTo(1.368);
    expect(fitScale(200, 100, 100, 50, 0)).toBeCloseTo(0.1368);
    expect(fitScale(200, 100, 100, 50, 100)).toBeCloseTo(68.4);
  });

  it("formats elapsed time and treats invalid or non-positive values as zero", () => {
    expect(formatTraceTime(61_250)).toBe("1:01.3");
    expect(formatTraceTime(9_600)).toBe("0:09.6");
    expect(formatTraceTime(0)).toBe("0:00.0");
    expect(formatTraceTime(-1)).toBe("0:00.0");
    expect(formatTraceTime(Number.NaN)).toBe("0:00.0");
  });

  it("calculates point bounds, uses valid screen resolution, and handles empty traces", () => {
    expect(computeBounds([])).toEqual({
      w: 1,
      h: 1,
      minX: 0,
      minY: 0,
      cx: 0.5,
      cy: 0.5,
    });
    expect(
      computeBounds([
        { ts: 0, x: -10, y: 4 },
        { ts: 1, x: 20, y: 54 },
      ]),
    ).toEqual({
      w: 30,
      h: 50,
      minX: -10,
      minY: 4,
      cx: 5,
      cy: 29,
    });
    expect(computeBounds(points, "1920x1080")).toEqual({
      w: 1920,
      h: 1080,
      minX: 0,
      minY: 0,
      cx: 960,
      cy: 540,
    });
    expect(computeBounds(points, "invalid resolution")).toEqual({
      w: 100,
      h: 100,
      minX: 0,
      minY: 0,
      cx: 50,
      cy: 50,
    });
  });

  it("merges bounds from two traces into one shared coordinate space", () => {
    expect(
      computeMergedBounds(
        { w: 10, h: 20, minX: 1, minY: 2, cx: 6, cy: 12 },
        { w: 12, h: 8, minX: -5, minY: -6, cx: 1, cy: -2 },
      ),
    ).toEqual({ w: 16, h: 28, minX: -5, minY: -6, cx: 3, cy: 8 });
  });
});

describe("renderTrace", () => {
  it("draws the trace, its bounds and endpoints, while allowing the box to be hidden", () => {
    const ctx = makeContext();
    renderTrace(ctx, makeRenderOpts());

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(3);
    expect(ctx.arc).toHaveBeenCalledTimes(4);
    expect(ctx.fill).toHaveBeenCalledTimes(3);

    const noBoxContext = makeContext();
    renderTrace(
      noBoxContext,
      makeRenderOpts({ drawBox: false, clickMode: "none" }),
    );
    expect(noBoxContext.fillRect).not.toHaveBeenCalled();
    expect(noBoxContext.strokeRect).not.toHaveBeenCalled();
    expect(noBoxContext.arc).toHaveBeenCalledTimes(2);
  });

  it("renders target and highlight overlays and draws click-down markers only in down mode", () => {
    const ctx = makeContext();
    renderTrace(
      ctx,
      makeRenderOpts({
        drawBox: false,
        clickMode: "down",
        targetFrame: { x: 50, y: 50, radius: 2, alpha: 0.5 },
        highlight: { startTs: 0, endTs: 1_000, color: "orange" },
      }),
    );

    // Two endpoints, one target marker, two highlight markers, the highlight
    // outline, and one mouse-down marker. Mouse-up is omitted in "down" mode.
    expect(ctx.arc).toHaveBeenCalledTimes(7);
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it("draws both mouse button transitions in all mode and none in none mode", () => {
    const allContext = makeContext();
    renderTrace(
      allContext,
      makeRenderOpts({ drawBox: false, clickMode: "all" }),
    );
    expect(allContext.arc).toHaveBeenCalledTimes(4);

    const noneContext = makeContext();
    renderTrace(
      noneContext,
      makeRenderOpts({ drawBox: false, clickMode: "none" }),
    );
    expect(noneContext.arc).toHaveBeenCalledTimes(2);
  });

  it("fades the last-two-seconds trail toward the current position", () => {
    const ctx = makeContext();
    renderTrace(
      ctx,
      makeRenderOpts({ drawBox: false, clickMode: "none", trailMode: "last2" }),
    );

    expect(ctx.strokeStyle).toBe("rgba(255,0,0,1)");
  });
});
