import { ChevronUp, Info } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useUIState } from '../../hooks/useUIState'

type InfoBoxProps = {
  title: ReactNode
  info?: ReactNode
  children: ReactNode
  height?: number | string
  id?: string
  collapsible?: boolean
  headerControls?: ReactNode
  /** Optional className to apply to the body container (children). If omitted a default p-3 padding
   * is applied. Use this to remove default padding when children already provide their own spacing. */
  bodyClassName?: string
}

export function InfoBox({
  title,
  info,
  children,
  height = 165,
  id,
  collapsible = true,
  headerControls,
  bodyClassName,
}: InfoBoxProps) {
  const [showInfo, setShowInfo] = useState(false)
  const titleText = typeof title === 'string' ? title : undefined

  // Choose a localStorage key if we can persist state. Prefer explicit id,
  // else use the title string if it's available.
  const key = id ?? (titleText ? `InfoBox:${titleText}:collapsed` : undefined)
  const storageKey = (collapsible && key) ? (key.startsWith('InfoBox:') ? key : `InfoBox:${key}`) : undefined

  const [collapsed, setCollapsed] = useUIState<boolean>(storageKey, false)

  const HEADER_H = 44
  const containerStyle: CSSProperties = useMemo(() => ({
    height: collapsed ? HEADER_H : height
  }), [height, collapsed])

  const baseBodyClass = 'h-full overflow-y-auto p-3'

  return (
    <div className="bg-surface-2 rounded border border-primary overflow-hidden transition-all duration-150 ease-out flex flex-col" style={containerStyle}>
      <div className="flex items-center justify-between px-3 h-[44px] border-b border-primary shrink-0">
        <div className="text-sm font-medium text-primary truncate" title={titleText}>{title}</div>
        <div className="flex items-center gap-2">
          {headerControls}
          {collapsible && (
            <button
              aria-label={collapsed ? 'Expand' : 'Collapse'}
              aria-expanded={!collapsed}
              className="p-1 rounded hover:bg-surface-3 text-primary"
              onClick={() => { setCollapsed(c => !c); setShowInfo(false); }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <ChevronUp size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            aria-label="Info"
            className="p-1 rounded hover:bg-surface-3 text-primary"
            onClick={() => setShowInfo(v => !v)}
            title={showInfo ? 'Show details' : 'Show info'}
            aria-expanded={showInfo}
            disabled={collapsed}
          >
            <Info size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        {showInfo ? (
          <div className={bodyClassName ?? `${baseBodyClass} text-sm text-primary`}>
            {info ?? <div>No additional info.</div>}
          </div>
        ) : (
          <div className={bodyClassName ?? `${baseBodyClass} text-xs text-secondary`}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
