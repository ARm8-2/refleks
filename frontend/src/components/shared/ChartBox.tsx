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
import { Dropdown } from './Dropdown'
import { Modal } from './Modal'
import { SegmentedControl } from './SegmentedControl'
import { Toggle } from './Toggle'

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

type DropdownOption = { label: string; value: string }

export type ChartBoxControls = {
  dropdown?: {
    label?: string
    value: string
    options: DropdownOption[]
    onChange: (value: string) => void
  }
  toggle?: {
    label?: string
    checked: boolean
    onChange: (checked: boolean) => void
  }
  segment?: {
    label?: string
    value: string
    options: DropdownOption[]
    onChange: (value: string) => void
  }
}

type ChartBoxProps = {
  title: ReactNode
  info?: ReactNode
  children: ReactNode
  controls?: ChartBoxControls
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
  controls,
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

  const renderControls = () => (
    <>
      {controls?.dropdown && (
        <Dropdown
          size="sm"
          label={controls.dropdown.label}
          value={controls.dropdown.value}
          onChange={(v) => controls.dropdown!.onChange(v)}
          options={controls.dropdown.options}
        />
      )}
      {controls?.segment && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          {controls.segment.label && <span>{controls.segment.label}</span>}
          <SegmentedControl
            size="sm"
            options={controls.segment.options}
            value={controls.segment.value}
            onChange={(v) => controls.segment!.onChange(v)}
          />
        </div>
      )}
      {controls?.toggle && (
        <Toggle
          size="sm"
          label={controls.toggle.label ?? 'Auto'}
          checked={controls.toggle.checked}
          onChange={(v) => controls.toggle!.onChange(v)}
        />
      )}
    </>
  )

  return (
    <ChartBoxContext.Provider value={{ isExpanded }}>
      {(!expandable || !isExpanded) && (
        <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)] flex flex-col" style={{ height }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)] shrink-0">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate" title={titleText}>{title}</div>
            <div className="flex items-center gap-2">
              {renderControls()}
              {expandable && (
                <button
                  aria-label="Expand"
                  aria-expanded={isExpanded}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                  onClick={() => handleExpandChange(true)}
                  title="Expand chart"
                >
                  <Maximize2 size={16} />
                </button>
              )}
              <button
                aria-label="Info"
                className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                onClick={() => setShowInfo(prev => !prev)}
                title={showInfo ? 'Show chart' : 'Show info'}
              >
                <Info size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {showInfo ? (
              <div className="h-full overflow-y-auto text-sm text-[var(--text-primary)] p-3">
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
              {renderControls()}
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
              <div className="h-1/4 border-t border-[var(--border-primary)] p-4 overflow-y-auto bg-[var(--bg-tertiary)]/10 shrink-0">
                <div className="text-sm text-[var(--text-primary)]">
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
