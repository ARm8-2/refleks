import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components";
import { cn } from "@/shared/lib";
import type { Session } from "@/shared/types";
import {
  ArrowRightLeft,
  ArrowUpDown,
  Check,
  ListFilter,
  PanelRightClose,
  PanelRightOpen,
  ScanSearch,
  Search,
  Trophy,
} from "lucide-react";
import { useCallback } from "react";
import type { RunSortKey } from "../hooks/useHistoryPageState";
import type { HistoryRun } from "../lib/historyModels";
import {
  formatDurationLabel,
  formatPercent,
  formatScore,
} from "../lib/historyModels";
import { VirtualList } from "./VirtualList";

type Props = {
  session: Session | null;
  runs: HistoryRun[];
  query: string;
  primaryRun: HistoryRun | null;
  compareRun: HistoryRun | null;
  collapsed: boolean;
  inspectorOpen: boolean;
  selectedScenario: string | null;
  onQueryChange: (value: string) => void;
  onToggleCollapsed: () => void;
  onToggleInspector: () => void;
  onSelectRun: (runId: string) => void;
  onCompareRun: (runId: string) => void;
  sort: RunSortKey;
  onSortChange: (sort: RunSortKey) => void;
  filterPb: boolean;
  onFilterPbChange: (v: boolean | ((prev: boolean) => boolean)) => void;
};

export function HistoryRunList({
  session,
  runs,
  query,
  primaryRun,
  compareRun,
  collapsed,
  inspectorOpen,
  selectedScenario,
  onQueryChange,
  onToggleCollapsed,
  onToggleInspector,
  onSelectRun,
  onCompareRun,
  sort,
  onSortChange,
  filterPb,
  onFilterPbChange,
}: Props) {
  const hasActiveFilters = sort !== "default" || filterPb;
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-surface shrink-0 transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[17.5rem]",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        {!collapsed && (
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search..."
              className="h-9 pl-8"
            />
          </div>
        )}
        {!collapsed && (
          <RunListSortFilter
            sort={sort}
            onSortChange={onSortChange}
            filterPb={filterPb}
            onFilterPbChange={onFilterPbChange}
            hasActiveFilters={hasActiveFilters}
          />
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onToggleInspector}
            title={inspectorOpen ? "Hide inspector" : "Show inspector"}
          >
            <ScanSearch
              className={cn("h-4 w-4", inspectorOpen && "text-foreground")}
            />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand runs" : "Collapse runs"}
        >
          {collapsed ? (
            <PanelRightOpen className="h-4 w-4" />
          ) : (
            <PanelRightClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* List */}
      <VirtualList
        items={!session ? [] : runs}
        estimateSize={collapsed ? 48 : 56}
        className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-2"
        emptyContent={
          <p className="px-2 py-6 text-center text-sm text-surface-muted-foreground">
            {collapsed
              ? "—"
              : !session
                ? "No session selected."
                : "No runs match the current search."}
          </p>
        }
        renderItem={useCallback(
          (run: HistoryRun) => {
            const isPrimary = primaryRun?.id === run.id;
            const isCompared = compareRun?.id === run.id;
            const isDimmedByInspector =
              !!primaryRun &&
              !isPrimary &&
              !isCompared &&
              run.scenarioName !== primaryRun.scenarioName;
            const isDimmedByScenario =
              !!selectedScenario &&
              !primaryRun &&
              run.scenarioName !== selectedScenario;
            const isDimmed = isDimmedByInspector || isDimmedByScenario;

            if (collapsed) {
              return (
                <button
                  type="button"
                  onClick={() => onSelectRun(run.id)}
                  className={cn(
                    "group relative flex w-full flex-col items-center overflow-hidden rounded-xl px-1 py-2 text-center transition-[transform,color,opacity] duration-220 ease-emphasized will-change-transform active:scale-[0.985]",
                    isCompared && "shadow-sm",
                    isDimmed && "opacity-40",
                  )}
                  title={`${run.scenarioName} — ${formatScore(run.score)}`}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 rounded-xl shadow-sm transition-[opacity,transform] duration-220 ease-emphasized",
                      isPrimary
                        ? "scale-100 bg-surface-muted opacity-100 shadow-md"
                        : isCompared
                          ? "scale-100 bg-surface-muted/70 opacity-100 shadow-md"
                          : "scale-[0.96] bg-surface-muted opacity-0 group-hover:scale-100 group-hover:opacity-100",
                    )}
                  />
                  <span className="relative z-10 text-xs font-semibold text-foreground">
                    {formatScore(run.score)}
                  </span>
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 text-[0.625rem] leading-tight text-surface-muted-foreground transition-colors duration-200",
                      (isPrimary || isCompared) && "text-foreground/70",
                    )}
                  >
                    {formatPercent(run.accuracy)}
                  </span>
                </button>
              );
            }

            return (
              <div
                className={cn(
                  "group relative flex items-center gap-1 overflow-hidden rounded-xl pr-1 transition-[transform,color,opacity] duration-220 ease-emphasized will-change-transform active:scale-[0.985]",
                  isCompared && "shadow-sm",
                  isDimmed && "opacity-40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-0 rounded-xl shadow-sm transition-[opacity,transform] duration-220 ease-emphasized",
                    isPrimary
                      ? "scale-100 bg-surface-muted opacity-100 shadow-md"
                      : isCompared
                        ? "scale-100 bg-surface-muted/70 opacity-100 shadow-md"
                        : "scale-[0.985] bg-surface-muted opacity-0 group-hover:scale-100 group-hover:opacity-100",
                  )}
                />
                <button
                  type="button"
                  onClick={() => onSelectRun(run.id)}
                  className="relative z-10 min-w-0 flex-1 px-3 py-2 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 truncate font-medium text-foreground">
                      {run.scenarioName}
                    </div>
                    <span className="shrink-0 font-semibold text-foreground">
                      {formatScore(run.score)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mt-1 flex items-center gap-2 text-xs text-surface-muted-foreground transition-colors duration-200",
                      (isPrimary || isCompared) && "text-foreground/70",
                    )}
                  >
                    <span>{formatDurationLabel(run.durationMs)}</span>
                    {run.accuracy !== null && (
                      <>
                        <span>·</span>
                        <span>{formatPercent(run.accuracy)} acc</span>
                      </>
                    )}
                  </div>
                </button>

                <Button
                  variant={isCompared ? "secondary" : "ghost"}
                  size="icon"
                  className={cn(
                    "relative z-10 h-7 w-7 shrink-0 transition-opacity",
                    isCompared
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompareRun(run.id);
                  }}
                  disabled={!primaryRun || isPrimary}
                  title={
                    !primaryRun
                      ? "Select a run first"
                      : isPrimary
                        ? "Primary run"
                        : "Compare"
                  }
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          },
          [
            collapsed,
            primaryRun,
            compareRun,
            selectedScenario,
            onSelectRun,
            onCompareRun,
          ],
        )}
      />
    </section>
  );
}

/* ─── Sort / Filter dropdown ─── */

const RUN_SORT_OPTIONS: { value: RunSortKey; label: string }[] = [
  { value: "default", label: "Chronological" },
  { value: "score-desc", label: "Score (high → low)" },
  { value: "score-asc", label: "Score (low → high)" },
  { value: "accuracy-desc", label: "Accuracy (high → low)" },
  { value: "scenario", label: "Group by scenario" },
];

function RunListSortFilter({
  sort,
  onSortChange,
  filterPb,
  onFilterPbChange,
  hasActiveFilters,
}: {
  sort: RunSortKey;
  onSortChange: (v: RunSortKey) => void;
  filterPb: boolean;
  onFilterPbChange: (v: boolean | ((prev: boolean) => boolean)) => void;
  hasActiveFilters: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveFilters ? "secondary" : "ghost"}
          size="icon"
          className="shrink-0"
          title="Sort & filter"
        >
          <ListFilter
            className={cn("h-4 w-4", hasActiveFilters && "text-foreground")}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52">
        {/* Sort */}
        <div className="px-2 py-1.5 text-[0.625rem] font-medium uppercase tracking-wider text-surface-muted-foreground">
          <ArrowUpDown className="mr-1 inline h-3 w-3" />
          Sort
        </div>
        {RUN_SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSortChange(opt.value)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition-colors",
              sort === opt.value
                ? "bg-surface-muted text-foreground"
                : "text-surface-muted-foreground hover:bg-surface-emphasis hover:text-foreground",
            )}
          >
            <span className="min-w-0 flex-1 text-left">{opt.label}</span>
            <Check
              className={cn(
                "h-3 w-3 shrink-0",
                sort === opt.value ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        ))}

        {/* Divider */}
        <div className="my-1 border-t border-border" />

        {/* Filters */}
        <div className="px-2 py-1.5 text-[0.625rem] font-medium uppercase tracking-wider text-surface-muted-foreground">
          <ListFilter className="mr-1 inline h-3 w-3" />
          Filter
        </div>
        <button
          type="button"
          onClick={() => onFilterPbChange((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition-colors",
            filterPb
              ? "bg-surface-muted text-foreground"
              : "text-surface-muted-foreground hover:bg-surface-emphasis hover:text-foreground",
          )}
        >
          <Trophy
            className={cn(
              "h-3 w-3 shrink-0",
              filterPb ? "text-amber-500" : "opacity-40",
            )}
          />
          PB runs only
        </button>
      </PopoverContent>
    </Popover>
  );
}
