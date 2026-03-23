import type { MousePoint } from '@/shared/types/ipc'

/* ─── Types ─── */

export type TrailMode = 'all' | 'last2'
export type ClickMode = 'all' | 'down' | 'none'

export type TraceBounds = {
  w: number
  h: number
  minX: number
  minY: number
  cx: number
  cy: number
}

export type TraceHighlight = {
  startTs: number
  endTs: number
  color: string
}

export type RenderOpts = {
  width: number
  height: number
  points: MousePoint[]
  startIdx: number
  endIdx: number
  step: number
  bounds: TraceBounds
  zoom: number
  center: { cx: number; cy: number }
  trailMode: TrailMode
  clickMode: ClickMode
  curT: number
  colors: TraceColors
  drawBox?: boolean
  highlight?: TraceHighlight
}

export type TraceColors = {
  accentRGB: [number, number, number]
  dangerRGB: [number, number, number]
  startPoint: string
  endPoint: string
  marker: string
  markerBorder: string
  boxFill: string
  boxStroke: string
}

/* ─── Helpers ─── */

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function lerpRGB(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/** Binary-search for the first point whose ts ≥ targetMs. */
export function findPointIndex(points: MousePoint[], targetMs: number): number {
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (points[mid].ts < targetMs) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Fit scale: maps data coords → CSS pixels with padding. */
export function fitScale(cssW: number, cssH: number, dataW: number, dataH: number, zoom: number): number {
  const pad = 12
  const s = Math.min((cssW - pad * 2) / dataW, (cssH - pad * 2) / dataH) * 0.9
  return s * clamp(zoom, 0.1, 50)
}

export function formatTraceTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00.0'
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const s = totalSec - m * 60
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`
}

/* ─── Compute bounds from points + optional screen resolution ─── */

export function computeBounds(points: MousePoint[], resolution?: string): TraceBounds {
  if (points.length === 0) return { w: 1, h: 1, minX: 0, minY: 0, cx: 0.5, cy: 0.5 }

  let minX = points[0].x, maxX = points[0].x
  let minY = points[0].y, maxY = points[0].y
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const dataW = Math.max(1, maxX - minX)
  const dataH = Math.max(1, maxY - minY)

  if (resolution) {
    const m = resolution.match(/(\d+)x(\d+)/)
    if (m) {
      const w = Number(m[1])
      const h = Number(m[2])
      if (w > 0 && h > 0 && minX >= 0 && minY >= 0 && maxX <= w && maxY <= h) {
        return { w, h, minX: 0, minY: 0, cx: w / 2, cy: h / 2 }
      }
    }
  }

  return { w: dataW, h: dataH, minX, minY, cx: minX + dataW / 2, cy: minY + dataH / 2 }
}

export function computeMergedBounds(a: TraceBounds, b: TraceBounds): TraceBounds {
  const minX = Math.min(a.minX, b.minX)
  const minY = Math.min(a.minY, b.minY)
  const maxX = Math.max(a.minX + a.w, b.minX + b.w)
  const maxY = Math.max(a.minY + a.h, b.minY + b.h)
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  return { w, h, minX, minY, cx: minX + w / 2, cy: minY + h / 2 }
}

/* ─── Main render ─── */

export function renderTrace(ctx: CanvasRenderingContext2D, opts: RenderOpts) {
  const {
    width, height, points, startIdx, endIdx, step,
    bounds, zoom, center, trailMode, clickMode, curT, colors, drawBox,
  } = opts

  const scale = fitScale(width, height, bounds.w, bounds.h, zoom)
  const scrCX = width / 2
  const scrCY = height / 2
  const { cx, cy } = center
  const toX = (x: number) => scrCX + (x - cx) * scale
  const toY = (y: number) => scrCY + (y - cy) * scale

  // ── Bounding box ──
  if (drawBox !== false) {
    ctx.fillStyle = colors.boxFill
    const bx0 = toX(bounds.minX)
    const by0 = toY(bounds.minY)
    const bx1 = toX(bounds.minX + bounds.w)
    const by1 = toY(bounds.minY + bounds.h)
    const rx = Math.min(bx0, bx1)
    const ry = Math.min(by0, by1)
    const rw = Math.abs(bx1 - bx0)
    const rh = Math.abs(by1 - by0)
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = colors.boxStroke
    ctx.strokeRect(rx, ry, rw, rh)
  }

  // ── Path segments ──
  const count = Math.max(0, endIdx - startIdx)
  if (count >= 2) {
    const showLast2 = trailMode === 'last2'
    const tailStart = curT - 2000
    const segs = Math.ceil(count / step)
    const pad = 50
    let prev = points[startIdx]
    let drawn = 0

    for (let i = startIdx + step; i < endIdx; i += step) {
      const p = points[i]
      const x1 = toX(prev.x), y1 = toY(prev.y)
      const x2 = toX(p.x), y2 = toY(p.y)

      // Frustum culling
      if (
        (x1 < -pad && x2 < -pad) || (x1 > width + pad && x2 > width + pad) ||
        (y1 < -pad && y2 < -pad) || (y1 > height + pad && y2 > height + pad)
      ) { prev = p; drawn++; continue }

      let t = drawn / segs
      let alpha = 0.9
      if (showLast2) {
        const denom = Math.max(1, curT - tailStart)
        const ageT = clamp((p.ts - tailStart) / denom, 0, 1)
        t = ageT
        alpha = 0.15 + 0.85 * ageT ** 1.1
      }
      const [r, g, b] = lerpRGB(colors.accentRGB, colors.dangerRGB, t)
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      prev = p
      drawn++
    }

    // Ensure last segment
    const lastP = points[endIdx - 1]
    if (prev !== lastP) {
      const x1 = toX(prev.x), y1 = toY(prev.y)
      const x2 = toX(lastP.x), y2 = toY(lastP.y)
      if (!(
        (x1 < -pad && x2 < -pad) || (x1 > width + pad && x2 > width + pad) ||
        (y1 < -pad && y2 < -pad) || (y1 > height + pad && y2 > height + pad)
      )) {
        let t = 1, alpha = 0.9
        if (showLast2) {
          const denom = Math.max(1, curT - tailStart)
          const ageT = clamp((lastP.ts - tailStart) / denom, 0, 1)
          t = ageT; alpha = 0.15 + 0.85 * ageT ** 1.1
        }
        const [r, g, b] = lerpRGB(colors.accentRGB, colors.dangerRGB, t)
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      }
    }
  }

  // ── Endpoints ──
  if (count >= 1) {
    const first = points[startIdx]
    const last = points[endIdx - 1]
    if (trailMode === 'all' && count >= 2) {
      ctx.fillStyle = colors.startPoint
      ctx.beginPath(); ctx.arc(toX(first.x), toY(first.y), 2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = colors.endPoint
    ctx.beginPath(); ctx.arc(toX(last.x), toY(last.y), 2, 0, Math.PI * 2); ctx.fill()
  }

  // ── Highlight overlay ──
  if (opts.highlight && count >= 2) {
    const hStart = findPointIndex(points, opts.highlight.startTs)
    const hEnd = Math.min(findPointIndex(points, opts.highlight.endTs) + 1, endIdx)
    if (hEnd > hStart) {
      ctx.lineWidth = 3
      ctx.strokeStyle = opts.highlight.color
      ctx.globalAlpha = 0.85
      let prev = points[hStart]
      for (let i = hStart + 1; i < hEnd; i++) {
        const p = points[i]
        ctx.beginPath()
        ctx.moveTo(toX(prev.x), toY(prev.y))
        ctx.lineTo(toX(p.x), toY(p.y))
        ctx.stroke()
        prev = p
      }
      // Markers at start and end of highlight
      ctx.globalAlpha = 1
      ctx.fillStyle = opts.highlight.color
      // Small dot at start
      ctx.beginPath()
      ctx.arc(toX(points[hStart].x), toY(points[hStart].y), 3, 0, Math.PI * 2)
      ctx.fill()
      // Larger kill marker at end (the kill point)
      const killPt = points[Math.min(hEnd - 1, points.length - 1)]
      ctx.beginPath()
      ctx.arc(toX(killPt.x), toY(killPt.y), 5, 0, Math.PI * 2)
      ctx.fill()
      // White outline on kill marker for visibility
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(toX(killPt.x), toY(killPt.y), 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
    }
  }

  // ── Click markers ──
  if (count >= 1 && clickMode !== 'none') {
    let prevLeft = ((points[startIdx].buttons ?? 0) & 1) !== 0
    if (prevLeft && (clickMode === 'all' || clickMode === 'down')) {
      drawClick(ctx, toX(points[startIdx].x), toY(points[startIdx].y), true, colors.marker, colors.markerBorder)
    }
    for (let i = startIdx + 1; i < endIdx; i++) {
      const p = points[i]
      const cur = ((p.buttons ?? 0) & 1) !== 0
      if (cur !== prevLeft) {
        if (clickMode === 'all' || (clickMode === 'down' && cur)) {
          drawClick(ctx, toX(p.x), toY(p.y), cur, colors.marker, colors.markerBorder)
        }
      }
      prevLeft = cur
    }
  }
}

function drawClick(ctx: CanvasRenderingContext2D, x: number, y: number, isDown: boolean, fill: string, stroke: string) {
  const r = isDown ? 3 : 2
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}
