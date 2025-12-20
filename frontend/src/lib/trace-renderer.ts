import type { MousePoint } from '../types/ipc';
import { clamp, formatMmSs } from './utils';

export type Highlight = { startTs?: number; endTs?: number; color?: string }
export type Marker = { ts: number; color?: string; radius?: number; type?: 'circle' | 'cross' }

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00.00'
  const s = ms / 1000
  return formatMmSs(s, 2)
}

export function lerpRGB(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const b2 = Math.round(a[2] + (b[2] - a[2]) * t)
  return [r, g, b2]
}

export function findPointIndex(points: MousePoint[], targetMs: number): number {
  let lo = 0, hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (points[mid].ts < targetMs) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function getCanvasScale(cssW: number, cssH: number, baseW: number, baseH: number, zoom: number) {
  const pad = 12
  const fitScale = Math.min((cssW - pad * 2) / baseW, (cssH - pad * 2) / baseH) * 0.9
  return fitScale * clamp(zoom, 0.1, 50)
}

export function renderTrace(
  ctx: CanvasRenderingContext2D,
  props: {
    width: number
    height: number
    points: MousePoint[]
    startIdx: number
    endIdx: number
    step: number
    base: any
    zoom: number
    center: { cx: number; cy: number }
    trailMode: 'all' | 'last2'
    clickMarkersMode: 'all' | 'down' | 'none'
    highlight?: Highlight
    markers?: Marker[]
    curT: number
    accentRGB: [number, number, number]
    dangerRGB: [number, number, number]
    startPointColor: string
    endPointColor: string
    highlightColor: string
    markerColor: string
    markerBorder: string
    trailFill: string
    trailStroke: string
  }
) {
  const {
    width, height, points, startIdx, endIdx, step, base, zoom, center, trailMode, clickMarkersMode,
    highlight, markers, curT, accentRGB, dangerRGB, startPointColor, endPointColor,
    highlightColor, markerColor, markerBorder, trailFill, trailStroke
  } = props
  const srcW = base.w
  const srcH = base.h
  const scale = getCanvasScale(width, height, srcW, srcH, zoom)
  const screenCX = width / 2
  const screenCY = height / 2
  const { cx, cy } = center
  const toX = (x: number) => screenCX + (x - cx) * scale
  const toY = (y: number) => screenCY + (y - cy) * scale

  // bounding box (zooms together with trace)
  ctx.fillStyle = trailFill
  const ox = (base as any).minX ?? 0
  const oy = (base as any).minY ?? 0
  const bx0 = toX(ox)
  const by0 = toY(oy)
  const bx1 = toX(ox + srcW)
  const by1 = toY(oy + srcH)
  const rx = Math.min(bx0, bx1),
    ry = Math.min(by0, by1)
  const rw = Math.abs(bx1 - bx0),
    rh = Math.abs(by1 - by0)
  ctx.fillRect(rx, ry, rw, rh)
  ctx.strokeStyle = trailStroke
  ctx.strokeRect(rx, ry, rw, rh)

  // draw path with gradient and optional fade within last2 mode
  const count = Math.max(0, endIdx - startIdx)
  if (count >= 2) {
    const showLast2 = trailMode === 'last2'
    const tailStart = curT - 2000
    const segs = Math.ceil(count / step)
    let prev = points[startIdx]
    let drawnCount = 0
    const pad = 50 // pixel padding for culling

    for (let i = startIdx + step; i < endIdx; i += step) {
      const p = points[i]

      // Culling: Check if segment is visible
      const x1 = toX(prev.x)
      const y1 = toY(prev.y)
      const x2 = toX(p.x)
      const y2 = toY(p.y)

      if (
        (x1 < -pad && x2 < -pad) ||
        (x1 > width + pad && x2 > width + pad) ||
        (y1 < -pad && y2 < -pad) ||
        (y1 > height + pad && y2 > height + pad)
      ) {
        prev = p
        drawnCount++
        continue
      }

      let t = drawnCount / segs // 0..1 along drawn segment
      let alpha = 0.9
      if (showLast2) {
        const pt = p.ts
        const denom = Math.max(1, curT - tailStart)
        const ageT = clamp((pt - tailStart) / denom, 0, 1)
        t = ageT
        alpha = 0.15 + 0.85 * Math.pow(ageT, 1.1)
      }
      const [r, g, b] = lerpRGB(accentRGB, dangerRGB, t)
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      prev = p
      drawnCount++
    }
    // Ensure last segment connects to the very last point if we skipped it
    const lastP = points[endIdx - 1]
    if (prev !== lastP) {
      const p = lastP
      const x1 = toX(prev.x)
      const y1 = toY(prev.y)
      const x2 = toX(p.x)
      const y2 = toY(p.y)

      // Only draw if visible
      if (!(
        (x1 < -pad && x2 < -pad) ||
        (x1 > width + pad && x2 > width + pad) ||
        (y1 < -pad && y2 < -pad) ||
        (y1 > height + pad && y2 > height + pad)
      )) {
        let t = 1
        let alpha = 0.9
        if (showLast2) {
          const pt = p.ts
          const denom = Math.max(1, curT - tailStart)
          const ageT = clamp((pt - tailStart) / denom, 0, 1)
          t = ageT
          alpha = 0.15 + 0.85 * Math.pow(ageT, 1.1)
        }
        const [r, g, b] = lerpRGB(accentRGB, dangerRGB, t)
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
    }
  }

  // draw endpoints (always draw the latest point; draw start if we have at least 2 points)
  if (count >= 1) {
    const first = points[startIdx]
    const last = points[endIdx - 1]
    if (trailMode === 'all' && count >= 2) {
      ctx.fillStyle = startPointColor
      ctx.beginPath()
      ctx.arc(toX(first.x), toY(first.y), 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = endPointColor
    ctx.beginPath()
    ctx.arc(toX(last.x), toY(last.y), 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Draw left-click press/release markers (white, smaller).
  if (count >= 1 && clickMarkersMode !== 'none') {
    let prevLeft = ((points[startIdx].buttons ?? 0) & 1) !== 0
    if (prevLeft && (clickMarkersMode === 'all' || clickMarkersMode === 'down')) {
      drawMarker(ctx, toX(points[startIdx].x), toY(points[startIdx].y), true, markerColor, markerBorder)
    }
    for (let i = startIdx + 1; i < endIdx; i++) {
      const p = points[i]
      const curLeft = ((p.buttons ?? 0) & 1) !== 0
      if (curLeft !== prevLeft) {
        if (clickMarkersMode === 'all' || (clickMarkersMode === 'down' && curLeft)) {
          drawMarker(ctx, toX(p.x), toY(p.y), curLeft, markerColor, markerBorder)
        }
      }
      prevLeft = curLeft
    }
  }

  // Highlight overlay for selected segment
  if (highlight && (highlight.startTs || highlight.endTs)) {
    const hStartMs = highlight.startTs ?? points[0].ts
    const hEndMs = highlight.endTs ?? points[points.length - 1].ts
    if (Number.isFinite(hStartMs) && Number.isFinite(hEndMs)) {
      const i0 = Math.max(0, Math.min(points.length - 1, findPointIndex(points, hStartMs)))
      const i1 = Math.max(0, Math.min(points.length - 1, findPointIndex(points, hEndMs)))
      if (i1 > i0) {
        ctx.lineWidth = 2
        ctx.strokeStyle = highlight.color || highlightColor
        ctx.beginPath()
        ctx.moveTo(toX(points[i0].x), toY(points[i0].y))
        for (let i = i0 + 1; i <= i1; i++) {
          ctx.lineTo(toX(points[i].x), toY(points[i].y))
        }
        ctx.stroke()
        ctx.lineWidth = 1
      }
    }
  }

  // Draw optional external markers
  if (Array.isArray(markers) && markers.length > 0) {
    for (const m of markers) {
      const ms = m.ts
      const i = Math.max(0, Math.min(points.length - 1, findPointIndex(points, ms)))
      const sx = toX(points[i].x)
      const sy = toY(points[i].y)
      const col = m.color || markerColor
      const borderCol = markerBorder
      const r = m.radius ?? 3
      if (m.type === 'cross') {
        ctx.strokeStyle = col
        ctx.beginPath()
        ctx.moveTo(sx - r, sy)
        ctx.lineTo(sx + r, sy)
        ctx.moveTo(sx, sy - r)
        ctx.lineTo(sx, sy + r)
        ctx.stroke()
      } else {
        ctx.strokeStyle = borderCol
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, pressed: boolean, color: string, border: string) {
  const col = color || 'rgba(255,255,255,0.95)'
  const borderCol = border || 'rgba(0,0,0,0.12)'
  if (pressed) {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = borderCol
    ctx.lineWidth = 1
    ctx.stroke()
  } else {
    ctx.strokeStyle = col
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.stroke()
  }
}
