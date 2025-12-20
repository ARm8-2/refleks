import { Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useChartTheme } from '../../hooks/useChartTheme';
import { usePageState } from '../../hooks/usePageState';
import { colorWithAlpha, cssColorToRGB } from '../../lib/theme';
import { findPointIndex, formatTime, getCanvasScale, Highlight, Marker, renderTrace } from '../../lib/trace-renderer';
import { clamp } from '../../lib/utils';
import type { MousePoint } from '../../types/ipc';
import { Dropdown } from '../shared/Dropdown';
import { SegmentedControl } from '../shared/SegmentedControl';
import { Toggle } from '../shared/Toggle';

type TraceViewerProps = {
  points: MousePoint[]
  stats: Record<string, any>
  highlight?: Highlight
  markers?: Marker[]
  seekToTs?: any
  centerOnTs?: any
  onReset?: () => void
  canvasHeight?: string
  onFullscreen?: () => void
}

export function TraceViewer({ points, stats, highlight, markers, seekToTs, centerOnTs, onReset, canvasHeight = "h-[360px]", onFullscreen }: TraceViewerProps) {
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

  const palette = useChartTheme()
  const accentRGB = useMemo(() => cssColorToRGB(palette.accent, [59, 130, 246]), [palette.accent])
  const dangerRGB = useMemo(() => cssColorToRGB(palette.danger, [239, 68, 68]), [palette.danger])
  const startPointColor = useMemo(() => colorWithAlpha(palette.accent, 0.9, 'rgba(59,130,246,0.9)'), [palette.accent])
  const endPointColor = useMemo(() => colorWithAlpha(palette.danger, 0.9, 'rgba(239,68,68,0.9)'), [palette.danger])
  const highlightColor = useMemo(() => colorWithAlpha(palette.success, 0.9, 'rgba(16,185,129,0.9)'), [palette.success])
  const markerColor = palette.contrast
  const markerBorder = useMemo(() => colorWithAlpha(palette.neutral, 0.3, 'rgba(0,0,0,0.12)'), [palette.neutral])
  const trailFill = useMemo(() => colorWithAlpha(palette.contrast, 0.02, 'rgba(255,255,255,0.02)'), [palette.contrast])
  const trailStroke = useMemo(() => colorWithAlpha(palette.contrast, 0.12, 'rgba(255,255,255,0.12)'), [palette.contrast])

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
    if (points.length === 0) return { w: 1, h: 1, minX: 0, minY: 0, cx: 0.5, cy: 0.5 }
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
  const t0 = firstTS || 0
  const tN = lastTS || 0
  const durationMs = Math.max(0, tN - t0)

  // Reset when points change
  useEffect(() => {
    stopAnim()
    setIsPlaying(false)
    setPlayIndex(points.length)
    curIndexRef.current = 0
    virtualElapsedRef.current = 0
    baseStartRef.current = 0
    setZoom(1)
    centerRef.current = { cx: (base as any).cx ?? 0, cy: (base as any).cy ?? 0 }
  }, [points])

  // External seek
  useEffect(() => {
    if (seekToTs == null || points.length === 0) return
    const abs = seekToTs
    if (!Number.isFinite(abs)) return
    const i = findPointIndex(points, abs)
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
    const abs = centerOnTs
    if (!Number.isFinite(abs)) return
    const i = Math.max(0, Math.min(points.length - 1, findPointIndex(points, abs)))
    const p = points[i]
    centerRef.current = { cx: p.x, cy: p.y }
    setTransformTick(t => t + 1)
  }, [centerOnTs])

  // Playback
  const play = () => {
    if (isPlaying || points.length < 2) return
    setIsPlaying(true)
    lastFrameTimeRef.current = performance.now()
    const curIdx = Math.max(0, Math.min(points.length - 1, playIndex))
    curIndexRef.current = curIdx
    baseStartRef.current = points[curIdx]?.ts || t0
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
    const dt = now - lastFrameTimeRef.current
    lastFrameTimeRef.current = now
    virtualElapsedRef.current += dt * playbackSpeedRef.current

    const targetTs = baseStartRef.current + virtualElapsedRef.current
    let i = curIndexRef.current
    while (i < points.length && points[i].ts <= targetTs) i++
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
      baseStartRef.current = points[0]?.ts || t0
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
    if (!canvas || !wrap || points.length === 0) return
    const dpr = window.devicePixelRatio || 1
    const cssW = Math.max(320, wrap.clientWidth)
    let cssH = 0
    if (canvasHeight === 'h-full') {
      cssH = wrap.clientHeight
    } else {
      cssH = Math.max(240, Math.min(450, Math.round(cssW * 9 / 16)))
    }

    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    // Calculate visible range
    const max = 10000
    const idx = Math.max(0, Math.min(playIndex, points.length - 1))
    const curT = points[idx].ts
    let startIdx = 0
    let endIdx = Math.min(playIndex, points.length)
    let step = 1

    if (trailMode === 'last2') {
      const tailStart = curT - 2000
      startIdx = findPointIndex(points, tailStart)
      endIdx = Math.min(playIndex, points.length)
    }

    const count = Math.max(1, endIdx - startIdx)
    if (count > max) {
      step = Math.ceil(count / max)
    }

    renderTrace(ctx, {
      width: cssW,
      height: cssH,
      points: points,
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
      curT,
      accentRGB,
      dangerRGB,
      startPointColor,
      endPointColor,
      highlightColor,
      markerColor,
      markerBorder,
      trailFill,
      trailStroke,
    })
  }, [
    points,
    playIndex,
    trailMode,
    base,
    zoom,
    transformTick,
    clickMarkersMode,
    highlight,
    markers,
    accentRGB,
    dangerRGB,
    startPointColor,
    endPointColor,
    highlightColor,
    markerColor,
    markerBorder,
    trailFill,
    trailStroke,
    canvasHeight
  ])

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
  const curAbsMs = curTs || 0
  const startAbsMs = firstTS || 0
  const progressMs = Math.max(0, curAbsMs - startAbsMs)

  const seekTo = (targetMs: number) => {
    const abs = startAbsMs + clamp(targetMs, 0, durationMs)
    const i = findPointIndex(points, abs)
    curIndexRef.current = i
    setPlayIndex(i)
    if (isPlaying) {
      baseStartRef.current = points[i]?.ts || startAbsMs
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
    <div className={`space-y-2 ${canvasHeight === 'h-full' ? 'h-full flex flex-col space-y-0 gap-2' : ''}`}>
      <div ref={wrapRef} className={`w-full relative ${canvasHeight === 'h-full' ? 'flex-1 min-h-0' : ''}`}>
        <canvas
          ref={canvasRef}
          className={`w-full ${canvasHeight} block rounded border border-primary bg-surface-3`}
        />
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="absolute top-2 right-2 p-1.5 rounded bg-surface-1/80 hover:bg-surface-1 text-primary transition-colors"
            title="Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        )}
      </div>

      {/* Controls under the panel */}
      <div className="flex flex-col gap-3 shrink-0">
        {/* Scrub bar */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(1, durationMs)}
            step={16}
            value={progressMs}
            onChange={(e) => seekTo(Number((e.target as HTMLInputElement).value))}
            className="w-full range-pill appearance-none h-3 rounded bg-surface-3"
          />
          <span className="text-xs font-mono text-secondary whitespace-nowrap">
            {formatTime(progressMs)} / {formatTime(durationMs)}
          </span>
        </div>

        {/* Playback + options */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-secondary">
          <div className="flex items-center gap-2 bg-surface-3/60 border border-primary rounded-full px-2 py-1">
            <button onClick={() => nudge(-5000)} title="Back 5s" className="h-8 w-8 grid place-items-center rounded-full text-primary hover:bg-surface-3">
              <SkipBack size={16} />
            </button>
            <button onClick={isPlaying ? pause : play} title={isPlaying ? 'Pause' : 'Play'} className="h-8 w-8 grid place-items-center rounded-full text-primary hover:bg-surface-3">
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button onClick={() => nudge(5000)} title="Forward 5s" className="h-8 w-8 grid place-items-center rounded-full text-primary hover:bg-surface-3">
              <SkipForward size={16} />
            </button>
            <button
              onClick={reset}
              title="Reset"
              className="h-8 w-8 grid place-items-center rounded-full text-primary hover:bg-surface-3"
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
          </div>
        </div>
      </div>
    </div>
  )
}
