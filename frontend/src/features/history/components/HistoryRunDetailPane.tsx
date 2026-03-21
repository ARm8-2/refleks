import { Button } from '@/shared/components'
import { usePersistedState } from '@/shared/hooks'
import { cn, STORAGE_KEYS } from '@/shared/lib'
import { Columns2, Layers, PanelRightClose, Rows2, Trophy } from 'lucide-react'
import type { HistoryRun } from '../lib/historyModels'
import { INSPECTOR_TABS, type InspectorTab } from '../lib/inspectorTabs'
import { AnalysisTab } from './inspector/AnalysisTab'
import { EnvironmentTab } from './inspector/EnvironmentTab'
import { StatsTab } from './inspector/StatsTab'
import { TraceTab } from './inspector/TraceTab'

export type { InspectorTab }

type Props = {
  primaryRun: HistoryRun | null
  compareRun: HistoryRun | null
  activeTab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  onClose: () => void
  onClearPrimaryRun: () => void
  onClearComparison: () => void
  isPrimaryPb: boolean
  onComparePb: () => void
}

export function HistoryRunDetailPane({
  primaryRun,
  compareRun,
  activeTab,
  onTabChange,
  onClose,
  onClearPrimaryRun,
  onClearComparison,
  isPrimaryPb,
  onComparePb,
}: Props) {
  const [overlay, setOverlay] = usePersistedState(STORAGE_KEYS.historyAnalysisOverlay, false)

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-1 rounded-xl bg-secondary p-1">
          {INSPECTOR_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {primaryRun && !isPrimaryPb && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onComparePb}
              title="Compare with personal best"
            >
              <Trophy className="mr-1 h-3.5 w-3.5" />
              vs PB
            </Button>
          )}
          {compareRun && (activeTab === 'analysis' || activeTab === 'trace') && (
            <Button
              variant={overlay ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setOverlay(o => !o)}
              title={overlay ? 'Show side by side' : 'Overlay both runs'}
            >
              {overlay
                ? <><Columns2 className="mr-1 h-3.5 w-3.5" />Side by side</>
                : <><Layers className="mr-1 h-3.5 w-3.5" />Overlay</>
              }
            </Button>
          )}
          {compareRun && (
            <Button variant="ghost" size="sm" onClick={onClearComparison}>
              <Rows2 className="mr-1 h-3.5 w-3.5" />
              Single
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} title="Close inspector">
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!primaryRun ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Select a run to inspect</p>
        </div>
      ) : (
        <div className={cn(
          'min-h-0 flex-1',
          activeTab === 'trace' ? 'flex flex-col p-3 pt-1' : 'scrollbar-compact overflow-y-auto p-5 pt-2 space-y-4',
        )}>
          {activeTab === 'stats' && (
            <StatsTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              onClearPrimaryRun={onClearPrimaryRun}
              onClearComparison={onClearComparison}
            />
          )}
          {activeTab === 'analysis' && (
            <AnalysisTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              overlay={overlay}
            />
          )}
          {activeTab === 'trace' && (
            <TraceTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              overlay={overlay}
            />
          )}
          {activeTab === 'environment' && (
            <EnvironmentTab
              primaryRun={primaryRun}
              compareRun={compareRun}
              onClearPrimaryRun={onClearPrimaryRun}
              onClearComparison={onClearComparison}
            />
          )}
        </div>
      )}
    </section>
  )
}
