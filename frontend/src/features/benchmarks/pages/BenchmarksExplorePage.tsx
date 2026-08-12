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
import { STORAGE_KEYS } from "@/shared/lib";
import type { Benchmark } from "@/shared/types";
import { ChevronDown, Dice5, Search, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BenchmarkCard } from "../components/BenchmarkCard";
import { getRecommendedBenchmarks } from "../lib/recommendations";

// ---------------------------------------------------------------------------
// Category mapping — maps benchmark abbreviations to high-level categories
// ---------------------------------------------------------------------------

const BENCHMARK_CATEGORIES: Record<string, string[]> = {
  "Aim Groups": [
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
  "Community Benchmarks": [
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
  "Notable Creator Benchmarks": [
    "A",
    "w",
    "TPT",
    "m",
    "M",
    "WH",
    "V",
    "D&R",
    "MH",
    "LEM",
    "LEI",
  ],
};
const DEFAULT_CATEGORY = "Other";

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

const sortOptions = [
  { label: "Name", value: "name" },
  { label: "Abbreviation", value: "abbreviation" },
  { label: "Date Added", value: "date" },
];

const groupOptions = [
  { label: "None", value: "none" },
  { label: "Abbreviation", value: "abbreviation" },
  { label: "Category", value: "category" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BenchmarksExplorePage() {
  const navigate = useNavigate();
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

  const showInitialSkeleton = loading && benchmarks.length === 0;
  const showRecommendationWarmup =
    showRecs && Object.keys(progressMap).length === 0;

  return (
    <div className="flex-1 overflow-auto text-sm">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-canvas px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">Benchmarks</h1>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted-foreground" />
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="h-9 pl-8 w-32 sm:w-48 focus:w-64 transition-all"
              />
            </div>

            {/* Sort */}
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <SelectTrigger className="h-9 w-auto min-w-[8rem] text-sm">
                <SelectValue>{`Sort: ${sortOptions.find((o) => o.value === sortBy)?.label}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
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
                <SelectValue>{`Group: ${groupOptions.find((o) => o.value === groupBy)?.label}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groupOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
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
              title="Open a random benchmark"
            >
              <Dice5 className="w-4 h-4" />
              Random
            </Button>

            <Button
              variant={showFavOnly ? "secondary" : "outline"}
              size="default"
              className="px-3"
              onClick={() => setShowFavOnly((v) => !v)}
              title={
                showFavOnly ? "Show all benchmarks" : "Show favorites only"
              }
            >
              <Star
                className="h-4 w-4"
                fill={showFavOnly ? "currentColor" : "none"}
              />
              {showFavOnly ? "Favorites" : "All"}
            </Button>

            <Button
              variant={showRecs ? "secondary" : "outline"}
              size="default"
              className="px-3"
              onClick={() => setShowRecs((v) => !v)}
              title={
                showRecs
                  ? "Hide recommendations"
                  : "Show recommended benchmarks"
              }
            >
              <Sparkles className="h-4 w-4" />
              Recommended
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
                Loading benchmark progress for recommendations...
              </div>
            )}

            {showRecs && recommendedBenchmarks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary mt-1 mb-2 select-none">
                  <Sparkles className="h-4 w-4" />
                  <span className="whitespace-nowrap">
                    Recommended{" "}
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
                  ? "Waiting for the benchmark catalog to finish syncing..."
                  : showFavOnly
                    ? "No favorite benchmarks yet. Star a benchmark to add it here."
                    : query
                      ? "No benchmarks match your search."
                      : "No benchmarks found."}
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
                          {group}{" "}
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
