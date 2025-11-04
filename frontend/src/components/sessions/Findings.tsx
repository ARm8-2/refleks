import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePageState } from '../../hooks/usePageState'
import { formatPct01, formatSeconds, getScenarioName } from '../../lib/utils'
import type { ScenarioRecord } from '../../types/ipc'
import { Dropdown } from '../shared/Dropdown'

type FindingsProps = { strongest: ScenarioRecord[]; weakest: ScenarioRecord[] }
type FindingsRowProps = { rec: ScenarioRecord }

export function Findings({ strongest, weakest }: FindingsProps) {
  const [openTab, setOpenTab] = usePageState<'analysis' | 'raw'>('findings:openIn', 'analysis')
  const navigate = useNavigate()

  const openItem = (rec: ScenarioRecord) => {
    const file = encodeURIComponent(rec.filePath)
    const tab = openTab
    navigate(`/scenarios?file=${file}&tab=${tab}`)
  }

  const Row = ({ rec }: FindingsRowProps) => (
    <div
      onClick={() => openItem(rec)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(rec) } }}
      className="relative group cursor-pointer p-2 pr-10 rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] transform transition-all duration-150 ease-out hover:bg-[var(--bg-hover)] hover:translate-x-1 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <div className="text-sm text-[var(--text-primary)] font-medium">{getScenarioName(rec)}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            Score: <b className="text-[var(--text-primary)]">{Math.round(Number(rec.stats['Score'] ?? 0))}</b>
            {' '}• Acc: <b className="text-[var(--text-primary)]">{formatPct01(rec.stats['Accuracy'])}</b>
            {' '}• TTK: <b className="text-[var(--text-primary)]">{formatSeconds(rec.stats['Real Avg TTK'])}</b>
          </div>
        </div>
        {/* Chevron on the right - non-interactive */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] transition-colors duration-150 group-hover:text-[var(--text-primary)] pointer-events-none">
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
      <div className="px-3 py-2 border-b border-[var(--border-primary)] text-sm font-medium text-[var(--text-primary)] flex items-center justify-between">
        <span>Performance findings</span>
        <Dropdown
          label="Open in"
          value={openTab}
          onChange={(v: string) => setOpenTab(v as 'analysis' | 'raw')}
          options={[{ label: 'Analysis', value: 'analysis' }, { label: 'Raw Stats', value: 'raw' }]}
        />
      </div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-2">Strongest</div>
          <div className="space-y-2">
            {strongest.length === 0 && <div className="text-xs text-[var(--text-secondary)]">No items.</div>}
            {strongest.map(rec => <Row key={rec.filePath} rec={rec} />)}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-2">Weakest</div>
          <div className="space-y-2">
            {weakest.length === 0 && <div className="text-xs text-[var(--text-secondary)]">No items.</div>}
            {weakest.map(rec => <Row key={rec.filePath} rec={rec} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
