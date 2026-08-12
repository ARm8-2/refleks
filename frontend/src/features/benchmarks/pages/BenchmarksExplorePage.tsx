import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components";
import { useBenchmarks, usePersistedState, useStore } from "@/shared/hooks";
import { STORAGE_KEYS, useI18n, type MessageKey } from "@/shared/lib";
import type { Benchmark } from "@/shared/types";
import { ChevronDown, Dice5, Search, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BenchmarkCard } from "../components/BenchmarkCard";
import { getRecommendedBenchmarks } from "../lib/recommendations";

// ---------------------------------------------------------------------------
// Category mapping — maps benchmark abbreviations to high-level categories.
// Map keys are internal codes; display names come from the catalog at render
// time via CATEGORY_LABEL_KEYS. Benchmark abbreviations are data and stay as-is.
// ---------------------------------------------------------------------------

const BENCHMARK_CATEGORIES: Record<string, string[]> = {
  aim: [
    "VT",
    "rA",
    "xyz",
    "A+",
    "cAt",
    "CB",
    "MIR",
    "STR",
    "JP",
    "cA",
    "STK",
    "TSK",
    "RXZU",
    "ZERO",
    "RVG",
  ],
  community: [
    "AQ!",
    "AOI",
    "e",
    "roa",
    "AS",
    "ATB",
    "ATF",
    "cR",
    "DM",
    "ETB",
    "GM",
    "HEW",
    "mHb",
    "pA",
    "PG",
    "sA",
    "R&G",
    "RBE",
    "rxn",
    "Ssb",
    "TNT",
    "TZY",
    "VR",
    "pnv1",
    "SFB",
    "二三",
    "ZAC",
    "vA",
    "UVB",
    "U33",
    "SFS S1",
    "SCS",
    "SCPRP",
    "RFLX",
    "RBN",
    "PP",
    "NRS",
    "nA",
    "MG",
    "MCB",
    "JAY9",
    "ife",
    "I33",
    "HB",
    "FNP",
    "EMP",
    "EMB",
    "catburg",
    "BD",
    "773TS",
    "350",
  ],
  notable: ["A", "w", "TPT", "m", "M", "WH", "V", "D&R", "MH", "LEM", "LEI"],
};
const DEFAULT_CATEGORY = "other";

/** Internal category code -> catalog key for the group header label. */
const CATEGORY_LABEL_KEYS: Record<string, MessageKey> = {
  aim: "benchmarks.explore.categories.aim",
  community: "benchmarks.explore.categories.community",
  notable: "benchmarks.explore.categories.notable",
  other: "benchmarks.explore.categories.other",
};

function getBenchmarkCategory(abbreviation: string): string {
  const abbr = (abbreviation ?? "").trim();
  if (!abbr) return DEFAULT_CATEGORY;
  for (const [cat, aliases] of Object.entries(BENCHMARK_CATEGORIES)) {
    if (aliases.includes(abbr)) return cat;
  }
  return DEFAULT_CATEGORY;
}

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type SortBy = "name" | "abbreviation" | "date";
type GroupBy = "none" | "abbreviation" | "category";

const sortOptions: { value: SortBy; labelKey: MessageKey }[] = [
  { value: "name", labelKey: "benchmarks.explore.sortOptions.name" },
  {
    value: "abbreviation",
    labelKey: "benchmarks.explore.sortOptions.abbreviation",
  },
  { value: "date", labelKey: "benchmarks.explore.sortOptions.dateAdded" },
];

const groupOptions: { value: GroupBy; labelKey: MessageKey }[] = [
  { value: "none", labelKey: "common.actions.none" },
  {
    value: "abbreviation",
    labelKey: "benchmarks.explore.groupOptions.abbreviation",
  },
  { value: "category", labelKey: "benchmarks.explore.groupOptions.category" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BenchmarksExplorePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    benchmarks,
    loading,
    isFavorite,
    toggleFavorite,
    progressMap,
    loadAllProgress,
  } = useBenchmarks();
  const sessions = useStore((s) => s.sessions);

  // Persisted page-level UI state
  const [query, setQuery] = usePersistedState(STORAGE_KEYS.benchmarksQuery, "");
  const [showFavOnly, setShowFavOnly] = usePersistedState(
    STORAGE_KEYS.benchmarksFavOnly,
    false,
  );
  const [showRecs, setShowRecs] = usePersistedState(
    STORAGE_KEYS.benchmarksShowRecs,
    false,
  );
  const [sortBy, setSortBy] = usePersistedState<SortBy>(
    STORAGE_KEYS.benchmarksSortBy,
    "abbreviation",
  );
  const [groupBy, setGroupBy] = usePersistedState<GroupBy>(
    STORAGE_KEYS.benchmarksGroupBy,
    "category",
  );
  const [collapsedGroups, setCollapsedGroups] = usePersistedState<
    Record<string, boolean>
  >(STORAGE_KEYS.benchmarksCollapsed, {});

  const toggleGroup = (group: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  // Load all progress data when recommendations are enabled
  useEffect(() => {
    if (showRecs) loadAllProgress();
  }, [showRecs, loadAllProgress]);

  // Recommended benchmarks
  const recommendedBenchmarks = useMemo(() => {
    if (!showRecs || benchmarks.length === 0) return [];
    return getRecommendedBenchmarks(benchmarks, progressMap, sessions);
  }, [showRecs, benchmarks, progressMap, sessions]);

  // Filtered list
  const filtered = useMemo(() => {
    let items = benchmarks;

    if (showFavOnly) {
      items = items.filter((b) => isFavorite(b.benchmarkName));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(
        (b) =>
          b.benchmarkName.toLowerCase().includes(q) ||
          b.abbreviation.toLowerCase().includes(q),
      );
    }

    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "abbreviation":
          return a.abbreviation.localeCompare(b.abbreviation);
        case "date":
          return (b.dateAdded || "").localeCompare(a.dateAdded || "");
        default:
          return a.benchmarkName.localeCompare(b.benchmarkName);
      }
    });
  }, [benchmarks, query, showFavOnly, sortBy, isFavorite]);

  // Grouped result
  const { groups, groupKeys } = useMemo(() => {
    if (groupBy === "none") {
      return { groups: { All: filtered }, groupKeys: ["All"] };
    }

    const g: Record<string, Benchmark[]> = {};
    for (const item of filtered) {
      const key =
        groupBy === "abbreviation"
          ? item.abbreviation
          : getBenchmarkCategory(item.abbreviation);
      if (!g[key]) g[key] = [];
      g[key].push(item);
    }

    const keys = Object.keys(g).sort((a, b) => {
      if (a === "All") return -1;
      if (b === "All") return 1;
      // Push "Other" to the end
      if (a === DEFAULT_CATEGORY) return 1;
      if (b === DEFAULT_CATEGORY) return -1;
      return a.localeCompare(b);
    });

    return { groups: g, groupKeys: keys };
  }, [filtered, groupBy]);

  const handleRandom = () => {
    const list = filtered.length ? filtered : benchmarks;
    if (list.length === 0) return;
    const b = list[Math.floor(Math.random() * list.length)];
    navigate(`/benchmarks/${encodeURIComponent(b.benchmarkName)}`);
  };

  const handleSelectBenchmark = (name: string) => {
    navigate(`/benchmarks/${encodeURIComponent(name)}`);
  };

  /** Group header label: catalog for known categories, raw key otherwise (abbreviations are data). */
  const groupLabel = (group: string) => {
    const labelKey = CATEGORY_LABEL_KEYS[group];
    return labelKey ? t(labelKey) : group;
  };

  const showInitialSkeleton = loading && benchmarks.length === 0;
  const showRecommendationWarmup =
    showRecs && Object.keys(progressMap).length === 0;

  return (
    <div className="flex-1 overflow-auto text-sm">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-canvas px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">
            {t("benchmarks.explore.title")}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted-foreground" />
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                className="h-9 pl-8 w-32 sm:w-48 focus:w-64 transition-all"
              />
            </div>

            {/* Sort */}
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <SelectTrigger className="h-9 w-auto min-w-[8rem] text-sm">
                <SelectValue>{`${t("benchmarks.explore.sort")}: ${t(
                  sortOptions.find((o) => o.value === sortBy)?.labelKey ??
                    sortOptions[0].labelKey,
                )}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Group */}
            <Select
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as GroupBy)}
            >
              <SelectTrigger className="h-9 w-auto min-w-[8rem] text-sm">
                <SelectValue>{`${t("benchmarks.explore.group")}: ${t(
                  groupOptions.find((o) => o.value === groupBy)?.labelKey ??
                    groupOptions[0].labelKey,
                )}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groupOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Random */}
            <Button
              variant="outline"
              size="default"
              className="px-3"
              onClick={handleRandom}
              title={t("benchmarks.explore.randomTitle")}
            >
              <Dice5 className="w-4 h-4" />
              {t("benchmarks.explore.random")}
            </Button>

            <Button
              variant={showFavOnly ? "secondary" : "outline"}
              size="default"
              className="px-3"
              onClick={() => setShowFavOnly((v) => !v)}
              title={
                showFavOnly
                  ? t("benchmarks.explore.showAll")
                  : t("benchmarks.explore.showFavoritesOnly")
              }
            >
              <Star
                className="h-4 w-4"
                fill={showFavOnly ? "currentColor" : "none"}
              />
              {showFavOnly
                ? t("benchmarks.explore.favorites")
                : t("common.actions.all")}
            </Button>

            <Button
              variant={showRecs ? "secondary" : "outline"}
              size="default"
              className="px-3"
              onClick={() => setShowRecs((v) => !v)}
              title={
                showRecs
                  ? t("benchmarks.explore.hideRecommendations")
                  : t("benchmarks.explore.showRecommended")
              }
            >
              <Sparkles className="h-4 w-4" />
              {t("benchmarks.explore.recommended")}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {showInitialSkeleton ? (
          <div className="space-y-3">
            <div className="h-8 w-56 animate-pulse rounded-xl bg-surface-subtle" />
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[4.25rem] animate-pulse rounded-xl bg-surface-subtle"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Recommended benchmarks section */}
            {showRecs && showRecommendationWarmup && (
              <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-surface-muted-foreground">
                {t("benchmarks.explore.loadingRecommendations")}
              </div>
            )}

            {showRecs && recommendedBenchmarks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary mt-1 mb-2 select-none">
                  <Sparkles className="h-4 w-4" />
                  <span className="whitespace-nowrap">
                    {t("benchmarks.explore.recommended")}{" "}
                    <span className="text-xs opacity-50">
                      ({recommendedBenchmarks.length})
                    </span>
                  </span>
                  <div className="h-px bg-primary-muted flex-1" />
                </div>
                <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
                  {recommendedBenchmarks.map((b) => (
                    <BenchmarkCard
                      key={b.benchmarkName}
                      benchmark={b}
                      isFavorite={isFavorite(b.benchmarkName)}
                      onToggleFavorite={() => toggleFavorite(b.benchmarkName)}
                      onSelect={() => handleSelectBenchmark(b.benchmarkName)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="text-sm text-surface-muted-foreground py-8 text-center">
                {benchmarks.length === 0
                  ? t("benchmarks.explore.emptySyncing")
                  : showFavOnly
                    ? t("benchmarks.explore.emptyFavorites")
                    : query
                      ? t("benchmarks.explore.emptySearch")
                      : t("benchmarks.explore.emptyAll")}
              </div>
            ) : (
              groupKeys.map((group) => {
                const isCollapsed = collapsedGroups[group] || false;
                const items = groups[group];

                return (
                  <div key={group} className="space-y-2">
                    {/* Group header (only when grouping is active) */}
                    {groupBy !== "none" && (
                      <button
                        onClick={() => toggleGroup(group)}
                        className="flex items-center gap-2 text-sm font-medium text-surface-muted-foreground mt-2 mb-2 w-full hover:text-foreground transition-colors text-left group/hdr select-none"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                        />
                        <span className="whitespace-nowrap">
                          {groupLabel(group)}{" "}
                          <span className="text-xs opacity-50">
                            ({items.length})
                          </span>
                        </span>
                        <div className="h-px bg-primary-faint flex-1 group-hover/hdr:bg-primary-muted transition-colors" />
                      </button>
                    )}

                    {/* Cards grid */}
                    {!isCollapsed && (
                      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
                        {items.map((b) => (
                          <BenchmarkCard
                            key={b.benchmarkName}
                            benchmark={b}
                            isFavorite={isFavorite(b.benchmarkName)}
                            onToggleFavorite={() =>
                              toggleFavorite(b.benchmarkName)
                            }
                            onSelect={() =>
                              handleSelectBenchmark(b.benchmarkName)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
