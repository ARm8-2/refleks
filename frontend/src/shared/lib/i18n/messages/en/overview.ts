import { plural } from "../../plural";
import { WidenDeep } from "../types";

/**
 * Overview feature strings (OverviewPage, benchmark overview widget, session
 * widgets and their hooks). Benchmark/scenario names and other game data stay
 * untranslated; only the labels around them are catalogued.
 */
export const overview = {
  page: {
    loadingHistory: "Loading run history...",
    loadingHistoryProgress: "Loading run history {loaded}/{total}...",
  },
  benchmarkOverview: {
    title: "Benchmark Overview",
    noSelection:
      "No benchmark selected yet. Pick one to track your progress here.",
    browseBenchmarks: "Browse Benchmarks",
    loadingProgress: "Loading progress…",
    difficulty: "Difficulty",
    playPlaylist: "Play benchmark playlist in Kovaak's",
    disableCompact: "Disable compact mode",
    enableCompact: "Enable compact mode",
    compact: "Compact",
    widgetSettings: "Widget settings",
    columns: {
      scenario: "Scenario",
      rec: "Rec",
      score: "Score",
      details: "Details",
    },
    noRecentScenario: "No recent scenario for this benchmark",
    noRecommendations: "No recommendations yet",
    settings: {
      title: "Widget Settings",
      featureColumns: "Feature Columns",
      notes: "Notes",
      recommendations: "Recommendations",
      play: "Play",
      history: "History",
      rankVisibility: "Rank Visibility",
      autoHide: "Auto-hide earlier cleared ranks",
      keepVisible: "Keep visible:",
      resetManual: "Reset Manual",
      hiddenAuto:
        "Hidden automatically because every scenario is already past this rank",
    },
  },
  lastRun: {
    title: "Last Run",
    noScoreData: "No score data",
    trendLabel: "Trend: last 40% vs first 60%",
    scoreAccuracy: "Score & accuracy",
    runs: plural({ one: "1 run", other: "{count} runs" }),
  },
  recentScores: {
    title: "Recent Scores",
    empty: "Play a scenario to see recent scores here.",
    score: "Score",
    sessionBest: "Session Best",
    personalBest: "Personal Best",
    sessionBestLine: "Session Best: {score}",
    personalBestLine: "Personal Best: {score}",
    last: "Last {count}",
  },
  performance: {
    title: "Performance",
  },
  status: {
    noSession: "No session",
    noSessionLoaded: "No session loaded",
    noRunDuration: "No run duration data",
    noRecentActivity: "No recent activity",
    needMoreHistory: "Need more history",
    elapsedSoFar: "Elapsed so far",
    latestSessionWindow: "Latest session window",
    activePct: "{count}% active",
    todayPlaytime: "{count} today",
    lastActive: "Last active {day}",
    unknownTime: "Unknown time",
    buildingSignal: "Building signal",
    needOlderRuns:
      "Need older comparison runs or repeated scenarios",
    aboveUsual: "Above usual",
    belowUsual: "Below usual",
    onPace: "On pace",
    warmingUp: "Warming up",
    coolingOff: "Cooling off",
    steady: "Steady",
    today: "today",
    yesterday: "yesterday",
    comparableRuns: "{label} across {count} comparable runs",
    repeatedScenarios: "{label} based on repeated scenarios in this session",
  },
  sessionProgress: {
    title: "Session Progress",
    empty: "Play or import a few runs to see session progress.",
    editTarget: "Edit session target",
    target: "target",
    targetAuto: "target auto",
    targetRuns: "Session target runs",
    customTarget: "Custom target",
    automaticTarget: "Automatic target",
    warmup: "Warm-up",
    peak: "Peak",
    diminishing: "Diminishing",
    targetSuffix: "/ {count} target",
  },
  sessionPlaytime: {
    title: "Session & Playtime",
  },
  streakPlaytime: {
    title: "Streak & Playtime",
    breakdownTitle: "Streak & Playtime Breakdown",
    playtime: "Playtime",
    currentStreak: "Current streak",
    topStreak: "Top streak",
    activeDays: "Active days",
    totalPlaytime: "Total playtime",
    activity: "Activity",
    less: "Less",
    more: "More",
    noStreak: "No streak",
    days: plural({ one: "1 day", other: "{count} days" }),
    playtimeLabel: "Playtime: ",
    streakLabel: "Streak: ",
    byHour: "By Hour",
    byWeekday: "By Weekday",
    streakDays: "Streak Days",
    clickDay: "Click a day above to inspect its playtime breakdown.",
    switchViews:
      "You can switch between hour, weekday, and streak-day views after selecting a day.",
    dayAriaLabel: "{date}: {playtime} playtime, {streak}{today}",
  },
  dailyPlaytime: {
    today: "Today",
  },
  currentScenarioHistory: {
    attempt: "Attempt {count}",
    attemptWithDate: "Attempt {count} · {date}",
    runs: plural({ one: "1 run", other: "{count} runs" }),
    sessionRange: "{start} to {end} · {count} {runs}",
  },
} as const;

export type OverviewMessages = WidenDeep<typeof overview>;
