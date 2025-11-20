import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePageState } from '../../hooks/usePageState';
import { formatMmSs } from '../../lib/utils';
import type { Point } from '../../types/ipc';
import { Dropdown } from '../shared/Dropdown';
import { SegmentedControl } from '../shared/SegmentedControl';
import { Toggle } from '../shared/Toggle';

type Highlight = { startTs?: any; endTs?: any; color?: string }
type Marker = { ts: any; color?: string; radius?: number; type?: 'circle' | 'cross' }

type TraceViewerProps = {
  points: Point[]
  stats: Record<string, any>
  highlight?: Highlight
  markers?: Marker[]
  seekToTs?: any
  centerOnTs?: any
  onReset?: () => void
}

export function TraceViewer({ points, stats, highlight, markers, seekToTs, centerOnTs, onReset }: TraceViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number>(0)
  const virtualElapsedRef = useRef<number>(0)
  const baseStartRef = useRef<number>(0)
  const curIndexRef = useRef<number>(0)
  const centerRef = useRef<{ cx: number; cy: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const panRafRef = useRef<number | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState<number>(points.length)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const playbackSpeedRef = useRef<number>(1)
  useEffect(() => { playbackSpeedRef.current = playbackSpeed }, [playbackSpeed])

  const [zoom, setZoom] = usePageState<number>('trace:zoom', 1)
  const [trailMode, setTrailMode] = usePageState<'all' | 'last2'>('trace:trailMode', 'all')
  const [transformTick, setTransformTick] = useState(0)
  const [autoFollow, setAutoFollow] = usePageState<boolean>('trace:autoFollow', false)
  const autoFollowRef = useRef<boolean>(false)

  useEffect(() => {
    autoFollowRef.current = autoFollow
  }, [autoFollow])

  const [clickMarkersMode, setClickMarkersMode] = usePageState<'all' | 'down' | 'none'>('trace:clickMarkers', 'down')

  // Normalize points once to avoid repeated tsMs calls
  const normalizedPoints = useMemo(() => points.map(p => ({ ...p, ts: tsMs(p.ts) })), [points])

  // Base data bounds/resolution
  const base = useMemo(() => {
    if (normalizedPoints.length === 0) return { w: 1, h: 1, minX: 0, minY: 0, cx: 0.5, cy: 0.5 }
    let minX = normalizedPoints[0].x,
      maxX = normalizedPoints[0].x,
      minY = normalizedPoints[0].y,
      maxY = normalizedPoints[0].y
    for (const p of normalizedPoints) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const dataW = Math.max(1, maxX - minX)
    const dataH = Math.max(1, maxY - minY)
    const r = String(stats?.Resolution || stats?.resolution || '')
    const m = r.match(/(\d+)x(\d+)/)
    if (m) {
      const w = parseInt(m[1], 10)
      const h = parseInt(m[2], 10)
      if (w > 0 && h > 0) {
        const within = minX >= 0 && minY >= 0 && maxX <= w && maxY <= h
        if (within) return { w, h, minX: 0, minY: 0, cx: w / 2, cy: h / 2 }
      }
    }
    return { w: dataW, h: dataH, minX, minY, cx: minX + dataW / 2, cy: minY + dataH / 2 }
  }, [normalizedPoints, stats])

  const firstTS = normalizedPoints[0]?.ts
  const lastTS = normalizedPoints[normalizedPoints.length - 1]?.ts
  const t0 = firstTS || 0
  const tN = lastTS || 0
  const durationMs = Math.max(0, tN - t0)

  // Reset when points change
  useEffect(() => {
    stopAnim()
    setIsPlaying(false)
    setPlayIndex(normalizedPoints.length)
    curIndexRef.current = 0
    virtualElapsedRef.current = 0
    baseStartRef.current = 0
    setZoom(1)
    centerRef.current = { cx: (base as any).cx ?? 0, cy: (base as any).cy ?? 0 }
  }, [normalizedPoints])

  // External seek
  useEffect(() => {
    if (seekToTs == null || normalizedPoints.length === 0) return
    const abs = tsMs(seekToTs)
    if (!Number.isFinite(abs)) return
    const i = findPointIndex(normalizedPoints, abs)
    curIndexRef.current = i
    setPlayIndex(i)
    if (autoFollowRef.current) {
      const p = normalizedPoints[Math.max(0, Math.min(normalizedPoints.length - 1, i))]
      if (p) centerRef.current = { cx: p.x, cy: p.y }
    }
  }, [seekToTs])

  // External center
  useEffect(() => {
    if (centerOnTs == null || normalizedPoints.length === 0) return
    const abs = tsMs(centerOnTs)
    if (!Number.isFinite(abs)) return
    const i = Math.max(0, Math.min(normalizedPoints.length - 1, findPointIndex(normalizedPoints, abs)))
    const p = normalizedPoints[i]
    centerRef.current = { cx: p.x, cy: p.y }
    setTransformTick(t => t + 1)
  }, [centerOnTs])

  // Playback
  const play = () => {
    if (isPlaying || normalizedPoints.length < 2) return
    setIsPlaying(true)
    lastFrameTimeRef.current = performance.now()
    const curIdx = Math.max(0, Math.min(normalizedPoints.length - 1, playIndex))
    curIndexRef.current = curIdx
    baseStartRef.current = normalizedPoints[curIdx]?.ts || t0
    virtualElapsedRef.current = 0
    rafRef.current = requestAnimationFrame(tick)
  }
  const pause = () => {
    setIsPlaying(false)
    stopAnim()
  }
  const reset = () => {
    setIsPlaying(false)
    stopAnim()
    curIndexRef.current = normalizedPoints.length
    setPlayIndex(normalizedPoints.length)
    centerRef.current = { cx: (base as any).cx ?? 0, cy: (base as any).cy ?? 0 }
    // Notify parent so it can clear any selection/highlight
    try { onReset && onReset() } catch { }
  }
  function stopAnim() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }
  function tick() {
    const now = performance.now()
    const dt = now - lastFrameTimeRef.current
    lastFrameTimeRef.current = now
    virtualElapsedRef.current += dt * playbackSpeedRef.current

    const targetTs = baseStartRef.current + virtualElapsedRef.current
    let i = curIndexRef.current
    while (i < normalizedPoints.length && normalizedPoints[i].ts <= targetTs) i++
    curIndexRef.current = i
    setPlayIndex(i)
    if (autoFollowRef.current) {
      const followIdx = Math.max(0, Math.min(normalizedPoints.length - 1, i - 1))
      const p = normalizedPoints[followIdx]
      if (p) centerRef.current = { cx: p.x, cy: p.y }
    }
    if (targetTs >= tN || i >= normalizedPoints.length) {
      // Loop playback back to the start
      curIndexRef.current = 0
      setPlayIndex(0)
      baseStartRef.current = normalizedPoints[0]?.ts || t0
      virtualElapsedRef.current = 0
      lastFrameTimeRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || normalizedPoints.length === 0) return
    const dpr = window.devicePixelRatio || 1
    const cssW = Math.max(320, wrap.clientWidth)
    const cssH = Math.max(240, Math.min(450, Math.round(cssW * 9 / 16)))
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    // Calculate visible range
    const max = 20000
    const idx = Math.max(0, Math.min(playIndex, normalizedPoints.length - 1))
    const curT = normalizedPoints[idx].ts
    let startIdx = 0
    let endIdx = Math.min(playIndex, normalizedPoints.length)
    let step = 1

    if (trailMode === 'last2') {
      const tailStart = curT - 2000
      startIdx = findPointIndex(normalizedPoints, tailStart)
      endIdx = Math.min(playIndex, normalizedPoints.length)
    }

    const count = Math.max(1, endIdx - startIdx)
    if (count > max) {
      step = Math.ceil(count / max)
    }

    renderTrace(ctx, {
      width: cssW,
      height: cssH,
      points: normalizedPoints,
      startIdx,
      endIdx,
      step,
      base,
      zoom,
      center: centerRef.current || { cx: 0, cy: 0 },
      trailMode,
      clickMarkersMode,
      highlight,
      markers,
      curT
    })
  }, [normalizedPoints, playIndex, trailMode, base, zoom, transformTick, clickMarkersMode, highlight, markers])

  // Events: resize
  useEffect(() => {
    const draw = () => {
      const c = canvasRef.current
      if (!c) return
      // trigger redraw on resize
      setTransformTick((t) => t + 1)
    }
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  // Wheel zoom: only when hovering inside the drawn bounding box (not the whole canvas/wrapper)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const cssW = rect.width
      const cssH = rect.height

      // Reconstruct the same transform used in the draw effect
      const srcW = base.w
      const srcH = base.h
      const scale = getCanvasScale(cssW, cssH, srcW, srcH, zoom)
      const fitScale = getCanvasScale(cssW, cssH, srcW, srcH, 1)
      const screenCX = cssW / 2
      const screenCY = cssH / 2
      if (!centerRef.current) centerRef.current = { cx: (base as any).cx ?? 0, cy: (base as any).cy ?? 0 }
      const { cx, cy } = centerRef.current

      const ox = (base as any).minX ?? 0
      const oy = (base as any).minY ?? 0
      const bx0 = screenCX + (ox - cx) * scale
      const by0 = screenCY + (oy - cy) * scale
      const bx1 = screenCX + (ox + srcW - cx) * scale
      const by1 = screenCY + (oy + srcH - cy) * scale
      const rx = Math.min(bx0, bx1)
      const ry = Math.min(by0, by1)
      const rw = Math.abs(bx1 - bx0)
      const rh = Math.abs(by1 - by0)

      // If mouse is outside the visible bounding box, ignore the wheel (fall through to page scroll)
      if (mx < rx || mx > rx + rw || my < ry || my > ry + rh) {
        return
      }

      e.preventDefault()

      const oldScale = scale
      const newZoom = clamp(zoom * Math.pow(1.001, -e.deltaY), 0.1, 50)
      const newScale = fitScale * newZoom

      // Zoom towards cursor position within the box
      const dataX = cx + (mx - screenCX) / oldScale
      const dataY = cy + (my - screenCY) / oldScale
      const newCx = dataX - (mx - screenCX) / newScale
      const newCy = dataY - (my - screenCY) / newScale
      centerRef.current = { cx: newCx, cy: newCy }
      setZoom(newZoom)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel as any)
  }, [zoom, base])

  // Drag pan
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      dragRef.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      dragRef.current = null
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch { }
      if (panRafRef.current != null) {
        cancelAnimationFrame(panRafRef.current)
        panRafRef.current = null
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const prev = dragRef.current
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      dragRef.current = { x: e.clientX, y: e.clientY }
      const rect = canvas.getBoundingClientRect()
      const cssW = rect.width
      const cssH = rect.height
      const scale = getCanvasScale(cssW, cssH, base.w, base.h, zoom)
      if (!centerRef.current) centerRef.current = { cx: (base as any).cx ?? 0, cy: (base as any).cy ?? 0 }
      centerRef.current = { cx: centerRef.current.cx - dx / scale, cy: centerRef.current.cy - dy / scale }
      // throttle redraw to animation frames so panning is visible while paused
      if (panRafRef.current == null) {
        panRafRef.current = requestAnimationFrame(() => {
          panRafRef.current = null
          setTransformTick((t) => t + 1)
        })
      }
    }
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointermove', onMove)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointermove', onMove)
      if (panRafRef.current != null) {
        cancelAnimationFrame(panRafRef.current)
        panRafRef.current = null
      }
    }
  }, [base, zoom])

  // Scrub & nudge
  const curTs = points[Math.max(0, Math.min(playIndex, points.length - 1))]?.ts
  const curAbsMs = tsMs(curTs) || 0
  const startAbsMs = tsMs(firstTS) || 0
  const progressMs = Math.max(0, curAbsMs - startAbsMs)

  const seekTo = (targetMs: number) => {
    const abs = startAbsMs + clamp(targetMs, 0, durationMs)
    const i = findPointIndex(points, abs)
    curIndexRef.current = i
    setPlayIndex(i)
    if (isPlaying) {
      baseStartRef.current = tsMs(points[i]?.ts) || startAbsMs
      virtualElapsedRef.current = 0
      lastFrameTimeRef.current = performance.now()
    }
    if (autoFollowRef.current) {
      const followIdx = Math.max(0, Math.min(points.length - 1, i - 1))
      const p = points[followIdx]
      if (p) centerRef.current = { cx: p.x, cy: p.y }
    }
  }
  const nudge = (deltaMs: number) => seekTo(progressMs + deltaMs)

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="w-full">
        <canvas
          ref={canvasRef}
          className="w-full h-[360px] block rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)]"
        />
      </div>

      {/* Controls under the panel */}
      <div className="flex flex-col gap-3">
        {/* Scrub bar */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(1, durationMs)}
            step={16}
            value={progressMs}
            onChange={(e) => seekTo(Number((e.target as HTMLInputElement).value))}
            className="w-full accent-[var(--text-primary)] appearance-none h-2 rounded bg-[var(--bg-tertiary)]"
          />
          <span className="text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap">
            {fmtTime(progressMs)} / {fmtTime(durationMs)}
          </span>
        </div>

        {/* Playback + options */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 bg-[var(--bg-tertiary)]/60 border border-[var(--border-primary)] rounded-full px-2 py-1">
            <button onClick={() => nudge(-5000)} title="Back 5s" className="h-8 w-8 grid place-items-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
              <SkipBack size={16} />
            </button>
            <button onClick={isPlaying ? pause : play} title={isPlaying ? 'Pause' : 'Play'} className="h-8 w-8 grid place-items-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button onClick={() => nudge(5000)} title="Forward 5s" className="h-8 w-8 grid place-items-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
              <SkipForward size={16} />
            </button>
            <button
              onClick={reset}
              title="Reset"
              className="h-8 w-8 grid place-items-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Dropdown
              label="Speed"
              value={String(playbackSpeed)}
              onChange={(v) => setPlaybackSpeed(Number(v))}
              options={[
                { label: '0.25x', value: '0.25' },
                { label: '0.5x', value: '0.5' },
                { label: '1x', value: '1' },
                { label: '2x', value: '2' },
              ]}
            />
            <span>Trail:</span>
            <SegmentedControl
              options={[
                { label: 'Last 2s', value: 'last2' },
                { label: 'All', value: 'all' },
              ]}
              value={trailMode}
              onChange={(v: 'all' | 'last2') => setTrailMode(v)}
            />
            <Toggle
              label="Follow"
              checked={autoFollow}
              onChange={(v: boolean) => setAutoFollow(v)}
            />
            <Dropdown
              label="Clicks"
              value={clickMarkersMode}
              onChange={(v: string) => setClickMarkersMode(v as 'all' | 'down' | 'none')}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Down only', value: 'down' },
                { label: 'None', value: 'none' },
              ]}
            />
            <span className="hidden sm:inline">Zoom: {Math.round(zoom * 100)}%</span>
            <span>Samples: <b className="text-[var(--text-primary)]">{points.length.toLocaleString()}</b></span>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- helpers ---
function tsMs(v: any): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const n = Date.parse(String(v))
  return Number.isFinite(n) ? n : 0
}

function fmtTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00.00'
  const s = ms / 1000
  return formatMmSs(s, 2)
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function lerpRGB(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const b2 = Math.round(a[2] + (b[2] - a[2]) * t)
  return [r, g, b2]
}

function findPointIndex(points: Point[], targetMs: number): number {
  let lo = 0, hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (tsMs(points[mid].ts) < targetMs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function getCanvasScale(cssW: number, cssH: number, baseW: number, baseH: number, zoom: number) {
  const pad = 12
  const fitScale = Math.min((cssW - pad * 2) / baseW, (cssH - pad * 2) / baseH) * 0.9
  return fitScale * clamp(zoom, 0.1, 50)
}

function renderTrace(
  ctx: CanvasRenderingContext2D,
  props: {
    width: number
    height: number
    points: Point[]
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
  }
) {
  const { width, height, points, startIdx, endIdx, step, base, zoom, center, trailMode, clickMarkersMode, highlight, markers, curT } = props
  const srcW = base.w
  const srcH = base.h
  const scale = getCanvasScale(width, height, srcW, srcH, zoom)
  const screenCX = width / 2
  const screenCY = height / 2
  const { cx, cy } = center
  const toX = (x: number) => screenCX + (x - cx) * scale
  const toY = (y: number) => screenCY + (y - cy) * scale

  // bounding box (zooms together with trace)
  ctx.fillStyle = 'rgba(255,255,255,0.02)'
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
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.strokeRect(rx, ry, rw, rh)

  // draw path with gradient and optional fade within last2 mode
  const count = Math.max(0, endIdx - startIdx)
  if (count >= 2) {
    const showLast2 = trailMode === 'last2'
    const tailStart = curT - 2000
    const segs = Math.ceil(count / step)
    let prev = points[startIdx]
    let drawnCount = 0
    for (let i = startIdx + step; i < endIdx; i += step) {
      const p = points[i]
      let t = drawnCount / segs // 0..1 along drawn segment
      let alpha = 0.9
      if (showLast2) {
        const pt = p.ts
        const denom = Math.max(1, curT - tailStart)
        const ageT = clamp((pt - tailStart) / denom, 0, 1)
        t = ageT
        alpha = 0.15 + 0.85 * Math.pow(ageT, 1.1)
      }
      const [r, g, b] = lerpRGB([59, 130, 246], [239, 68, 68], t)
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.beginPath()
      ctx.moveTo(toX(prev.x), toY(prev.y))
      ctx.lineTo(toX(p.x), toY(p.y))
      ctx.stroke()
      prev = p
      drawnCount++
    }
    // Ensure last segment connects to the very last point if we skipped it
    const lastP = points[endIdx - 1]
    if (prev !== lastP) {
      const p = lastP
      let t = 1
      let alpha = 0.9
      if (showLast2) {
        const pt = p.ts
        const denom = Math.max(1, curT - tailStart)
        const ageT = clamp((pt - tailStart) / denom, 0, 1)
        t = ageT
        alpha = 0.15 + 0.85 * Math.pow(ageT, 1.1)
      }
      const [r, g, b] = lerpRGB([59, 130, 246], [239, 68, 68], t)
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.beginPath()
      ctx.moveTo(toX(prev.x), toY(prev.y))
      ctx.lineTo(toX(p.x), toY(p.y))
      ctx.stroke()
    }
  }

  // draw endpoints (always draw the latest point; draw start if we have at least 2 points)
  if (count >= 1) {
    const first = points[startIdx]
    const last = points[endIdx - 1]
    if (trailMode === 'all' && count >= 2) {
      ctx.fillStyle = 'rgba(59,130,246,0.9)'
      ctx.beginPath()
      ctx.arc(toX(first.x), toY(first.y), 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(239,68,68,0.9)'
    ctx.beginPath()
    ctx.arc(toX(last.x), toY(last.y), 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Draw left-click press/release markers (white, smaller).
  if (count >= 1 && clickMarkersMode !== 'none') {
    let prevLeft = ((points[startIdx].buttons ?? 0) & 1) !== 0
    if (prevLeft && (clickMarkersMode === 'all' || clickMarkersMode === 'down')) {
      drawMarker(ctx, toX(points[startIdx].x), toY(points[startIdx].y), true)
    }
    for (let i = startIdx + 1; i < endIdx; i++) {
      const p = points[i]
      const curLeft = ((p.buttons ?? 0) & 1) !== 0
      if (curLeft !== prevLeft) {
        if (clickMarkersMode === 'all' || (clickMarkersMode === 'down' && curLeft)) {
          drawMarker(ctx, toX(p.x), toY(p.y), curLeft)
        }
      }
      prevLeft = curLeft
    }
  }

  // Highlight overlay for selected segment
  if (highlight && (highlight.startTs || highlight.endTs)) {
    const hStartMs = tsMs(highlight.startTs ?? points[0].ts)
    const hEndMs = tsMs(highlight.endTs ?? points[points.length - 1].ts)
    if (Number.isFinite(hStartMs) && Number.isFinite(hEndMs)) {
      const i0 = Math.max(0, Math.min(points.length - 1, findPointIndex(points, hStartMs)))
      const i1 = Math.max(0, Math.min(points.length - 1, findPointIndex(points, hEndMs)))
      if (i1 > i0) {
        ctx.lineWidth = 2
        ctx.strokeStyle = highlight.color || 'rgba(16,185,129,0.9)'
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
      const ms = tsMs(m.ts)
      const i = Math.max(0, Math.min(points.length - 1, findPointIndex(points, ms)))
      const sx = toX(points[i].x)
      const sy = toY(points[i].y)
      const col = m.color || 'rgba(255,255,255,0.95)'
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
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, pressed: boolean) {
  const col = 'rgba(255,255,255,0.95)'
  if (pressed) {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
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
