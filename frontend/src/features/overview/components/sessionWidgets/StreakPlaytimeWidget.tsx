import { SegmentedControl, Widget, WidgetEmpty } from "@/shared/components";
import type { ChartConfig } from "@/shared/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { usePersistedState, useStore } from "@/shared/hooks";
import {
  CHART_SERIES_COLORS,
  CHART_STYLE,
  STORAGE_KEYS,
  useI18n,
} from "@/shared/lib";
import { getLocale } from "@/shared/lib/i18n";
import { Flame, Trophy } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { useDailyPlaytime } from "../../hooks/useDailyPlaytime";
import type { RecentSessionSnapshot } from "../../hooks/useRecentSessionSnapshot";
import {
  buildActivityRange,
  buildDailyActivityForSelectedStreak,
  buildDailyActivityForWeek,
  buildHourlyActivityForDay,
  buildStreakActivity,
} from "../../lib/streakActivity";

const playtimeConfig: ChartConfig = {
  minutes: { label: "Playtime", color: CHART_SERIES_COLORS.accuracy },
};

const drilldownConfig: ChartConfig = {
  minutes: { label: "Playtime", color: "var(--streak)" },
};

const AUTO_RANGE_DAYS = 0;
const STREAK_RANGE_OPTIONS = [AUTO_RANGE_DAYS, 30, 90, 180, 365] as const;
const BREAKDOWN_MODES = ["day", "week", "streak"] as const;

type StreakRangeOption = (typeof STREAK_RANGE_OPTIONS)[number];
type BreakdownMode = (typeof BREAKDOWN_MODES)[number];

// --- Locale-aware Intl formatters (cached per locale) ---

let dayFormatterLocale: string | null = null;
let dayFormatter: Intl.DateTimeFormat | null = null;
function getDayFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (!dayFormatter || dayFormatterLocale !== locale) {
    dayFormatterLocale = locale;
    dayFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return dayFormatter;
}

let monthFormatterLocale: string | null = null;
let monthFormatter: Intl.DateTimeFormat | null = null;
function getMonthFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (!monthFormatter || monthFormatterLocale !== locale) {
    monthFormatterLocale = locale;
    monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  }
  return monthFormatter;
}

let weekdayFormatterLocale: string | null = null;
let weekdayFormatter: Intl.DateTimeFormat | null = null;
function getWeekdayFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (!weekdayFormatter || weekdayFormatterLocale !== locale) {
    weekdayFormatterLocale = locale;
    weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  }
  return weekdayFormatter;
}

let streakDayFormatterLocale: string | null = null;
let streakDayFormatter: Intl.DateTimeFormat | null = null;
function getStreakDayFormatter(): Intl.DateTimeFormat {
  const locale = getLocale();
  if (!streakDayFormatter || streakDayFormatterLocale !== locale) {
    streakDayFormatterLocale = locale;
    streakDayFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    });
  }
  return streakDayFormatter;
}

// Heatmap row labels (Sunday-first grid). Keeps the compact layout by only
// labeling Monday, Wednesday and Friday, like the original design.
function buildWeekdayLabels(): string[] {
  const labels = Array.from({ length: 7 }, (_, index) =>
    getWeekdayFormatter().format(new Date(2024, 0, 7 + index)),
  );
  return labels.map((label, index) =>
    index === 1 || index === 3 || index === 5 ? label : "",
  );
}

type MonthMarker = {
  label: string;
  column: number;
};

const intensityOpacityByLevel: Record<1 | 2 | 3 | 4, number> = {
  1: 0.2,
  2: 0.38,
  3: 0.56,
  4: 0.78,
};

export function StreakPlaytimeWidget({
  snapshot,
}: {
  snapshot: RecentSessionSnapshot;
}) {
  const { t, locale } = useI18n();
  const points = useDailyPlaytime(7);
  const sessions = useStore((state) => state.sessions);
  const [storedRangeDays, setStoredRangeDays] = usePersistedState<number>(
    STORAGE_KEYS.overviewStreakRangeDays,
    AUTO_RANGE_DAYS,
  );
  const [storedSelectedDayTs, setStoredSelectedDayTs] = usePersistedState<
    number | null
  >(STORAGE_KEYS.overviewStreakSelectedDayTs, null);
  const [storedBreakdownMode, setStoredBreakdownMode] =
    usePersistedState<BreakdownMode>(
      STORAGE_KEYS.overviewStreakBreakdownMode,
      "day",
    );

  const selectedDayTs = normalizeSelectedDayTs(storedSelectedDayTs);
  const todayDayTs = normalizeSelectedDayTs(Date.now());
  const breakdownMode = normalizeBreakdownMode(storedBreakdownMode);

  const hasData = points.some((p) => p.minutes > 0);
  const chartData = hasData
    ? points
    : points.map((p) => ({ ...p, minutes: 0.5 }));
  const rangeDays = normalizeRangeDays(storedRangeDays);

  const streakActivity = useMemo(
    () => buildStreakActivity(sessions),
    [sessions],
  );
  const maxAvailableRangeDays = useMemo(() => {
    const earliestDayTs = streakActivity.dailyPlaytime[0]?.dayTs;
    if (typeof earliestDayTs !== "number") return 30;
    return Math.max(1, daysBetweenInclusive(earliestDayTs, Date.now()));
  }, [streakActivity.dailyPlaytime]);
  const effectiveRangeDays =
    rangeDays === AUTO_RANGE_DAYS ? maxAvailableRangeDays : rangeDays;

  const rangeSummary = useMemo(
    () => buildActivityRange(streakActivity, effectiveRangeDays),
    [effectiveRangeDays, streakActivity],
  );

  const heatmapCells = useMemo(() => {
    if (rangeSummary.cells.length === 0)
      return [] as Array<{
        dayTs: number;
        playtimeMs: number;
        level: 0 | 1 | 2 | 3 | 4;
      }>;

    const values = rangeSummary.cells
      .map((cell) => cell.playtimeMs / 60000)
      .filter((value) => value > 0)
      .sort((left, right) => left - right);

    const q1 = quantile(values, 0.25);
    const q2 = quantile(values, 0.5);
    const q3 = quantile(values, 0.75);

    return rangeSummary.cells.map((cell) => {
      const minutes = cell.playtimeMs / 60000;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (minutes > 0) {
        if (minutes <= q1) level = 1;
        else if (minutes <= q2) level = 2;
        else if (minutes <= q3) level = 3;
        else level = 4;
      }

      return {
        dayTs: cell.dayTs,
        playtimeMs: cell.playtimeMs,
        level,
      };
    });
  }, [rangeSummary.cells]);

  const paddedHeatmapCells = useMemo(() => {
    if (heatmapCells.length === 0)
      return [] as Array<{
        dayTs: number;
        playtimeMs: number;
        level: 0 | 1 | 2 | 3 | 4;
      } | null>;

    const firstDate = new Date(heatmapCells[0].dayTs);
    const leadingPad = firstDate.getDay();
    const trailingPad = (7 - ((leadingPad + heatmapCells.length) % 7)) % 7;

    return [
      ...Array.from({ length: leadingPad }, () => null),
      ...heatmapCells,
      ...Array.from({ length: trailingPad }, () => null),
    ];
  }, [heatmapCells]);

  const monthMarkers = useMemo<MonthMarker[]>(() => {
    const markers: MonthMarker[] = [];
    let lastMonthKey = "";

    paddedHeatmapCells.forEach((cell, index) => {
      if (!cell) return;

      const date = new Date(cell.dayTs);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthKey === lastMonthKey) return;

      lastMonthKey = monthKey;
      markers.push({
        label: getMonthFormatter().format(date),
        column: Math.floor(index / 7),
      });
    });

    return markers;
    // Month names follow the active locale.
  }, [paddedHeatmapCells, locale]);

  const visibleMonthMarkers = useMemo(
    () =>
      monthMarkers.filter(
        (marker, index) =>
          !(monthMarkers.length > 1 && index === 0 && marker.column === 0),
      ),
    [monthMarkers],
  );

  const streakLengthByDayTs = useMemo(() => {
    const map = new Map<number, number>();

    for (const span of streakActivity.streakSpans) {
      for (let cursor = span.startTs; cursor <= span.endTs;) {
        map.set(cursor, span.days);

        const nextCursor = new Date(cursor);
        nextCursor.setDate(nextCursor.getDate() + 1);
        nextCursor.setHours(0, 0, 0, 0);
        cursor = nextCursor.getTime();
      }
    }

    return map;
  }, [streakActivity.streakSpans]);

  const topStreakDayTs = useMemo(() => {
    const targetDays = streakActivity.topStreak;
    if (targetDays <= 0) return null;

    let mostRecentTopDay: number | null = null;
    for (const span of streakActivity.streakSpans) {
      if (span.days !== targetDays) continue;
      if (mostRecentTopDay === null || span.endTs > mostRecentTopDay) {
        mostRecentTopDay = span.endTs;
      }
    }

    return mostRecentTopDay;
  }, [streakActivity.streakSpans, streakActivity.topStreak]);

  useEffect(() => {
    if (selectedDayTs === null) return;
    const stillVisible = heatmapCells.some(
      (cell) => cell.dayTs === selectedDayTs,
    );
    if (!stillVisible) setStoredSelectedDayTs(null);
  }, [heatmapCells, selectedDayTs, setStoredSelectedDayTs]);

  const dailyBreakdown = useMemo(
    () =>
      selectedDayTs === null
        ? []
        : buildHourlyActivityForDay(sessions, selectedDayTs).map((point) => ({
            key: `${point.hour}`,
            label: `${String(point.hour).padStart(2, "0")}:00`,
            fullLabel: hourRangeLabel(point.hour),
            minutes: point.playtimeMs / 60000,
          })),
    [selectedDayTs, sessions],
  );

  const weeklyBreakdown = useMemo(
    () =>
      selectedDayTs === null
        ? []
        : buildDailyActivityForWeek(streakActivity, selectedDayTs).map(
            (point) => ({
              key: `${point.dayTs}`,
              label: weekTickFormatter(new Date(point.dayTs)),
              fullLabel: getDayFormatter().format(new Date(point.dayTs)),
              minutes: point.playtimeMs / 60000,
            }),
          ),
    // Date labels follow the active locale.
    [selectedDayTs, streakActivity, locale],
  );

  const streakBreakdown = useMemo(
    () =>
      selectedDayTs === null
        ? []
        : buildDailyActivityForSelectedStreak(
            streakActivity,
            selectedDayTs,
          ).map((point) => ({
            key: `${point.dayTs}`,
            label: streakTickFormatter(new Date(point.dayTs)),
            fullLabel: getDayFormatter().format(new Date(point.dayTs)),
            minutes: point.playtimeMs / 60000,
          })),
    // Date labels follow the active locale.
    [selectedDayTs, streakActivity, locale],
  );

  const selectedBreakdown =
    breakdownMode === "day"
      ? dailyBreakdown
      : breakdownMode === "week"
        ? weeklyBreakdown
        : streakBreakdown;
  const hasSelectedBreakdown = selectedDayTs !== null;
  const selectedBreakdownLabel =
    selectedDayTs === null
      ? ""
      : getDayFormatter().format(new Date(selectedDayTs));

  const selectActivityDay = (dayTs: number) => {
    const normalizedDayTs = normalizeSelectedDayTs(dayTs);
    if (normalizedDayTs === null) return;

    if (selectedDayTs === normalizedDayTs) {
      setStoredSelectedDayTs(null);
      return;
    }

    const requiredRangeDays = daysBetweenInclusive(normalizedDayTs, Date.now());
    const nextRangeDays = pickRangeDays(requiredRangeDays);
    if (rangeDays !== AUTO_RANGE_DAYS && nextRangeDays > effectiveRangeDays)
      setStoredRangeDays(nextRangeDays);

    setStoredSelectedDayTs(normalizedDayTs);
  };

  if (!snapshot.currentSession)
    return (
      <WidgetEmpty icon={Flame} label={t("overview.streakPlaytime.title")} />
    );

  const { streakLabel, streakDetail } = snapshot;

  const modalControls = (
    <SegmentedControl
      value={rangeDays}
      options={STREAK_RANGE_OPTIONS.map((days) => ({
        value: days,
        label:
          days === AUTO_RANGE_DAYS
            ? t("common.actions.all")
            : days === 365
              ? "1Y"
              : `${Math.round(days / 30)}M`,
      }))}
      onValueChange={setStoredRangeDays}
      size="sm"
    />
  );

  const weekdayLabels = useMemo(() => buildWeekdayLabels(), [locale]);

  // Chart series labels follow the active locale; `t` is referentially stable
  // so the locale drives recomputation.
  const playtimeConfig = useMemo<ChartConfig>(
    () => ({
      minutes: {
        label: t("overview.streakPlaytime.playtime"),
        color: CHART_SERIES_COLORS.accuracy,
      },
    }),
    [locale, t],
  );
  const drilldownConfig = useMemo<ChartConfig>(
    () => ({
      minutes: {
        label: t("overview.streakPlaytime.playtime"),
        color: "var(--streak)",
      },
    }),
    [locale, t],
  );

  const modalContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label={t("overview.streakPlaytime.currentStreak")}
          value={t("overview.streakPlaytime.days", {
            count: streakActivity.currentStreak,
          })}
        />
        <MetricCard
          label={t("overview.streakPlaytime.topStreak")}
          value={t("overview.streakPlaytime.days", {
            count: snapshot.topStreak,
          })}
          icon={<Trophy className="h-3 w-3 text-amber-500" />}
          onClick={
            topStreakDayTs === null
              ? undefined
              : () => selectActivityDay(topStreakDayTs)
          }
          selected={topStreakDayTs !== null && selectedDayTs === topStreakDayTs}
        />
        <MetricCard
          label={t("overview.streakPlaytime.activeDays")}
          value={`${rangeSummary.activeDays}/${effectiveRangeDays}`}
        />
        <MetricCard
          label={t("overview.streakPlaytime.totalPlaytime")}
          value={formatDuration(rangeSummary.totalPlaytimeMs)}
        />
      </div>

      <div className="rounded-xl bg-surface-subtle p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-surface-muted-foreground">
            {t("overview.streakPlaytime.activity")}
          </p>
          <div className="flex items-center gap-1 text-[0.6875rem] text-surface-muted-foreground">
            <span>{t("overview.streakPlaytime.less")}</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className="h-2.5 w-2.5 rounded-[0.1875rem]"
                style={activityCellStyle(level as 0 | 1 | 2 | 3 | 4)}
              />
            ))}
            <span>{t("overview.streakPlaytime.more")}</span>
          </div>
        </div>

        <div className="min-w-0 overflow-x-auto pb-1">
          <div className="min-w-max">
            {visibleMonthMarkers.length > 0 && (
              <div className="mb-2 flex gap-2 text-[0.6875rem] font-medium text-surface-muted-foreground">
                <div className="w-5" aria-hidden="true" />
                <div
                  className="grid min-w-max"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(paddedHeatmapCells.length / 7))}, 0.875rem)`,
                    columnGap: "0.375rem",
                  }}
                >
                  {visibleMonthMarkers.map((marker) => (
                    <span
                      key={`${marker.label}-${marker.column}`}
                      className="whitespace-nowrap"
                      style={{ gridColumnStart: marker.column + 1 }}
                    >
                      {marker.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <div className="grid grid-rows-7 gap-1.5 pt-[0.125rem] text-[0.6875rem] text-surface-muted-foreground">
                {weekdayLabels.map((label, index) => (
                  <span key={`${label}-${index}`} className="h-4 leading-4">
                    {label}
                  </span>
                ))}
              </div>

              <div className="p-1">
                <TooltipProvider delayDuration={100}>
                  <div className="grid grid-flow-col auto-cols-[0.875rem] grid-rows-7 gap-1.5">
                    {paddedHeatmapCells.map((cell, index) => {
                      if (!cell) {
                        return (
                          <span
                            key={`blank-${index}`}
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        );
                      }

                      const selected = selectedDayTs === cell.dayTs;
                      const today = todayDayTs === cell.dayTs;
                      const streakLength =
                        streakLengthByDayTs.get(cell.dayTs) ?? 0;
                      const streakLabel =
                        streakLength > 0
                          ? t("overview.streakPlaytime.days", {
                              count: streakLength,
                            })
                          : t("overview.streakPlaytime.noStreak");

                      return (
                        <Tooltip key={cell.dayTs}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={`relative h-4 w-4 rounded-[0.1875rem] border border-border-subtle transition-[transform,box-shadow,border-color,background-color,opacity] duration-220 ease-emphasized will-change-transform active:scale-[0.96] hover:scale-110 hover:border-foreground/40 hover:shadow-sm focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${selected ? "scale-110 border-[color:var(--primary-border-strong)] ring-2 ring-[color:var(--primary-emphasis)] shadow-sm" : ""}`}
                              style={
                                selected
                                  ? selectedActivityCellStyle(cell.level)
                                  : activityCellStyle(cell.level)
                              }
                              aria-label={t(
                                "overview.streakPlaytime.dayAriaLabel",
                                {
                                  date: getDayFormatter().format(
                                    new Date(cell.dayTs),
                                  ),
                                  playtime: formatDuration(cell.playtimeMs),
                                  streak: streakLabel,
                                  today: today
                                    ? `, ${t("overview.status.today")}`
                                    : "",
                                },
                              )}
                              aria-pressed={selected}
                              onClick={() => {
                                selectActivityDay(cell.dayTs);
                              }}
                            >
                              {today && (
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute right-[-1px] top-[-1px] h-1.5 w-1.5 rounded-full bg-[color:var(--primary)] shadow-sm ring-1 ring-[color:var(--surface)]"
                                />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[14rem]">
                            <div className="space-y-1">
                              <div className="font-medium text-popover-foreground">
                                {getDayFormatter().format(new Date(cell.dayTs))}
                              </div>
                              <div className="text-popover-foreground/75">
                                {t("overview.streakPlaytime.playtimeLabel")}
                                <span className="font-medium text-popover-foreground">
                                  {formatDuration(cell.playtimeMs)}
                                </span>
                              </div>
                              <div className="text-popover-foreground/75">
                                {t("overview.streakPlaytime.streakLabel")}
                                <span className="font-medium text-popover-foreground">
                                  {streakLabel}
                                </span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border-subtle pt-4">
          <div
            className={`overflow-hidden transition-[max-height,opacity,transform] duration-220 ease-emphasized ${hasSelectedBreakdown ? "max-h-[22.5rem] translate-y-0 opacity-100" : "pointer-events-none max-h-0 -translate-y-1 opacity-0"}`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-surface-muted-foreground">
                {selectedBreakdownLabel}
              </p>
              <SegmentedControl
                value={breakdownMode}
                options={BREAKDOWN_MODES.map((mode) => ({
                  value: mode,
                  label:
                    mode === "day"
                      ? t("overview.streakPlaytime.byHour")
                      : mode === "week"
                        ? t("overview.streakPlaytime.byWeekday")
                        : t("overview.streakPlaytime.streakDays"),
                }))}
                onValueChange={setStoredBreakdownMode}
                size="sm"
              />
            </div>

            <ChartContainer
              config={drilldownConfig}
              className="aspect-auto h-[13.75rem] w-full"
            >
              <BarChart
                data={selectedBreakdown}
                margin={{ top: 6, right: 8, left: 2, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={
                    breakdownMode === "day"
                      ? 18
                      : breakdownMode === "week"
                        ? 8
                        : 16
                  }
                  interval={breakdownMode === "day" ? 2 : "preserveStartEnd"}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={48}
                  tickFormatter={formatMinutesAxisTick}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.fullLabel ?? null
                      }
                      formatter={(value) => [
                        `${formatDuration(Number(value) * 60000)}`,
                        t("overview.streakPlaytime.playtime"),
                      ]}
                    />
                  }
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="minutes"
                  fill="var(--color-minutes)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>

          <div
            className={`overflow-hidden transition-[max-height,opacity,transform] duration-220 ease-emphasized ${hasSelectedBreakdown ? "pointer-events-none max-h-0 -translate-y-1 opacity-0" : "max-h-[7.5rem] translate-y-0 opacity-100"}`}
          >
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("overview.streakPlaytime.clickDay")}
              </p>
              <p className="mt-1 text-xs text-surface-muted-foreground">
                {t("overview.streakPlaytime.switchViews")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Widget
      icon={Flame}
      iconClassName="text-[color:var(--streak)]"
      title={t("overview.streakPlaytime.title")}
      modalTitle={t("overview.streakPlaytime.breakdownTitle")}
      modalControls={modalControls}
      modalContent={modalContent}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-[color:var(--streak)]">
          {streakLabel}
        </span>
        <span className="text-xs text-surface-muted-foreground">
          {streakDetail}
        </span>
      </div>
      <ChartContainer
        config={playtimeConfig}
        className="mt-1 aspect-auto h-[1.25rem] w-full"
      >
        <AreaChart
          data={chartData}
          margin={{ top: 2, right: 2, left: 2, bottom: 0 }}
        >
          <defs>
            <linearGradient id="streakPlaytimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-minutes)"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="var(--color-minutes)"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="minutes"
            stroke="var(--color-minutes)"
            fill="url(#streakPlaytimeFill)"
            strokeWidth={CHART_STYLE.linePrimaryWidth}
          />
        </AreaChart>
      </ChartContainer>
    </Widget>
  );
}

function normalizeRangeDays(value: number): StreakRangeOption {
  return STREAK_RANGE_OPTIONS.includes(value as StreakRangeOption)
    ? (value as StreakRangeOption)
    : AUTO_RANGE_DAYS;
}

function normalizeBreakdownMode(value: BreakdownMode): BreakdownMode {
  return BREAKDOWN_MODES.includes(value) ? value : "day";
}

function normalizeSelectedDayTs(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function daysBetweenInclusive(fromTs: number, toTs: number): number {
  const start = normalizeSelectedDayTs(fromTs);
  const end = normalizeSelectedDayTs(toTs);
  if (start === null || end === null) return 1;
  const diff = Math.abs(end - start);
  return Math.floor(diff / 86400000) + 1;
}

function pickRangeDays(requiredDays: number): StreakRangeOption {
  const safeDays = Math.max(1, Math.floor(requiredDays));
  for (const candidate of STREAK_RANGE_OPTIONS) {
    if (candidate >= safeDays) return candidate;
  }
  return STREAK_RANGE_OPTIONS[STREAK_RANGE_OPTIONS.length - 1];
}

function quantile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const p = Math.min(1, Math.max(0, percentile));
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const ratio = index - lower;
  return (
    sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * ratio
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";

  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatMinutesAxisTick(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0m";
  if (value < 60) return `${Math.round(value)}m`;

  const hours = value / 60;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

function hourRangeLabel(hour: number): string {
  const startHour = hour % 24;
  const endHour = (hour + 1) % 24;
  return `${String(startHour).padStart(2, "0")}:00 - ${String(endHour).padStart(2, "0")}:00`;
}

function weekTickFormatter(date: Date): string {
  return getWeekdayFormatter().format(date);
}

function streakTickFormatter(date: Date): string {
  return getStreakDayFormatter().format(date);
}

function activityCellStyle(level: 0 | 1 | 2 | 3 | 4) {
  if (level === 0) {
    return { backgroundColor: "var(--surface-subtle)" };
  }

  return {
    backgroundColor: "var(--streak)",
    opacity: intensityOpacityByLevel[level],
    boxShadow:
      "inset 0 0 0 1px color-mix(in srgb, var(--streak) 40%, transparent)",
  };
}

function selectedActivityCellStyle(level: 0 | 1 | 2 | 3 | 4) {
  if (level === 0) {
    return {
      backgroundColor: "var(--primary-soft)",
      opacity: 1,
      boxShadow:
        "inset 0 0 0 1px var(--primary-border-strong), 0 0 0 1px var(--primary), 0 0 10px var(--primary-soft)",
    };
  }

  return {
    backgroundColor: "var(--primary)",
    opacity: Math.min(1, intensityOpacityByLevel[level] + 0.2),
    boxShadow:
      "inset 0 0 0 1px var(--primary-border-strong), 0 0 0 1px var(--primary), 0 0 10px var(--primary-soft)",
  };
}

function MetricCard({
  label,
  value,
  icon,
  onClick,
  selected = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  const className = `rounded-xl bg-surface-subtle px-3 py-2.5 text-left transition-[transform,color,opacity] duration-220 ease-emphasized will-change-transform ${onClick ? "active:scale-[0.985] hover:bg-surface-emphasis focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" : ""} ${selected ? "bg-surface-emphasis shadow-sm" : ""}`;

  const labelNode = icon ? (
    <div className="flex items-center gap-1 text-xs text-surface-muted-foreground">
      {icon}
      {label}
    </div>
  ) : (
    <p className="text-xs text-surface-muted-foreground">{label}</p>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {labelNode}
        <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      </button>
    );
  }

  return (
    <div className={className}>
      {labelNode}
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
