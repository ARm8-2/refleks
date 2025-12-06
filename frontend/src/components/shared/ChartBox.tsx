import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
} from 'chart.js'
import { Info, Maximize2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'
import { Modal } from './Modal'

// Register common chart.js components once
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  // Added for bar & doughnut charts used in benchmark stats
  BarElement,
  ArcElement,
)

// Context to let children know if they are in an expanded view
export const ChartBoxContext = createContext<{ isExpanded: boolean }>({ isExpanded: false })
export const useChartBoxContext = () => useContext(ChartBoxContext)

type ChartBoxProps = {
  title: ReactNode
  info?: ReactNode
  children: ReactNode
  actions?: ReactNode
  height?: number
  modalControls?: ReactNode
  expandable?: boolean
  isExpanded?: boolean
  onExpandChange?: (expanded: boolean) => void
}

export function ChartBox({
  title,
  info,
  children,
  actions,
  height = 280,
  modalControls,
  expandable = false,
  isExpanded: isExpandedProp,
  onExpandChange,
}: ChartBoxProps) {
  const [showInfo, setShowInfo] = useState(false)
  const [isExpandedLocal, setIsExpandedLocal] = useState(false)

  const isExpanded = isExpandedProp !== undefined ? isExpandedProp : isExpandedLocal
  const handleExpandChange = (val: boolean) => {
    if (onExpandChange) onExpandChange(val)
    else setIsExpandedLocal(val)
  }

  const titleText = typeof title === 'string' ? title : undefined

  return (
    <ChartBoxContext.Provider value={{ isExpanded }}>
      {(!expandable || !isExpanded) && (
        <div className="bg-surface-2 rounded border border-primary flex flex-col" style={{ height }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary shrink-0">
            <div className="text-sm font-medium text-primary truncate" title={titleText}>{title}</div>
            <div className="flex items-center gap-2">
              {actions}
              {expandable && (
                <button
                  aria-label="Expand"
                  aria-expanded={isExpanded}
                  className="p-1 rounded hover:bg-surface-3 text-primary"
                  onClick={() => handleExpandChange(true)}
                  title="Expand chart"
                >
                  <Maximize2 size={16} />
                </button>
              )}
              <button
                aria-label="Info"
                className="p-1 rounded hover:bg-surface-3 text-primary"
                onClick={() => setShowInfo(prev => !prev)}
                title={showInfo ? 'Show chart' : 'Show info'}
              >
                <Info size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {showInfo ? (
              <div className="h-full overflow-y-auto text-sm text-primary p-3">
                {info ?? <div>No additional info.</div>}
              </div>
            ) : (
              <div className="h-full p-3">
                {children}
              </div>
            )}
          </div>
        </div>
      )}

      {expandable && (
        <Modal
          isOpen={isExpanded}
          onClose={() => handleExpandChange(false)}
          title={title}
          headerControls={
            <>
              {actions}
              {modalControls}
            </>
          }
          width="90%"
          height="90%"
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 p-4">
              {children}
            </div>
            {info && (
              <div className="max-h-[25%] border-t border-primary p-4 overflow-y-auto bg-surface-3/10 shrink-0">
                <div className="text-sm text-primary">
                  {info}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </ChartBoxContext.Provider>
  )
}
