import { ChartLine, NotebookPen, Play } from 'lucide-react'
import { Fragment, type MouseEvent } from 'react'
import { cellFill, computeFillColor } from '../../lib/benchmarks/ui'
import { MISSING_STR } from '../../lib/constants'
import { launchScenario } from '../../lib/internal'
import { formatNumber } from '../../lib/utils'
import type { ProgressGroup, ProgressScenario, RankDef } from '../../types/ipc'
import { EnergyCell } from './EnergyCell'
import { RecommendationIcon } from './RecommendationIcon'

type BenchmarkScenarioRowProps = {
  s: ProgressScenario
  g: ProgressGroup
  si: number
  compactMode: boolean
  showNotesCol: boolean
  showRecCol: boolean
  showPlayCol: boolean
  showHistoryCol: boolean
  settings: any
  recScore: Map<string, number>
  topPicks: Set<string>
  ranks: RankDef[]
  visibleRankIndices: number[]
  hasEnergy: boolean
  handleContextMenu: (e: MouseEvent, scenario: string, thresholds: number[]) => void
  openNotes: (scenario: string) => void
  openHistory: (scenario: string, thresholds: number[]) => void
}

export function BenchmarkScenarioRow({
  s, g, si,
  compactMode,
  showNotesCol, showRecCol, showPlayCol, showHistoryCol,
  settings,
  recScore, topPicks,
  ranks, visibleRankIndices,
  hasEnergy,
  handleContextMenu, openNotes, openHistory
}: BenchmarkScenarioRowProps) {
  const sName = s.name
  const achieved = s.scenarioRank
  const maxes: number[] = s.thresholds
  const score = s.score
  const totalRec = recScore.get(sName) ?? 0
  const isTopPick = topPicks.has(sName)
  const isCompleted = achieved != null && maxes && achieved >= (maxes.length - 1)
  const rankColor = computeFillColor(achieved, ranks)

  return (
    <Fragment>
      <div
        className={`${compactMode ? 'text-[11px]' : 'text-[13px]'} text-primary truncate flex items-center cursor-[context-menu]`}
        onContextMenu={(e) => handleContextMenu(e, sName, s.thresholds)}
      >
        <div className="w-1 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: rankColor }} />
        {sName}
      </div>
      <div />
      {showNotesCol && (
        <div className="flex items-center justify-center">
          <button
            className={`${compactMode ? 'p-0.5' : 'p-1'} rounded hover:bg-surface-3 border border-transparent hover:border-primary ${settings?.scenarioNotes?.[sName]?.notes ? 'text-accent' : 'text-secondary'}`}
            title="Notes & Sensitivity"
            onClick={() => openNotes(sName)}
            aria-label={`Notes for ${sName}`}
          >
            <NotebookPen size={compactMode ? 14 : 16} />
          </button>
        </div>
      )}
      {showRecCol && (
        <div className="text-[12px] flex items-center justify-center" title={`Recommendation score: ${totalRec}`}>
          <RecommendationIcon score={totalRec} compact={compactMode} isTopPick={isTopPick} isCompleted={isCompleted} />
        </div>
      )}
      {showPlayCol && (
        <div className="flex items-center justify-center">
          <button
            className={`${compactMode ? 'p-0.5' : 'p-1'} rounded hover:bg-surface-3 border border-transparent hover:border-primary`}
            title="Play in Kovaak's"
            onClick={() => launchScenario(sName, 'challenge').catch(() => { /* ignore */ })}
            aria-label={`Play ${sName} in Kovaak's`}
          >
            <Play size={compactMode ? 14 : 16} />
          </button>
        </div>
      )}
      {showHistoryCol && (
        <div className="flex items-center justify-center">
          <button
            className={`${compactMode ? 'p-0.5' : 'p-1'} rounded hover:bg-surface-3 border border-transparent hover:border-primary`}
            title="Last 10 Scores"
            onClick={() => openHistory(sName, s.thresholds)}
            aria-label={`History for ${sName}`}
          >
            <ChartLine size={compactMode ? 14 : 16} />
          </button>
        </div>
      )}
      <div />
      <div className={`${compactMode ? 'text-[10px]' : 'text-[12px]'} text-primary flex items-center`}>{formatNumber(score)}</div>
      {visibleRankIndices.map((ri) => {
        const r = ranks[ri]
        const fill = cellFill(ri, score, maxes)
        const fillColor = computeFillColor(achieved, ranks)
        const value = maxes?.[ri + 1]
        return (
          <div key={r.name + ri} className={`${compactMode ? 'text-[10px]' : 'text-[12px]'} text-center px-4 rounded relative overflow-hidden flex items-center justify-center bg-surface-2`}>
            <div className="absolute inset-y-0 left-0 rounded-l transition-all duration-150" style={{ width: `${Math.round(fill * 100)}%`, background: fillColor }} />
            <span className={`relative z-10 w-full h-full ${compactMode ? 'py-0' : 'py-1'} flex items-center justify-center`} style={{ background: "radial-gradient(circle, var(--shadow-secondary), rgba(0, 0, 0, 0))" }}>{value != null ? formatNumber(value) : MISSING_STR}</span>
          </div>
        )
      })}
      <EnergyCell s={s} g={g} si={si} hasEnergy={hasEnergy} />
    </Fragment>
  )
}
