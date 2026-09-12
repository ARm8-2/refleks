import { WidenDeep } from "../types";

/**
 * Benchmarks feature strings (explore page, benchmark detail page, progress
 * tracker, rank/strength widgets, recommendation legend, scenario modals and
 * cards). Benchmark/scenario/category/group/rank names and abbreviations are
 * game data from the backend and stay untranslated; only the UI labels around
 * them are catalogued. Machine values (sort/group/scope values, storage keys,
 * column keys) never translate.
 */
export const benchmarks = {
  explore: {
    title: "Benchmarks",
    sort: "Sort",
    group: "Group",
    random: "Random",
    randomTitle: "Open a random benchmark",
    showAll: "Show all benchmarks",
    showFavoritesOnly: "Show favorites only",
    favorites: "Favorites",
    recommended: "Recommended",
    hideRecommendations: "Hide recommendations",
    showRecommended: "Show recommended benchmarks",
    loadingRecommendations:
      "Loading benchmark progress for recommendations...",
    emptySyncing: "Waiting for the benchmark catalog to finish syncing...",
    emptyFavorites:
      "No favorite benchmarks yet. Star a benchmark to add it here.",
    emptySearch: "No benchmarks match your search.",
    emptyAll: "No benchmarks found.",
    sortOptions: {
      name: "Name",
      abbreviation: "Abbreviation",
      dateAdded: "Date Added",
    },
    groupOptions: {
      abbreviation: "Abbreviation",
      category: "Category",
    },
    categories: {
      aim: "Aim Groups",
      community: "Community Benchmarks",
      notable: "Notable Creator Benchmarks",
      other: "Other",
    },
  },
  detail: {
    difficulty: "Difficulty",
    playPlaylist: "Play benchmark playlist in Kovaak's",
    copied: "Copied!",
    copyScreenshot: "Copy progress table screenshot",
    favorite: "Favorite benchmark",
    unfavorite: "Unfavorite benchmark",
    notFound: "Benchmark not found.",
    unknownDifficulty: "Unknown difficulty",
    noProgress: "No progress data available yet for this difficulty.",
    clipboardUnsupported:
      "Image clipboard is not supported in this environment.",
    copyFailed: "Failed to copy screenshot.",
  },
  progressTable: {
    title: "Progress Tracker",
    snapshot: "Benchmark Progress Snapshot",
    compact: "Compact",
    enableCompact: "Enable compact mode",
    disableCompact: "Disable compact mode",
    lastPlayed: "Last Played",
    showLastPlayed: "Show last played highlight",
    hideLastPlayed: "Hide last played highlight",
    viewSettings: "View tracker settings",
    columnScenario: "Scenario",
    columnRec: "Rec",
    columnScore: "Score",
    details: "Details",
    settingsTitle: "Tracker Settings",
    featureColumns: "Feature Columns",
    columnLabelNotes: "Notes",
    columnLabelRecommendations: "Recommendations",
    columnLabelPlay: "Play",
    columnLabelHistory: "History",
    rankVisibility: "Rank Visibility",
    autoHideCleared: "Auto-hide earlier cleared ranks",
    keepVisible: "Keep visible:",
    resetManual: "Reset Manual",
    hiddenAutoTitle:
      "Hidden automatically because every scenario is already past this rank",
  },
  rankDistribution: {
    title: "Rank Distribution",
    scopeCategory: "Category",
    scopeSubcategory: "Subcategory",
    descriptionAll: "How your scenarios are spread across rank tiers.",
    descriptionCategory: "Category scope: {name}",
    descriptionSubcategory: "Subcategory scope: {name}",
    groupFallback: "Group {number}",
    belowR1: "Below R1",
    noData: "No data.",
    donutAriaLabel: "Rank distribution donut",
    scenarios: "Scenarios",
  },
  strength: {
    title: "Strength Breakdown",
    scopeCategory: "Category",
    scopeSubcategory: "Subcategory",
    scopeScenario: "Scenario",
    description: "{level}-level progress toward max rank.",
    unranked: "Unranked",
    noData: "No data.",
    avg: "Avg",
  },
  recommendationInfo: {
    ariaLabel: "About recommendations",
    title: "Recommendations",
    description:
      "Which scenarios are worth playing right now, based on your progress, recent score trends, and how recently you played each one.",
    completed: "Completed — max rank reached",
    topPick: "Top pick — best to play now",
    stronglyRecommended: "Strongly recommended",
    recommended: "Recommended — below average or improving",
    neutral: "Neutral",
    lowPriority: "Low priority",
    avoid: "Avoid for now — strong or trending down",
  },
  scenarioHistory: {
    title: "Scenario History · {scenario}",
    score: "Score",
    noScores: "No scores found.",
  },
  scenarioNotes: {
    trainingSensitivity: "Training Sensitivity",
    sensPlaceholder: "e.g. 35.8cm or 0.5",
    copySensitivity: "Copy sensitivity",
    notesLabel: "Notes",
    notesPlaceholder:
      "Track your strategy, weaknesses, and focus points...",
  },
  scenarioRow: {
    notesSensitivity: "Notes & Sensitivity",
    recommendationScore: "Recommendation score: {score}",
    playInKovaaks: "Play in Kovaak's",
    last10Scores: "Last 10 Scores",
  },
  card: {
    favorite: "Favorite",
    unfavorite: "Unfavorite",
  },
} as const;

export type BenchmarksMessages = WidenDeep<typeof benchmarks>;
