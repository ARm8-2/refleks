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
  ArrowUpDown,
  CalendarRange,
  Check,
  ListFilter,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Trophy,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { SessionSortKey } from "../hooks/useHistoryPageState";
import {
  formatCompactDate,
  formatDurationLabel,
  formatRelativeTime,
  formatSessionTitle,
  readSessionDurationMs,
  readSessionEndTimestamp,
} from "../lib/historyModels";
import { VirtualList } from "./VirtualList";

type Props = {
  sessions: Session[];
  selectedSessionId: string | null;
  collapsed: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectSession: (sessionId: string) => void;
  onToggleCollapsed: () => void;
  sort: SessionSortKey;
  onSortChange: (sort: SessionSortKey) => void;
  filterPb: boolean;
  onFilterPbChange: (v: boolean | ((prev: boolean) => boolean)) => void;
};

export function HistorySessionList({
  sessions,
  selectedSessionId,
  collapsed,
  query,
  onQueryChange,
  onSelectSession,
  onToggleCollapsed,
  sort,
  onSortChange,
  filterPb,
  onFilterPbChange,
}: Props) {
  const { t } = useTranslation("history");
  const hasActiveFilters = sort !== "newest" || filterPb;
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-surface shrink-0 transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[260px]",
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
              placeholder={t("sessions.search")}
              className="h-9 pl-8"
            />
          </div>
        )}
        {!collapsed && (
          <SessionListSortFilter
            sort={sort}
            onSortChange={onSortChange}
            filterPb={filterPb}
            onFilterPbChange={onFilterPbChange}
            hasActiveFilters={hasActiveFilters}
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onToggleCollapsed}
          title={collapsed ? t("sessions.expand") : t("sessions.collapse")}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* List */}
      <VirtualList
        items={sessions}
        estimateSize={collapsed ? 52 : 56}
        className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-2"
        emptyContent={
          <p className="px-2 py-6 text-center text-sm text-surface-muted-foreground">
            {collapsed ? "—" : t("sessions.empty")}
          </p>
        }
        renderItem={useCallback(
          (session: Session) => {
            const selected = session.id === selectedSessionId;
            const ts = readSessionEndTimestamp(session);
            const hasNotes = !!session.notes?.trim();

            if (collapsed) {
              return (
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "group relative flex w-full flex-col items-center overflow-hidden rounded-xl px-1 py-2 text-center transition-[transform,color,opacity] duration-220 ease-emphasized will-change-transform active:scale-[0.985]",
                  )}
                  title={formatSessionTitle(session)}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 rounded-xl bg-surface-muted shadow-sm transition-[opacity,transform] duration-220 ease-emphasized",
                      selected
                        ? "scale-100 opacity-100"
                        : "scale-[0.96] opacity-0 group-hover:scale-100 group-hover:opacity-100",
                    )}
                  />
                  <CalendarRange
                    className={cn(
                      "relative z-10 h-4 w-4 text-surface-muted-foreground transition-colors duration-200",
                      selected && "text-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "relative z-10 mt-1 text-[10px] leading-tight text-surface-muted-foreground transition-colors duration-200",
                      selected && "font-medium text-foreground",
                    )}
                  >
                    {formatCompactDate(ts)}
                  </span>
                </button>
              );
            }

            return (
              <button
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={cn(
                  "group relative w-full overflow-hidden rounded-xl px-3 py-2 text-left transition-[transform,color,opacity] duration-220 ease-emphasized will-change-transform active:scale-[0.985]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-0 rounded-xl bg-surface-muted shadow-sm transition-[opacity,transform] duration-220 ease-emphasized",
                    selected
                      ? "scale-100 opacity-100"
                      : "scale-[0.985] opacity-0 group-hover:scale-100 group-hover:opacity-100",
                  )}
                />
                <div className="relative z-10 flex items-start justify-between gap-2">
                  <div className="min-w-0 truncate text-foreground">
                    {formatSessionTitle(session)}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {hasNotes && (
                      <span title={t("sessions.notes")}>
                        <NotebookPen className="h-3.5 w-3.5 text-primary" />
                      </span>
                    )}
                    <span className="text-[11px] text-surface-muted-foreground">
                      {formatRelativeTime(ts)}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "relative z-10 mt-1 flex items-center gap-2 text-xs text-surface-muted-foreground transition-colors duration-200",
                    selected && "text-foreground/70",
                  )}
                >
                  <span>
                    {session.items.length}{" "}
                    {session.items.length === 1 ? t("sessions.run") : t("sessions.runs")}
                  </span>
                  <span>·</span>
                  <span>
                    {formatDurationLabel(readSessionDurationMs(session))}
                  </span>
                </div>
              </button>
            );
          },
          [collapsed, selectedSessionId, onSelectSession],
        )}
      />
    </aside>
  );
}

/* ─── Sort dropdown ─── */

const SESSION_SORT_OPTIONS: SessionSortKey[] = [
  "newest",
  "oldest",
  "most-runs",
  "longest",
];
const SESSION_SORT_LABEL_KEYS = {
  newest: "sessions.newest",
  oldest: "sessions.oldest",
  "most-runs": "sessions.mostRuns",
  longest: "sessions.longest",
} as const;

function SessionListSortFilter({
  sort,
  onSortChange,
  filterPb,
  onFilterPbChange,
  hasActiveFilters,
}: {
  sort: SessionSortKey;
  onSortChange: (v: SessionSortKey) => void;
  filterPb: boolean;
  onFilterPbChange: (v: boolean | ((prev: boolean) => boolean)) => void;
  hasActiveFilters: boolean;
}) {
  const { t } = useTranslation("history");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveFilters ? "secondary" : "ghost"}
          size="icon"
          className="shrink-0"
          title={t("sessions.sortFilter")}
        >
          <ListFilter
            className={cn("h-4 w-4", hasActiveFilters && "text-foreground")}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44">
        {/* Sort */}
        <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-surface-muted-foreground">
          <ArrowUpDown className="mr-1 inline h-3 w-3" />
          {t("sessions.sort")}
        </div>
        {SESSION_SORT_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSortChange(option)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition-[transform,background-color,color] duration-200 ease-emphasized will-change-transform active:scale-[0.985]",
              sort === option
                ? "bg-surface-muted text-foreground"
                : "text-surface-muted-foreground hover:bg-surface-emphasis hover:text-foreground",
            )}
          >
            <span className="min-w-0 flex-1 text-left">
              {t(SESSION_SORT_LABEL_KEYS[option])}
            </span>
            <Check
              className={cn(
                "h-3 w-3 shrink-0",
                sort === option ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        ))}

        {/* Divider */}
        <div className="my-1 border-t border-border" />

        {/* Filters */}
        <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-surface-muted-foreground">
          <ListFilter className="mr-1 inline h-3 w-3" />
          {t("sessions.filter")}
        </div>
        <button
          type="button"
          onClick={() => onFilterPbChange((v) => !v)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition-[transform,background-color,color] duration-200 ease-emphasized will-change-transform active:scale-[0.985]",
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
          {t("sessions.containsPb")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
