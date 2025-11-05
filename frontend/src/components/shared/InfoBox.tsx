import { Info } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'

type InfoBoxProps = {
  title: ReactNode
  info?: ReactNode
  children: ReactNode
  height?: number
}

export function InfoBox({
  title,
  info,
  children,
  height = 165,
}: InfoBoxProps) {
  const [showInfo, setShowInfo] = useState(false)
  const bodyStyle: CSSProperties = useMemo(() => ({ height: height - 44 }), [height]) // 44px header
  const titleText = typeof title === 'string' ? title : undefined
  return (
    <div className="bg-[var(--bg-secondary)] rounded border border-[var(--border-primary)]" style={{ height }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="text-sm font-medium text-[var(--text-primary)] truncate" title={titleText}>{title}</div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Info"
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
            onClick={() => setShowInfo(v => !v)}
            title={showInfo ? 'Show details' : 'Show info'}
          >
            <Info size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden" style={bodyStyle}>
        {showInfo ? (
          <div className="h-full overflow-y-auto text-sm text-[var(--text-primary)] p-3">
            {info ?? <div>No additional info.</div>}
          </div>
        ) : (
          <div className="h-full overflow-y-auto text-xs text-[var(--text-secondary)] p-3">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
