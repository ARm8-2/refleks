import { Button, Input } from '@/shared/components'
import { usePersistedState, useStore } from '@/shared/hooks'
import { cn, STORAGE_KEYS } from '@/shared/lib'
import type { Session } from '@/shared/types'
import { ChevronDown, ChevronUp, Clock3, Gamepad2, Layers3, Minus, NotebookPen, Search, SquarePen, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryRun, ScenarioSummary } from '../lib/historyModels'
import {
  buildSessionScenarioSummaries,
  buildSessionScenarioTrendPoints,
  formatDurationLabel,
  formatNumber,
  formatScore,
  formatSessionDateRange,
  formatSessionTitle,
  readSessionActivePlaytimeMs,
  readSessionDurationMs,
  readUniqueScenarioCount
} from '../lib/historyModels'
import { ScenarioTrendChart } from './HistoryScenarioTrendChart'
import { HistorySessionDetailsModal } from './HistorySessionDetailsModal'
import { PerformanceVsSensWidget } from './PerformanceVsSensWidget'
import { SessionScenarioRadarWidget } from './SessionScenarioRadarWidget'

type Props = {
  session: Session | null
  sessions: Session[]
  sessionRuns: HistoryRun[]
  selectedScenario: string | null
  onSelectScenario: (name: string | null) => void
  onSelectRun: (runId: string) => void
  globalPbByScenario: Map<string, HistoryRun>
}

export function HistorySessionOverview({ session, sessions, sessionRuns, selectedScenario, onSelectScenario, onSelectRun, globalPbByScenario }: Props) {
  const [scenarioGridExpanded, setScenarioGridExpanded] = usePersistedState(STORAGE_KEYS.historyScenarioGridExpanded, false)
  const [scenarioQuery, setScenarioQuery] = usePersistedState(STORAGE_KEYS.historyScenarioQuery, '')
  const saveSessionNote = useStore(state => state.saveSessionNote)
  const [notesOpen, setNotesOpen] = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const scenarioSummaries = useMemo(
    () => (session ? buildSessionScenarioSummaries(session, sessions) : []),
    [session, sessions],
  )

  const filteredSummaries = useMemo(() => {
    const q = scenarioQuery.trim().toLowerCase()
    if (!q) return scenarioSummaries
    return scenarioSummaries.filter(s => s.name.toLowerCase().includes(q))
  }, [scenarioSummaries, scenarioQuery])

  const displayedSummaries = scenarioGridExpanded ? filteredSummaries : filteredSummaries.slice(0, 3)

  const trendPoints = useMemo(
    () => (selectedScenario ? buildSessionScenarioTrendPoints(selectedScenario, sessionRuns) : []),
    [selectedScenario, sessionRuns],
  )

  const selectedSummary = selectedScenario ? scenarioSummaries.find(s => s.name === selectedScenario) : null

  const notes = session?.notes?.trim() ?? ''
  const hasNotes = !!notes
  const initialNotes = session?.notes ?? ''
  const initialName = session?.name ?? ''

  useEffect(() => {
    setNameDraft(initialName)
    setNameEditing(false)
    setNameSaving(false)
    setNameError(null)
  }, [initialName, session?.id])

  useEffect(() => {
    if (!nameEditing) return
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    })
  }, [nameEditing])

  const saveName = async () => {
    if (!session) return

    const trimmedDraft = nameDraft.trim()
    const trimmedInitial = initialName.trim()

    if (trimmedDraft === trimmedInitial) {
      setNameEditing(false)
      return
    }

    setNameSaving(true)
    setNameError(null)
    try {
      await saveSessionNote(session.id, trimmedDraft, initialNotes)
      setNameEditing(false)
    } catch {
      setNameError('Failed to update session name. Please try again.')
    } finally {
      setNameSaving(false)
    }
  }

  const cancelNameEdit = () => {
    setNameDraft(initialName)
    setNameEditing(false)
    setNameError(null)
  }

  if (!session) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center rounded-xl bg-surface p-5">
        <p className="text-sm text-surface-muted-foreground">Select a session</p>
      </section>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-surface">
      <div className="px-5 pt-5 pb-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {nameEditing ? (
                <Input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={event => setNameDraft(event.target.value)}
                  onBlur={() => {
                    if (!nameSaving) {
                      void saveName()
                    }
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void saveName()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelNameEdit()
                    }
                  }}
                  placeholder="Session name"
                  className="max-w-[340px] bg-transparent px-3 font-medium shadow-none focus-visible:bg-surface-subtle focus-visible:ring-0"
                  disabled={nameSaving}
                />
              ) : (
                <div className="flex h-9 max-w-[340px] items-center truncate font-medium text-foreground">{formatSessionTitle(session)}</div>
              )}
              {!nameEditing && (
                <Button
                  onClick={() => setNameEditing(true)}
                  variant="ghost"
                  size="icon"
                  className="text-surface-muted-foreground"
                  title="Rename session"
                >
                  <SquarePen />
                </Button>
              )}
            </div>
            <div className="mt-0.5 text-xs text-surface-muted-foreground">{formatSessionDateRange(session)}</div>
            {nameError && <div className="mt-1 text-xs text-destructive">{nameError}</div>}
          </div>
          <Button
            onClick={() => setNotesOpen(true)}
            variant="ghost"
            size="icon"
            className={cn(
              'shrink-0',
              hasNotes ? 'text-primary' : 'text-surface-muted-foreground',
            )}
            title={hasNotes ? 'Edit session notes' : 'Add session notes'}
          >
            <NotebookPen />
          </Button>
        </div>
      </div>

      <div className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCell icon={<Layers3 className="h-4 w-4" />} label="Runs" value={String(session.items.length)} sub={`${readUniqueScenarioCount(session)} scenarios`} />
          <MetricCell icon={<Clock3 className="h-4 w-4" />} label="Length" value={formatDurationLabel(readSessionDurationMs(session))} />
          <MetricCell icon={<Gamepad2 className="h-4 w-4" />} label="Playtime" value={formatDurationLabel(readSessionActivePlaytimeMs(session))} />
        </div>

        {notes && (
          <div className="mt-4 rounded-xl bg-surface-subtle px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-surface-muted-foreground">Notes</p>
              <Button
                onClick={() => setNotesOpen(true)}
                variant="ghost"
                size="sm"
                title="Edit session notes"
              >
                Edit
              </Button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{notes}</p>
          </div>
        )}

        {/* Scenario grid */}
        {scenarioSummaries.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setScenarioGridExpanded(v => !v)}
              className="flex w-full items-center gap-1.5 text-xs font-medium text-surface-muted-foreground hover:text-foreground transition-colors"
            >
              {scenarioGridExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Scenarios ({scenarioSummaries.length})
            </button>

            {scenarioGridExpanded && scenarioSummaries.length > 3 && (
              <div className="relative mt-2 w-full max-w-sm">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-muted-foreground" />
                <Input
                  value={scenarioQuery}
                  onChange={e => setScenarioQuery(e.target.value)}
                  placeholder="Search scenarios..."
                  className="h-9 pl-8"
                />
              </div>
            )}

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {displayedSummaries.map(summary => (
                <ScenarioCard
                  key={summary.name}
                  summary={summary}
                  selected={selectedScenario === summary.name}
                  onSelect={() => onSelectScenario(selectedScenario === summary.name ? null : summary.name)}
                />
              ))}
            </div>

            {!scenarioGridExpanded && filteredSummaries.length > 3 && (
              <button
                type="button"
                onClick={() => setScenarioGridExpanded(true)}
                className="mt-2 text-xs text-surface-muted-foreground hover:text-foreground transition-colors"
              >
                +{filteredSummaries.length - 3} more
              </button>
            )}
          </div>
        )}

        {/* Scenario trend: metrics + chart */}
        {selectedScenario && selectedSummary && trendPoints.length > 0 && (() => {
          const pb = globalPbByScenario.get(selectedScenario)
          return (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <SmallMetric label="Session best" value={formatScore(selectedSummary.bestScore)} />
                <SmallMetric label="Latest" value={formatScore(trendPoints[trendPoints.length - 1].score)} />
                {pb ? (
                  <button
                    type="button"
                    onClick={() => onSelectRun(pb.id)}
                    className="rounded-xl bg-surface-subtle px-3 py-2.5 text-left transition-colors hover:bg-surface-emphasis"
                    title="Inspect personal best"
                  >
                    <div className="flex items-center gap-1 text-xs text-surface-muted-foreground">
                      <Trophy className="h-3 w-3 text-amber-500" />
                      All-time PB
                    </div>
                    <div className="text-lg font-semibold text-foreground">{formatScore(pb.score)}</div>
                  </button>
                ) : (
                  <SmallMetric label="Runs" value={formatNumber(trendPoints.length, 0)} />
                )}
              </div>

              <ScenarioTrendChart
                scenarioName={selectedScenario}
                points={trendPoints}
                onClickPoint={runId => onSelectRun(runId)}
                className="bg-surface-subtle"
              />

              <div className="grid gap-3 lg:grid-cols-2">
                <PerformanceVsSensWidget
                  sessions={session ? [session] : []}
                  scenarioName={selectedScenario}
                  title="Performance vs Sensitivity"
                  description={selectedScenario ? `${selectedScenario} in this session.` : undefined}
                  className="bg-surface-subtle"
                />
                <SessionScenarioRadarWidget
                  session={session}
                  className="bg-surface-subtle"
                />
              </div>
            </div>
          )
        })()}
      </div>

      <HistorySessionDetailsModal
        isOpen={notesOpen}
        sessionLabel={formatSessionDateRange(session)}
        initialNotes={initialNotes}
        onClose={() => setNotesOpen(false)}
        onSave={async (noteText) => {
          await saveSessionNote(session.id, initialName.trim(), noteText)
        }}
      />
    </section>
  )
}

function MetricCell({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-subtle px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-surface-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-surface-muted-foreground">{sub}</div>}
    </div>
  )
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-subtle px-3 py-2.5">
      <div className="text-xs text-surface-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  )
}

function ScenarioCard({ summary, selected, onSelect }: { summary: ScenarioSummary; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-[transform,color,opacity] duration-220 ease-emphasized will-change-transform active:scale-[0.985]',
        selected ? 'shadow-sm' : 'bg-surface-subtle',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 rounded-xl bg-surface-emphasis transition-[opacity,transform] duration-220 ease-emphasized',
          selected ? 'scale-100 opacity-100' : 'scale-[0.985] opacity-0 group-hover:scale-100 group-hover:opacity-100',
        )}
      />
      <div className="relative z-10 min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{summary.name}</div>
        <div className="text-xs text-surface-muted-foreground">
          {formatScore(summary.bestScore)} · {summary.count} {summary.count === 1 ? 'run' : 'runs'}
        </div>
      </div>
      {summary.trend === 'up' && <TrendingUp className="relative z-10 h-4 w-4 shrink-0 text-green-500" />}
      {summary.trend === 'down' && <TrendingDown className="relative z-10 h-4 w-4 shrink-0 text-red-500" />}
      {summary.trend === 'same' && <Minus className="relative z-10 h-3.5 w-3.5 shrink-0 text-surface-muted-foreground" />}
    </button>
  )
}
