import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePageState } from '../../hooks/usePageState';
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
  const startPerfRef = useRef<number>(0)
  const baseStartRef = useRef<number>(0)
  const curIndexRef = useRef<number>(0)
  const centerRef = useRef<{ cx: number; cy: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const panRafRef = useRef<number | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [playIndex, setPlayIndex] = useState<number>(points.length)
  const [zoom, setZoom] = usePageState<number>('trace:zoom', 1)
  const [trailMode, setTrailMode] = usePageState<'all' | 'last2'>('trace:trailMode', 'all')
  const [transformTick, setTransformTick] = useState(0)
  const [autoFollow, setAutoFollow] = usePageState<boolean>('trace:autoFollow', false)
  const autoFollowRef = useRef<boolean>(false)

  useEffect(() => {
    autoFollowRef.current = autoFollow
  }, [autoFollow])

  const [clickMarkersMode, setClickMarkersMode] = usePageState<'all' | 'down' | 'none'>('trace:clickMarkers', 'down')

  // Base data bounds/resolution
  const base = useMemo(() => {
    let minX = points[0].x,
      maxX = points[0].x,
      minY = points[0].y,
      maxY = points[0].y
    for (const p of points) {
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
  }, [points, stats])

  const firstTS = points[0]?.ts
  const lastTS = points[points.length - 1]?.ts
  const t0 = useMemo(() => tsMs(firstTS), [points])
  const tN = useMemo(() => tsMs(lastTS), [points])
  const durationMs = Math.max(0, (tsMs(lastTS) || 0) - (tsMs(firstTS) || 0))

  // Reset when points change
  useEffect(() => {
    stopAnim()
    setIsPlaying(false)
    setPlayIndex(points.length)
    curIndexRef.current = 0
    startPerfRef.current = 0
    baseStartRef.current = 0
    setZoom(1)
    centerRef.current = { cx: (base as any).cx ?? 0, cy: (base as any).cy ?? 0 }
  }, [points])

  // External seek
  useEffect(() => {
    if (seekToTs == null || points.length === 0) return
    const abs = tsMs(seekToTs)
    if (!Number.isFinite(abs)) return
    // binary search
    let lo = 0, hi = points.length - 1
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (tsMs(points[mid].ts) < abs) lo = mid + 1
      else hi = mid
    }
    const i = lo
    curIndexRef.current = i
    setPlayIndex(i)
    if (autoFollowRef.current) {
      const p = points[Math.max(0, Math.min(points.length - 1, i))]
      if (p) centerRef.current = { cx: p.x, cy: p.y }
    }
  }, [seekToTs])

  // External center
  useEffect(() => {
    if (centerOnTs == null || points.length === 0) return
    const abs = tsMs(centerOnTs)
    if (!Number.isFinite(abs)) return
    let lo = 0, hi = points.length - 1
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (tsMs(points[mid].ts) < abs) lo = mid + 1
      else hi = mid
    }
    const i = Math.max(0, Math.min(points.length - 1, lo))
    const p = points[i]
    centerRef.current = { cx: p.x, cy: p.y }
    setTransformTick(t => t + 1)
  }, [centerOnTs])

  // Playback
  const play = () => {
    if (isPlaying || points.length < 2) return
    setIsPlaying(true)
    startPerfRef.current = performance.now()
    const curIdx = Math.max(0, Math.min(points.length - 1, playIndex))
    curIndexRef.current = curIdx
    baseStartRef.current = tsMs(points[curIdx]?.ts) || t0
    rafRef.current = requestAnimationFrame(tick)
  }
  const pause = () => {
    setIsPlaying(false)
    stopAnim()
  }
  const reset = () => {
    setIsPlaying(false)
    stopAnim()
    curIndexRef.current = points.length
    setPlayIndex(points.length)
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
    const elapsed = now - startPerfRef.current
    const targetTs = baseStartRef.current + elapsed
    let i = curIndexRef.current
    while (i < points.length && tsMs(points[i].ts) <= targetTs) i++
    curIndexRef.current = i
    setPlayIndex(i)
    if (autoFollowRef.current) {
      const followIdx = Math.max(0, Math.min(points.length - 1, i - 1))
      const p = points[followIdx]
      if (p) centerRef.current = { cx: p.x, cy: p.y }
    }
    if (targetTs >= tN || i >= points.length) {
      // Loop playback back to the start
      curIndexRef.current = 0
      setPlayIndex(0)
      baseStartRef.current = tsMs(points[0]?.ts) || t0
      startPerfRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // Determine which points to draw
  const drawn = useMemo(() => {
    const max = 20000
    if (points.length === 0) return []
    const idx = Math.max(0, Math.min(playIndex, points.length - 1))
    const curT = tsMs(points[idx].ts)
    if (trailMode === 'last2') {
      const tailStart = curT - 2000
      // binary search for first >= tailStart within [0, idx]
      let lo = 0,
        hi = idx
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (tsMs(points[mid].ts) < tailStart) lo = mid + 1
        else hi = mid
      }
      const startIdx = lo
      const endIdx = Math.min(playIndex, points.length) // exclusive upper bound
      const count = Math.max(1, endIdx - startIdx)
      if (count <= max) return points.slice(startIdx, endIdx)
      const step = Math.ceil(count / max)
      const arr: Point[] = []
      for (let i = startIdx; i < endIdx; i += step) arr.push(points[i])
      if (arr.length === 0 || arr[arr.length - 1] !== points[endIdx - 1]) arr.push(points[endIdx - 1])
      return arr
    } else {
      // all history up to current index
      const endIdx = Math.min(playIndex, points.length) // exclusive
      if (endIdx <= max) return points.slice(0, endIdx)
      const step = Math.ceil(endIdx / max)
      const arr: Point[] = []
      for (let i = 0; i < endIdx; i += step) arr.push(points[i])
      if (arr.length === 0 || arr[arr.length - 1] !== points[endIdx - 1]) arr.push(points[endIdx - 1])
      return arr
    }
  }, [points, playIndex, trailMode])

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || drawn.length === 0) return
    const dpr = window.devicePixelRatio || 1
    const cssW = Math.max(320, wrap.clientWidth)
    const cssH = Math.max(240, Math.round(cssW * 9 / 16))
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    // transform helpers
    const pad = 8
    const srcW = base.w
    const srcH = base.h
    const fitScale = Math.min((cssW - pad * 2) / srcW, (cssH - pad * 2) / srcH)
    const scale = fitScale * clamp(zoom, 0.1, 50)
    const screenCX = cssW / 2
    const screenCY = cssH / 2
    if (!centerRef.current) centerRef.current = { cx: (base as any).cx ?? 0, cy: (base as any).cy ?? 0 }
    const { cx, cy } = centerRef.current
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
    if (drawn.length >= 2) {
      const showLast2 = trailMode === 'last2'
      const curT = tsMs(points[Math.min(playIndex, points.length - 1)].ts)
      const tailStart = curT - 2000
      const segs = drawn.length - 1
      let prev = drawn[0]
      for (let i = 1; i < drawn.length; i++) {
        const p = drawn[i]
        let t = i / segs // 0..1 along drawn segment
        let alpha = 0.9
        if (showLast2) {
          const pt = tsMs(p.ts)
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
      }
    }
    // draw endpoints (always draw the latest point; draw start if we have at least 2 points)
    if (drawn.length >= 1) {
      const first = drawn[0]
      const last = drawn[drawn.length - 1]
      if (trailMode === 'all' && drawn.length >= 2) {
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
    // Controlled by clickMarkersMode ('all' | 'down' | 'none')
    if (drawn.length >= 1 && clickMarkersMode !== 'none') {
      const clickMarkersArr: { x: number; y: number; pressed: boolean }[] = []
      let prevLeft = ((drawn[0].buttons ?? 0) & 1) !== 0
      if (prevLeft) clickMarkersArr.push({ x: drawn[0].x, y: drawn[0].y, pressed: true })
      for (let i = 1; i < drawn.length; i++) {
        const p = drawn[i]
        const curLeft = ((p.buttons ?? 0) & 1) !== 0
        if (curLeft !== prevLeft) clickMarkersArr.push({ x: p.x, y: p.y, pressed: curLeft })
        prevLeft = curLeft
      }

      const filteredClickMarkers = clickMarkersArr.filter(m => clickMarkersMode === 'all' || (clickMarkersMode === 'down' && m.pressed))

      for (const m of filteredClickMarkers) {
        const sx = toX(m.x)
        const sy = toY(m.y)
        const col = 'rgba(255,255,255,0.95)'
        if (m.pressed) {
          ctx.fillStyle = col
          ctx.beginPath()
          ctx.arc(sx, sy, 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.12)'
          ctx.lineWidth = 1
          ctx.stroke()
        } else {
          ctx.strokeStyle = col
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(sx, sy, 2, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }

    // Highlight overlay for selected segment
    if (highlight && (highlight.startTs || highlight.endTs)) {
      const hStartMs = tsMs(highlight.startTs ?? points[0].ts)
      const hEndMs = tsMs(highlight.endTs ?? points[points.length - 1].ts)
      if (Number.isFinite(hStartMs) && Number.isFinite(hEndMs)) {
        // indices
        let lo = 0, hi = points.length - 1
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (tsMs(points[mid].ts) < hStartMs) lo = mid + 1; else hi = mid }
        const i0 = Math.max(0, Math.min(points.length - 1, lo))
        lo = 0; hi = points.length - 1
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (tsMs(points[mid].ts) < hEndMs) lo = mid + 1; else hi = mid }
        const i1 = Math.max(0, Math.min(points.length - 1, lo))
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
        let lo = 0, hi = points.length - 1
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (tsMs(points[mid].ts) < ms) lo = mid + 1; else hi = mid }
        const i = Math.max(0, Math.min(points.length - 1, lo))
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
  }, [drawn, base, zoom, playIndex, trailMode, transformTick, clickMarkersMode])

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
      const pad = 8
      const srcW = base.w
      const srcH = base.h
      const fitScale = Math.min((cssW - pad * 2) / srcW, (cssH - pad * 2) / srcH)
      const scale = fitScale * clamp(zoom, 0.1, 50)
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
      const pad = 8
      const fitScale = Math.min((cssW - pad * 2) / base.w, (cssH - pad * 2) / base.h)
      const scale = fitScale * zoom
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
    let lo = 0,
      hi = points.length - 1
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      const t = tsMs(points[mid].ts)
      if (t < abs) lo = mid + 1
      else hi = mid
    }
    const i = lo
    curIndexRef.current = i
    setPlayIndex(i)
    if (isPlaying) {
      baseStartRef.current = tsMs(points[i]?.ts) || startAbsMs
      startPerfRef.current = performance.now()
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
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`
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
