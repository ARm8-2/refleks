import { ChevronUp, Info } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useUIState } from '../../hooks/useUIState'

type InfoBoxProps = {
  title: ReactNode
  info?: ReactNode
  children: ReactNode
  height?: number
  /** Optional ID for persistent UI state (localStorage key). If not provided
   *  and title is a string, the title will be used. If neither is present,
   *  collapse state will not persist across reloads. */
  id?: string
  /** Enable/disable collapse behavior (default true) */
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

  // Store last seen value so we can reset showInfo when collapsing
  const savedCollapsedRef = useRef<boolean | null>(null)
  useEffect(() => { savedCollapsedRef.current = collapsed }, [collapsed])

  const HEADER_H = 44
  const containerStyle: CSSProperties = useMemo(() => ({ height: collapsed ? HEADER_H : height }), [height, collapsed])
  const bodyStyle: CSSProperties = useMemo(() => ({ height: collapsed ? 0 : height - HEADER_H }), [height, collapsed]) // 44px header
  const leftBodyClass = 'h-full overflow-y-auto text-xs text-[var(--text-secondary)] '
  const leftBodyClassDefault = leftBodyClass + 'p-3'
  const rightBodyClass = 'h-full overflow-y-auto text-sm text-[var(--text-primary)] '
  const rightBodyClassDefault = rightBodyClass + 'p-3'

  return (
    <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)] overflow-hidden transition-all duration-150 ease-out" style={containerStyle}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="text-sm font-medium text-[var(--text-primary)] truncate" title={titleText}>{title}</div>
        <div className="flex items-center gap-2">
          {headerControls}
          {collapsible && (
            <button
              aria-label={collapsed ? 'Expand' : 'Collapse'}
              aria-expanded={!collapsed}
              className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
              onClick={() => { setCollapsed(c => !c); setShowInfo(false); }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <ChevronUp size={16} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            aria-label="Info"
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
            onClick={() => setShowInfo(v => !v)}
            title={showInfo ? 'Show details' : 'Show info'}
            aria-expanded={showInfo}
            disabled={collapsed}
          >
            <Info size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden" style={bodyStyle}>
        {showInfo ? (
          <div className={bodyClassName ?? rightBodyClassDefault}>
            {info ?? <div>No additional info.</div>}
          </div>
        ) : (
          <div className={bodyClassName ?? leftBodyClassDefault}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
