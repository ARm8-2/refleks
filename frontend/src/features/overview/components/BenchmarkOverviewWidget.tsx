import { ScenarioHistoryModal } from "@/features/benchmarks/components/detail/ScenarioHistoryModal";
import { ScenarioNotesModal } from "@/features/benchmarks/components/detail/ScenarioNotesModal";
import {
  buildInfoColumns,
  getRowClasses,
  RANK_MIN_COLUMN_WIDTH,
  ScenarioInfoRow,
  ScenarioRankCells,
} from "@/features/benchmarks/components/detail/ScenarioRow";
import { useBenchmarkDetailProgress } from "@/features/benchmarks/hooks/useBenchmarkDetailProgress";
import { useBenchmarkVisibility } from "@/features/benchmarks/hooks/useBenchmarkVisibility";
import { getScenarioName } from "@/features/benchmarks/lib/detailFormatting";
import {
  computeRecommendationScores,
  selectTopPicks,
  type ScenarioBenchmarkData,
} from "@/features/benchmarks/lib/detailRecommendations";
import {
  Button,
  Checkbox,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TogglePill,
  Widget,
} from "@/shared/components";
import { useBenchmarks, usePersistedState, useStore } from "@/shared/hooks";
import {
  benchmarkDetailProgressStorageBase,
  benchmarkDetailProgressStorageKey,
  getSettings,
  launchPlaylist,
  launchScenario,
  saveScenarioNote,
} from "@/shared/lib";
import type { ProgressScenario, Settings } from "@/shared/types";
import { Play, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const LEFT_PANEL_PADDING = 1;

type NotesState = {
  open: boolean;
  scenario: string;
  notes: string;
  sensitivity: string;
};

type HistoryState = {
  open: boolean;
  scenario: string;
  thresholds: number[];
};

export function BenchmarkOverviewWidget() {
  const navigate = useNavigate();
  const { selectedBenchmark, getBenchmarkByName } = useBenchmarks();
  const benchmark = selectedBenchmark
    ? getBenchmarkByName(selectedBenchmark)
    : null;
  const { progress, difficultyIndex, setDifficultyIndex } =
    useBenchmarkDetailProgress(benchmark ?? undefined);
  const sessions = useStore((s) => s.sessions);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [notesState, setNotesState] = useState<NotesState>({
    open: false,
    scenario: "",
    notes: "",
    sensitivity: "",
  });
  const [historyState, setHistoryState] = useState<HistoryState>({
    open: false,
    scenario: "",
    thresholds: [],
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  const storageBase = benchmarkDetailProgressStorageBase(
    benchmark?.benchmarkName,
  );

  // Share the same persisted preferences as the detail page
  const [compactMode, setCompactMode] = usePersistedState<boolean>(
    benchmarkDetailProgressStorageKey(benchmark?.benchmarkName, "compact"),
    false,
  );
  const [showNotesCol, setShowNotesCol] = usePersistedState<boolean>(
    benchmarkDetailProgressStorageKey(benchmark?.benchmarkName, "showNotes"),
    true,
  );
  const [showRecCol, setShowRecCol] = usePersistedState<boolean>(
    benchmarkDetailProgressStorageKey(benchmark?.benchmarkName, "showRec"),
    true,
  );
  const [showPlayCol, setShowPlayCol] = usePersistedState<boolean>(
    benchmarkDetailProgressStorageKey(benchmark?.benchmarkName, "showPlay"),
    true,
  );
  const [showHistoryCol, setShowHistoryCol] = usePersistedState<boolean>(
    benchmarkDetailProgressStorageKey(benchmark?.benchmarkName, "showHistory"),
    true,
  );

  const {
    rankDefs,
    categories,
    autoHideCleared,
    setAutoHideCleared,
    visibleRankCount,
    setVisibleRankCount,
    manuallyHidden,
    toggleManualRank,
    resetManual,
    autoHidden,
    visibleRankIndices,
  } = useBenchmarkVisibility({
    storagePrefix: storageBase,
    progress: progress ?? null,
  });

  const cls = getRowClasses(compactMode);
  const rankVisibilityOptions = Array.from(
    { length: Math.max(1, rankDefs.length) },
    (_, i) => i + 1,
  );

  const infoColumns = useMemo(
    () =>
      buildInfoColumns(showNotesCol, showRecCol, showPlayCol, showHistoryCol),
    [showNotesCol, showRecCol, showPlayCol, showHistoryCol],
  );
  const infoGridTemplate = useMemo(
    () => infoColumns.map((c) => `${c.width}rem`).join(" "),
    [infoColumns],
  );
  const infoGridWidth = useMemo(
    () => infoColumns.reduce((t, c) => t + c.width, 0),
    [infoColumns],
  );

  const rightPanelOffset = LEFT_PANEL_PADDING + infoGridWidth;
  const hasVisibleRanks = visibleRankIndices.length > 0;
  const rightGridTemplate = hasVisibleRanks
    ? `repeat(${visibleRankIndices.length}, minmax(${RANK_MIN_COLUMN_WIDTH}rem, 1fr))`
    : `minmax(${RANK_MIN_COLUMN_WIDTH}rem, 1fr)`;
  const rightGridMinWidth =
    Math.max(1, visibleRankIndices.length) * RANK_MIN_COLUMN_WIDTH;
  const overallRankName =
    rankDefs[(progress?.overallRank ?? 0) - 1]?.name || "-";

  // All scenarios flat list
  const allScenarios = useMemo((): ProgressScenario[] => {
    return categories.flatMap((c) => c.groups.flatMap((g) => g.scenarios));
  }, [categories]);

  const benchmarkScenarioNames = useMemo(
    () => new Set(allScenarios.map((s) => s.name)),
    [allScenarios],
  );

  // Current scenario: most recently played scenario that belongs to this benchmark
  const currentScenario = useMemo((): ProgressScenario | null => {
    for (const session of sessions) {
      for (const item of session.items) {
        const name = getScenarioName(item);
        if (benchmarkScenarioNames.has(name)) {
          return allScenarios.find((s) => s.name === name) ?? null;
        }
      }
    }
    return null;
  }, [sessions, benchmarkScenarioNames, allScenarios]);

  // Recommendation scores + top picks
  const wantedNames = useMemo(
    () => allScenarios.map((s) => s.name),
    [allScenarios],
  );

  const lastSessionCount = useMemo(() => {
    const map = new Map<string, number>();
    const lastSession = sessions[0];
    if (!lastSession) return map;
    for (const item of lastSession.items) {
      const name = getScenarioName(item);
      map.set(name, (map.get(name) || 0) + 1);
    }
    return map;
  }, [sessions]);

  const benchmarkData = useMemo(() => {
    const data = new Map<string, ScenarioBenchmarkData>();
    for (const category of categories) {
      for (const group of category.groups) {
        for (const scenario of group.scenarios) {
          data.set(scenario.name, {
            rank: Number(scenario.scenarioRank || 0),
            score: Number(scenario.score || 0),
            thresholds: scenario.thresholds || [],
            category: category.name,
          });
        }
      }
    }
    return data;
  }, [categories]);

  const scenarioCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      for (const group of category.groups) {
        for (const scenario of group.scenarios) {
          map.set(scenario.name, category.name);
        }
      }
    }
    return map;
  }, [categories]);

  const recommendationScore = useMemo(
    () =>
      computeRecommendationScores({
        wantedNames,
        lastSessionCount,
        sessions,
        benchmarkData,
      }),
    [wantedNames, lastSessionCount, sessions, benchmarkData],
  );

  const topPicks = useMemo(
    () =>
      selectTopPicks(
        recommendationScore,
        scenarioCategoryMap,
        Math.max(3, categories.length || 3),
      ),
    [recommendationScore, scenarioCategoryMap, categories.length],
  );

  // Recommended scenarios: all with positive score, sorted descending, capped at 5, excluding current
  const recommendedScenarios = useMemo((): ProgressScenario[] => {
    const currentName = currentScenario?.name;
    return allScenarios
      .filter(
        (s) =>
          s.name !== currentName && (recommendationScore.get(s.name) ?? 0) >= 7,
      )
      .sort(
        (a, b) =>
          (recommendationScore.get(b.name) ?? 0) -
          (recommendationScore.get(a.name) ?? 0),
      )
      .slice(0, 5);
  }, [allScenarios, currentScenario, recommendationScore]);

  const openNotes = (scenario: string) => {
    const note = settings?.scenarioNotes?.[scenario];
    setNotesState({
      open: true,
      scenario,
      notes: note?.notes || "",
      sensitivity: note?.sens || "",
    });
  };

  const saveNotes = async (notes: string, sensitivity: string) => {
    await saveScenarioNote(notesState.scenario, notes, sensitivity);
    setSettings(
      (prev) =>
        ({
          ...(prev || {}),
          scenarioNotes: {
            ...(prev?.scenarioNotes || {}),
            [notesState.scenario]: { notes, sens: sensitivity },
          },
        }) as Settings,
    );
  };

  if (!benchmark) {
    return (
      <Widget
        title="Benchmark Overview"
        description="No benchmark selected yet. Pick one to track your progress here."
        headerAction={
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => navigate("/benchmarks")}
          >
            Browse Benchmarks
          </Button>
        }
      >
        <div />
      </Widget>
    );
  }

  if (!progress) {
    return (
      <Widget
        title={`${benchmark.abbreviation} ${benchmark.benchmarkName}`}
        description="Loading progress…"
      >
        <div />
      </Widget>
    );
  }

  const difficulty = benchmark.difficulties?.[difficultyIndex];

  const titleControls = (
    <>
      {benchmark.difficulties?.length > 1 && (
        <Select
          value={String(difficultyIndex)}
          onValueChange={(v) => setDifficultyIndex(Number(v) || 0)}
        >
          <SelectTrigger className="h-7 w-auto min-w-0 max-w-[12.5rem] px-2 text-xs bg-surface-subtle">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            {benchmark.difficulties.map((d, i) => (
              <SelectItem
                key={`${d.kovaaksBenchmarkId}-${i}`}
                value={String(i)}
              >
                {d.difficultyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() =>
          difficulty?.sharecode &&
          launchPlaylist(difficulty.sharecode).catch(() => {})
        }
        disabled={!difficulty?.sharecode}
        title="Play benchmark playlist in Kovaak's"
      >
        <Play className="h-4 w-4" />
      </Button>
    </>
  );

  const headerControls = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={compactMode ? "secondary" : "ghost"}
        size="sm"
        className="h-8 px-3 text-xs"
        onClick={() => setCompactMode((v) => !v)}
        aria-pressed={compactMode}
        title={compactMode ? "Disable compact mode" : "Enable compact mode"}
      >
        Compact
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowSettings(true)}
        title="Widget settings"
      >
        <Settings2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <Widget
      title={`${benchmark.abbreviation} ${benchmark.benchmarkName}`}
      titleControls={titleControls}
      // description={`${overallRankName}`}
      headerAction={headerControls}
      className="overflow-hidden"
      contentClassName="-mx-4 -mb-3"
    >
      {/* Split-panel content */}
      <div className="relative z-0">
        {/* Left panel (fixed width) */}
        <div className="relative z-0 pl-4 pt-2 pb-3">
          <div className="pr-2">
            {/* Column headers */}
            <div
              className="grid h-[1.75rem] items-center mb-1.5"
              style={{ gridTemplateColumns: infoGridTemplate }}
            >
              <div className="select-none overflow-hidden text-ellipsis whitespace-nowrap text-[0.6875rem] uppercase tracking-wide text-surface-muted-foreground">
                Scenario
              </div>
              <div />
              {showNotesCol && <div />}
              {showRecCol && (
                <div className="text-center text-[0.6875rem] uppercase tracking-wide text-surface-muted-foreground">
                  Rec
                </div>
              )}
              {showPlayCol && <div />}
              {showHistoryCol && <div />}
              <div />
              <div className="text-right text-[0.6875rem] uppercase tracking-wide text-surface-muted-foreground">
                Score
              </div>
            </div>

            {/* Current scenario section */}
            <div>
              {currentScenario ? (
                <ScenarioInfoRow
                  scenarioName={currentScenario.name}
                  score={currentScenario.score || 0}
                  gridTemplate={infoGridTemplate}
                  cls={cls}
                  showNotesCol={showNotesCol}
                  showRecCol={showRecCol}
                  showPlayCol={showPlayCol}
                  showHistoryCol={showHistoryCol}
                  hasSavedNote={Boolean(
                    settings?.scenarioNotes?.[currentScenario.name]?.notes,
                  )}
                  recommendation={
                    recommendationScore.get(currentScenario.name) ?? 0
                  }
                  isTopPick={topPicks.has(currentScenario.name)}
                  completed={
                    currentScenario.scenarioRank >=
                    Math.max(1, (currentScenario.thresholds?.length ?? 0) - 1)
                  }
                  onNotes={() => openNotes(currentScenario.name)}
                  onHistory={() =>
                    setHistoryState({
                      open: true,
                      scenario: currentScenario.name,
                      thresholds: currentScenario.thresholds || [],
                    })
                  }
                  onPlay={() =>
                    launchScenario(currentScenario.name, "challenge").catch(
                      () => {},
                    )
                  }
                />
              ) : (
                <div className="h-[2rem] flex items-center text-[0.75rem] text-surface-muted-foreground">
                  No recent scenario for this benchmark
                </div>
              )}
            </div>

            {/* Divider — extends to widget edge minus matching right padding (pr-4 = pl-4 of outer container) */}
            <div className="h-[1.0625rem] flex items-center pr-4">
              <div className="h-px w-full bg-border" />
            </div>

            {/* Recommended scenarios section */}
            <div className="space-y-0.5">
              {recommendedScenarios.length === 0 ? (
                <div className="h-[2rem] flex items-center text-[0.75rem] text-surface-muted-foreground">
                  No recommendations yet
                </div>
              ) : (
                recommendedScenarios.map((scenario) => (
                  <ScenarioInfoRow
                    key={scenario.name}
                    scenarioName={scenario.name}
                    score={scenario.score || 0}
                    gridTemplate={infoGridTemplate}
                    cls={cls}
                    showNotesCol={showNotesCol}
                    showRecCol={showRecCol}
                    showPlayCol={showPlayCol}
                    showHistoryCol={showHistoryCol}
                    hasSavedNote={Boolean(
                      settings?.scenarioNotes?.[scenario.name]?.notes,
                    )}
                    recommendation={recommendationScore.get(scenario.name) ?? 0}
                    isTopPick={topPicks.has(scenario.name)}
                    completed={
                      scenario.scenarioRank >=
                      Math.max(1, (scenario.thresholds?.length ?? 0) - 1)
                    }
                    onNotes={() => openNotes(scenario.name)}
                    onHistory={() =>
                      setHistoryState({
                        open: true,
                        scenario: scenario.name,
                        thresholds: scenario.thresholds || [],
                      })
                    }
                    onPlay={() =>
                      launchScenario(scenario.name, "challenge").catch(() => {})
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right panel (scrollable rank cells, absolutely positioned) */}
        <div
          className="pointer-events-auto absolute bottom-0 right-0 top-0 z-10 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ left: `${rightPanelOffset}rem` }}
        >
          <div className="min-h-full min-w-full w-max pt-2 pb-3 pl-2 pr-2">
            {/* Rank column headers */}
            <div
              className="grid h-[1.75rem] items-center gap-1 mb-1.5"
              style={{
                gridTemplateColumns: rightGridTemplate,
                minWidth: rightGridMinWidth,
                width: "100%",
              }}
            >
              {hasVisibleRanks ? (
                visibleRankIndices.map((rankIndex) => {
                  const rank = rankDefs[rankIndex];
                  return (
                    <div
                      key={`${rank.name}-${rankIndex}`}
                      className="text-center text-[0.6875rem] uppercase tracking-wide text-surface-muted-foreground"
                      style={rank.color ? { color: rank.color } : undefined}
                    >
                      {rank.name}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-[0.6875rem] uppercase tracking-wide text-surface-muted-foreground">
                  Details
                </div>
              )}
            </div>

            {/* Current scenario rank cells */}
            <div>
              {currentScenario ? (
                <ScenarioRankCells
                  scenarioName={currentScenario.name}
                  score={currentScenario.score || 0}
                  scenarioRank={currentScenario.scenarioRank}
                  thresholds={currentScenario.thresholds || []}
                  rankDefs={rankDefs}
                  visibleRankIndices={visibleRankIndices}
                  hasVisibleRanks={hasVisibleRanks}
                  rightGridTemplate={rightGridTemplate}
                  rightGridMinWidth={rightGridMinWidth}
                  cls={cls}
                />
              ) : (
                <div className="h-[2rem]" />
              )}
            </div>

            {/* Spacer to match left panel divider height — line is only in the left panel */}
            <div className="h-[1.0625rem]" />

            {/* Recommended rank cells */}
            <div className="space-y-0.5">
              {recommendedScenarios.length === 0 ? (
                <div className="h-[2rem]" />
              ) : (
                recommendedScenarios.map((scenario) => (
                  <ScenarioRankCells
                    key={`${scenario.name}-ranks`}
                    scenarioName={scenario.name}
                    score={scenario.score || 0}
                    scenarioRank={scenario.scenarioRank}
                    thresholds={scenario.thresholds || []}
                    rankDefs={rankDefs}
                    visibleRankIndices={visibleRankIndices}
                    hasVisibleRanks={hasVisibleRanks}
                    rightGridTemplate={rightGridTemplate}
                    rightGridMinWidth={rightGridMinWidth}
                    cls={cls}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Widget Settings"
        width="43.75rem"
        height="auto"
      >
        <div className="space-y-6 px-6 pb-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Feature Columns
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={showNotesCol}
                  onCheckedChange={(v) => setShowNotesCol(Boolean(v))}
                />
                Notes
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={showRecCol}
                  onCheckedChange={(v) => setShowRecCol(Boolean(v))}
                />
                Recommendations
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={showPlayCol}
                  onCheckedChange={(v) => setShowPlayCol(Boolean(v))}
                />
                Play
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={showHistoryCol}
                  onCheckedChange={(v) => setShowHistoryCol(Boolean(v))}
                />
                History
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Rank Visibility
            </h4>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={autoHideCleared}
                  onCheckedChange={(v) => setAutoHideCleared(Boolean(v))}
                />
                Auto-hide earlier cleared ranks
              </label>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-surface-muted-foreground">
                  Keep visible:
                </span>
                <Select
                  value={String(visibleRankCount)}
                  onValueChange={(v) =>
                    setVisibleRankCount(Math.max(1, Number(v) || 1))
                  }
                >
                  <SelectTrigger className="h-8 w-[5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rankVisibilityOptions.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" size="sm" onClick={resetManual}>
                Reset Manual
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {rankDefs.map((rank, index) => {
                const hiddenManually = manuallyHidden.has(index);
                const hiddenAutomatically = autoHidden.has(index);
                const visible = !(hiddenManually || hiddenAutomatically);
                return (
                  <TogglePill
                    key={`${rank.name}-${index}`}
                    disabled={hiddenAutomatically}
                    onClick={() => toggleManualRank(index)}
                    active={visible}
                    className="h-auto px-2.5 py-1 text-xs"
                    style={
                      rank.color && visible ? { color: rank.color } : undefined
                    }
                    title={
                      hiddenAutomatically
                        ? "Hidden automatically because every scenario is already past this rank"
                        : undefined
                    }
                  >
                    {rank.name}
                  </TogglePill>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ScenarioNotesModal
        isOpen={notesState.open}
        onClose={() => setNotesState((prev) => ({ ...prev, open: false }))}
        scenarioName={notesState.scenario}
        initialNotes={notesState.notes}
        initialSensitivity={notesState.sensitivity}
        onSave={saveNotes}
      />

      <ScenarioHistoryModal
        isOpen={historyState.open}
        onClose={() => setHistoryState((prev) => ({ ...prev, open: false }))}
        scenarioName={historyState.scenario}
        thresholds={historyState.thresholds}
        rankDefs={rankDefs}
      />
    </Widget>
  );
}
