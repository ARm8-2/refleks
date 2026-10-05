import { describe, expect, it } from "vitest";
import type { RunRecord, Session } from "@/shared/types";
import {
  buildActivityRange,
  buildDailyActivityForSelectedStreak,
  buildDailyActivityForWeek,
  buildHourlyActivityForDay,
  buildStreakActivity,
} from "./streakActivity";

function localDay(day: number, hour = 12): Date {
  return new Date(2025, 0, day, hour);
}

function dayTimestamp(day: number): number {
  const date = localDay(day);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function makeRun(day: number, duration: number, hour = 12): RunRecord {
  return {
    stats: {
      summary: {
        datePlayed: localDay(day, hour).toISOString(),
        duration,
      },
    },
  } as unknown as RunRecord;
}

function makeSession(...items: RunRecord[]): Session {
  return {
    id: "session",
    start: "2025-01-01T00:00:00.000Z",
    end: "2025-01-10T00:00:00.000Z",
    items,
  };
}

describe("buildStreakActivity", () => {
  it("aggregates run time per day and identifies current and longest streaks", () => {
    const activity = buildStreakActivity(
      [
        makeSession(
          makeRun(1, 10),
          makeRun(2, 20),
          makeRun(4, 30),
          makeRun(6, 40),
          makeRun(7, 50),
          makeRun(8, 60),
          makeRun(8, 15, 18),
        ),
      ],
      localDay(8),
    );

    expect(activity).toMatchObject({
      currentStreak: 3,
      topStreak: 3,
      todayPlaytimeMs: 75_000,
      totalPlaytimeMs: 225_000,
      activeDays: 6,
      lastActiveDayTs: dayTimestamp(8),
    });
    expect(activity.dailyPlaytime).toEqual([
      { dayTs: dayTimestamp(1), playtimeMs: 10_000 },
      { dayTs: dayTimestamp(2), playtimeMs: 20_000 },
      { dayTs: dayTimestamp(4), playtimeMs: 30_000 },
      { dayTs: dayTimestamp(6), playtimeMs: 40_000 },
      { dayTs: dayTimestamp(7), playtimeMs: 50_000 },
      { dayTs: dayTimestamp(8), playtimeMs: 75_000 },
    ]);
    expect(activity.streakSpans).toEqual([
      { startTs: dayTimestamp(1), endTs: dayTimestamp(2), days: 2 },
      { startTs: dayTimestamp(4), endTs: dayTimestamp(4), days: 1 },
      { startTs: dayTimestamp(6), endTs: dayTimestamp(8), days: 3 },
    ]);
  });

  it("does not count a streak through a day with no valid playtime", () => {
    const activity = buildStreakActivity(
      [
        makeSession(
          makeRun(6, 20),
          makeRun(7, 30),
          makeRun(8, 0),
          makeRun(8, -5),
          makeRun(9, 60),
          {
            stats: { summary: { datePlayed: "not a date", duration: 100 } },
          } as unknown as RunRecord,
        ),
      ],
      localDay(8),
    );

    expect(activity.currentStreak).toBe(0);
    expect(activity.topStreak).toBe(2);
    expect(activity.totalPlaytimeMs).toBe(110_000);
    expect(activity.activeDays).toBe(3);
    expect(activity.lastActiveDayTs).toBe(dayTimestamp(9));
  });

  it("returns an empty summary when there are no usable runs", () => {
    const activity = buildStreakActivity([], localDay(8));

    expect(activity).toEqual({
      currentStreak: 0,
      topStreak: 0,
      todayPlaytimeMs: 0,
      totalPlaytimeMs: 0,
      activeDays: 0,
      lastActiveDayTs: null,
      dailyPlaytime: [],
      streakSpans: [],
    });
  });
});

describe("buildActivityRange", () => {
  it("fills inactive days and calculates totals and longest in-range streak", () => {
    const activity = buildStreakActivity(
      [makeSession(makeRun(5, 10), makeRun(6, 20), makeRun(8, 40))],
      localDay(8),
    );

    const range = buildActivityRange(activity, 4, localDay(8));

    expect(range.cells).toEqual([
      { dayTs: dayTimestamp(5), playtimeMs: 10_000 },
      { dayTs: dayTimestamp(6), playtimeMs: 20_000 },
      { dayTs: dayTimestamp(7), playtimeMs: 0 },
      { dayTs: dayTimestamp(8), playtimeMs: 40_000 },
    ]);
    expect(range).toMatchObject({
      totalPlaytimeMs: 70_000,
      activeDays: 3,
      longestStreak: 2,
    });
  });

  it("uses at least one day when the requested range is zero or negative", () => {
    const activity = buildStreakActivity(
      [makeSession(makeRun(8, 10))],
      localDay(8),
    );

    expect(buildActivityRange(activity, 0, localDay(8)).cells).toHaveLength(1);
    expect(buildActivityRange(activity, -3, localDay(8)).cells).toHaveLength(1);
  });
});

describe("buildHourlyActivityForDay", () => {
  it("sums runs by local hour and ignores other days and invalid durations", () => {
    const sessions = [
      makeSession(
        makeRun(8, 10, 9),
        makeRun(8, 15, 9),
        makeRun(8, 5, 17),
        makeRun(9, 100, 9),
        makeRun(8, 0, 11),
      ),
    ];

    const hourly = buildHourlyActivityForDay(sessions, localDay(8).getTime());

    expect(hourly).toHaveLength(24);
    expect(hourly[9]).toEqual({ hour: 9, playtimeMs: 25_000 });
    expect(hourly[17]).toEqual({ hour: 17, playtimeMs: 5_000 });
    expect(hourly[10]?.playtimeMs).toBe(0);
  });
});

describe("daily activity selectors", () => {
  it("returns a Sunday-to-Saturday week with empty days filled in", () => {
    const activity = buildStreakActivity(
      [makeSession(makeRun(6, 10), makeRun(8, 30))],
      localDay(8),
    );

    expect(buildDailyActivityForWeek(activity, localDay(8).getTime())).toEqual([
      { dayTs: dayTimestamp(5), playtimeMs: 0 },
      { dayTs: dayTimestamp(6), playtimeMs: 10_000 },
      { dayTs: dayTimestamp(7), playtimeMs: 0 },
      { dayTs: dayTimestamp(8), playtimeMs: 30_000 },
      { dayTs: dayTimestamp(9), playtimeMs: 0 },
      { dayTs: dayTimestamp(10), playtimeMs: 0 },
      { dayTs: dayTimestamp(11), playtimeMs: 0 },
    ]);
  });

  it("returns the selected streak's days, or no days for an inactive date", () => {
    const activity = buildStreakActivity(
      [makeSession(makeRun(6, 10), makeRun(7, 20), makeRun(8, 30))],
      localDay(8),
    );

    expect(
      buildDailyActivityForSelectedStreak(activity, localDay(7, 16).getTime()),
    ).toEqual([
      { dayTs: dayTimestamp(6), playtimeMs: 10_000 },
      { dayTs: dayTimestamp(7), playtimeMs: 20_000 },
      { dayTs: dayTimestamp(8), playtimeMs: 30_000 },
    ]);
    expect(
      buildDailyActivityForSelectedStreak(activity, localDay(9).getTime()),
    ).toEqual([]);
  });
});
