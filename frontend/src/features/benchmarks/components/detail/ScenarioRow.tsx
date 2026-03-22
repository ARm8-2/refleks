import type { RankDef } from '@/shared/types'
import { ChartLine, NotebookPen, Play } from 'lucide-react'
import { cellFill, computeFillColor, formatNumber } from '../../lib/detailFormatting'
import { RecommendationIndicator } from './RecommendationIndicator'

type RGB = { r: number; g: number; b: number }

function parseHexColor(color: string): RGB | null {
  const hex = color.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null

  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return { r, g, b }
  }

  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return { r, g, b }
  }

  return null
}

function parseRgbColor(color: string): RGB | null {
  const m = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i)
  if (!m) return null
  const r = Math.max(0, Math.min(255, Number(m[1])))
  const g = Math.max(0, Math.min(255, Number(m[2])))
  const b = Math.max(0, Math.min(255, Number(m[3])))
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null
  return { r, g, b }
}

function parseColorToRGB(color: string): RGB | null {
  return parseHexColor(color) ?? parseRgbColor(color)
}

function relativeLuminance({ r, g, b }: RGB): number {
  const toLinear = (value: number) => {
    const srgb = value / 255
    if (srgb <= 0.04045) return srgb / 12.92
    return ((srgb + 0.055) / 1.055) ** 2.4
  }
  const rr = toLinear(r)
  const gg = toLinear(g)
  const bb = toLinear(b)
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb
}

function thresholdTextOnFillColor(fillColor: string): string {
  const rgb = parseColorToRGB(fillColor)
  if (!rgb) {
    // Unknown CSS formats (e.g. vars) fallback to a safe light text on the fill layer.
    return '#f8fafc'
  }
  return relativeLuminance(rgb) >= 0.58 ? '#0b1220' : '#f8fafc'
}

// --- Column layout constants ---
export const SCENARIO_COLUMN_WIDTH = 240
export const GAP_COLUMN_WIDTH = 8
export const NOTES_COLUMN_WIDTH = 32
export const RECOMMEND_COLUMN_WIDTH = 40
export const ACTION_COLUMN_WIDTH = 32
export const SCORE_COLUMN_WIDTH = 60
export const RANK_MIN_COLUMN_WIDTH = 96

export type InfoColumnKey = 'scenario' | 'leading-gap' | 'notes' | 'rec' | 'play' | 'history' | 'trailing-gap' | 'score'

export type InfoColumn = {
  key: InfoColumnKey
  width: number
}

export function buildInfoColumns(
  showNotesCol: boolean,
  showRecCol: boolean,
  showPlayCol: boolean,
  showHistoryCol: boolean,
): InfoColumn[] {
  const columns: InfoColumn[] = [
    { key: 'scenario', width: SCENARIO_COLUMN_WIDTH },
    { key: 'leading-gap', width: GAP_COLUMN_WIDTH },
  ]
  if (showNotesCol) columns.push({ key: 'notes', width: NOTES_COLUMN_WIDTH })
  if (showRecCol) columns.push({ key: 'rec', width: RECOMMEND_COLUMN_WIDTH })
  if (showPlayCol) columns.push({ key: 'play', width: ACTION_COLUMN_WIDTH })
  if (showHistoryCol) columns.push({ key: 'history', width: ACTION_COLUMN_WIDTH })
  columns.push(
    { key: 'trailing-gap', width: GAP_COLUMN_WIDTH },
    { key: 'score', width: SCORE_COLUMN_WIDTH },
  )
  return columns
}

export type RowClasses = {
  rowHeightClass: string
  rankCellHeightClass: string
  nameTextClass: string
  scoreTextClass: string
  iconButtonClass: string
  actionButtonClass: string
  iconSize: number
}

export function getRowClasses(compact: boolean): RowClasses {
  return {
    rowHeightClass: compact ? 'h-[28px]' : 'h-[32px]',
    rankCellHeightClass: compact ? 'h-[22px]' : 'h-[24px]',
    nameTextClass: compact ? 'text-[12px]' : 'text-[13px]',
    scoreTextClass: compact ? 'text-[11px]' : 'text-[12px]',
    iconButtonClass: compact
      ? 'rounded-lg border border-transparent p-1 text-muted-foreground transition-colors hover:border-border hover:bg-muted'
      : 'rounded-lg border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-muted',
    actionButtonClass: compact
      ? 'rounded-lg border border-transparent p-1 text-foreground transition-colors hover:border-border hover:bg-muted'
      : 'rounded-lg border border-transparent p-1.5 text-foreground transition-colors hover:border-border hover:bg-muted',
    iconSize: compact ? 13 : 14,
  }
}

type ScenarioInfoRowProps = {
  scenarioName: string
  score: number
  gridTemplate: string
  cls: RowClasses
  showNotesCol: boolean
  showRecCol: boolean
  showPlayCol: boolean
  showHistoryCol: boolean
  hasSavedNote: boolean
  recommendation: number
  isTopPick: boolean
  completed: boolean
  onNotes: () => void
  onHistory: () => void
  onPlay: () => void
}

export function ScenarioInfoRow({
  scenarioName,
  score,
  gridTemplate,
  cls,
  showNotesCol,
  showRecCol,
  showPlayCol,
  showHistoryCol,
  hasSavedNote,
  recommendation,
  isTopPick,
  completed,
  onNotes,
  onHistory,
  onPlay,
}: ScenarioInfoRowProps) {
  return (
    <div className={`grid items-center ${cls.rowHeightClass}`} style={{ gridTemplateColumns: gridTemplate }}>
      <div className={`${cls.nameTextClass} min-w-0 flex items-center overflow-hidden text-foreground`}>
        <span className="block w-full truncate">{scenarioName}</span>
      </div>
      <div />

      {showNotesCol && (
        <div className="flex items-center justify-center">
          <button
            type="button"
            className={hasSavedNote ? cls.iconButtonClass.replace('text-muted-foreground', 'text-primary') : cls.iconButtonClass}
            title="Notes & Sensitivity"
            onClick={onNotes}
          >
            <NotebookPen size={cls.iconSize} />
          </button>
        </div>
      )}

      {showRecCol && (
        <div className="flex items-center justify-center" title={`Recommendation score: ${recommendation}`}>
          <RecommendationIndicator
            compact={cls.iconSize === 13}
            score={recommendation}
            isTopPick={isTopPick}
            isCompleted={completed}
          />
        </div>
      )}

      {showPlayCol && (
        <div className="flex items-center justify-center">
          <button
            type="button"
            className={cls.actionButtonClass}
            title="Play in Kovaak's"
            onClick={onPlay}
          >
            <Play size={cls.iconSize} />
          </button>
        </div>
      )}

      {showHistoryCol && (
        <div className="flex items-center justify-center">
          <button
            type="button"
            className={cls.actionButtonClass}
            title="Last 10 Scores"
            onClick={onHistory}
          >
            <ChartLine size={cls.iconSize} />
          </button>
        </div>
      )}

      <div />
      <div className={`flex items-center justify-end pr-1 text-foreground ${cls.scoreTextClass}`}>
        {formatNumber(score || 0, 0)}
      </div>
    </div>
  )
}

type ScenarioRankCellsProps = {
  scenarioName: string
  score: number
  scenarioRank: number
  thresholds: number[]
  rankDefs: RankDef[]
  visibleRankIndices: number[]
  hasVisibleRanks: boolean
  rightGridTemplate: string
  rightGridMinWidth: number
  cls: RowClasses
}

export function ScenarioRankCells({
  scenarioName,
  score,
  scenarioRank,
  thresholds,
  rankDefs,
  visibleRankIndices,
  hasVisibleRanks,
  rightGridTemplate,
  rightGridMinWidth,
  cls,
}: ScenarioRankCellsProps) {
  const fillColor = computeFillColor(scenarioRank, rankDefs)
  return (
    <div
      className={`grid items-center gap-1 ${cls.rowHeightClass}`}
      style={{ gridTemplateColumns: rightGridTemplate, minWidth: rightGridMinWidth, width: '100%' }}
    >
      {hasVisibleRanks ? visibleRankIndices.map(rankIndex => {
        const rank = rankDefs[rankIndex]
        const fill = cellFill(rankIndex, score, thresholds)
        const fillPercent = Math.round(fill * 100)
        const value = thresholds?.[rankIndex + 1]
        const displayValue = value != null ? formatNumber(value, 0) : '-'
        const fillTextColor = thresholdTextOnFillColor(fillColor)
        return (
          <div
            key={`${scenarioName}-${rank.name}-${rankIndex}`}
            className={`relative flex items-center justify-center overflow-hidden rounded-md bg-background-panel px-3 text-center text-[11px] ${cls.rankCellHeightClass}`}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${fillPercent}%`, background: fillColor }}
            />
            <span className="pointer-events-none relative z-10 flex w-full items-center justify-center font-medium text-foreground">
              {displayValue}
            </span>
            {fillPercent > 0 && (
              <span
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-3 font-medium"
                style={{
                  color: fillTextColor,
                  clipPath: `inset(0 ${100 - fillPercent}% 0 0)`,
                }}
              >
                {displayValue}
              </span>
            )}
          </div>
        )
      }) : (
        <div className={`flex items-center justify-center rounded-md bg-background-panel px-3 text-center text-[11px] text-muted-foreground ${cls.rankCellHeightClass}`}>
          -
        </div>
      )}
    </div>
  )
}
