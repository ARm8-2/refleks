import { useRef, useState } from 'react'
import { SCENARIO_DEFAULT_WIDTH, SCENARIO_MAX_WIDTH, SCENARIO_MIN_WIDTH } from '../lib/benchmarks/layout'

export type UseResizableScenarioOptions = {
  initialWidth?: number
  min?: number
  max?: number
}

export function useResizableScenarioColumn(options: UseResizableScenarioOptions = {}) {
  const { initialWidth = SCENARIO_DEFAULT_WIDTH, min = SCENARIO_MIN_WIDTH, max = SCENARIO_MAX_WIDTH } = options
  const [width, setWidth] = useState(initialWidth)
  const startX = useRef(0)
  const startW = useRef(initialWidth)

  const onHandleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX
    startW.current = width
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current
      const next = Math.min(max, Math.max(min, startW.current + dx))
      setWidth(next)
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return { scenarioWidth: width, onHandleMouseDown }
}
