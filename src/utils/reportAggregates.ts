import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { BabyLogEntry } from "../types/babyLog";
import { isCustomCategoryKey } from "../types/logCategory";
import {
  formatDateKey,
  lastNDateKeys,
  shortDateLabel,
  weekdayLabelKo,
  yesterdayDateKey,
} from "./dateKey";
import { toMinutes } from "./formatLog";

export const FEEDING_CATS: BabyLogCategoryId[] = ["breast", "formula", "food", "snack", "pump"];

export type DayAggregate = {
  dateKey: string;
  label: string;
  shortLabel: string;
  feedingCount: number;
  sleepMinutes: number;
  sleepCount: number;
  diaperCount: number;
  totalCount: number;
  byCategory: Partial<Record<string, number>>;
};

export type TodaySummaryFlag =
  | "no_logs_today"
  | "sleep_less_than_yesterday"
  | "sleep_more_than_yesterday"
  | "feeding_normal"
  | "feeding_up"
  | "feeding_down"
  | "diaper_normal"
  | "diaper_up"
  | "diaper_down"
  | "sparse_week";

export type TodaySummary = {
  dateKey: string;
  feedCount: number;
  sleepCount: number;
  totalSleepMinutes: number;
  diaperCount: number;
  totalCount: number;
  lastFeedAt?: string;
  lastSleepAt?: string;
  lastDiaperAt?: string;
  yesterdayFeedCount: number;
  yesterdaySleepMinutes: number;
  yesterdayDiaperCount: number;
  avgFeed7: number;
  avgSleepMinutes7: number;
  avgDiaper7: number;
  flags: TodaySummaryFlag[];
};

/** Resolve calendar day for a log. Missing dateKey = today (legacy / same-day entries). */
export function entryDateKey(entry: BabyLogEntry, todayKey = formatDateKey()): string {
  return entry.dateKey ?? todayKey;
}

export function getLogsByDateRange(
  logs: BabyLogEntry[],
  dateKeys: string[],
  todayKey = formatDateKey(),
): BabyLogEntry[] {
  const set = new Set(dateKeys);
  return logs.filter((l) => set.has(entryDateKey(l, todayKey)));
}

export function getLogsForDay(
  logs: BabyLogEntry[],
  dateKey: string,
  todayKey = formatDateKey(),
): BabyLogEntry[] {
  return logs
    .filter((l) => entryDateKey(l, todayKey) === dateKey)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

function isFeeding(cat: string): boolean {
  return !isCustomCategoryKey(cat) && FEEDING_CATS.includes(cat as BabyLogCategoryId);
}

function emptyDay(dateKey: string, todayKey: string): DayAggregate {
  return {
    dateKey,
    label: weekdayLabelKo(dateKey, todayKey),
    shortLabel: shortDateLabel(dateKey),
    feedingCount: 0,
    sleepMinutes: 0,
    sleepCount: 0,
    diaperCount: 0,
    totalCount: 0,
    byCategory: {},
  };
}

export function aggregateDay(
  logs: BabyLogEntry[],
  dateKey: string,
  todayKey = formatDateKey(),
): DayAggregate {
  const dayLogs = getLogsForDay(logs, dateKey, todayKey);
  const agg = emptyDay(dateKey, todayKey);
  for (const l of dayLogs) {
    agg.totalCount += 1;
    const cat = l.cat;
    agg.byCategory[cat] = (agg.byCategory[cat] ?? 0) + 1;
    if (isFeeding(cat)) agg.feedingCount += 1;
    if (cat === "diaper") agg.diaperCount += 1;
    if (cat === "sleep") {
      agg.sleepCount += 1;
      agg.sleepMinutes += parseInt(l.duration ?? "0", 10) || 0;
    }
  }
  return agg;
}

export function aggregateLogsByDate(
  logs: BabyLogEntry[],
  dateKeys: string[],
  todayKey = formatDateKey(),
): DayAggregate[] {
  return dateKeys.map((k) => aggregateDay(logs, k, todayKey));
}

export function weeklyTrend(logs: BabyLogEntry[], now = new Date()): DayAggregate[] {
  const todayKey = formatDateKey(now);
  return aggregateLogsByDate(logs, lastNDateKeys(7, now), todayKey);
}

export function categoryCountsLast7(
  logs: BabyLogEntry[],
  catId: string,
  now = new Date(),
): { dateKey: string; label: string; count: number; sleepMinutes?: number }[] {
  const todayKey = formatDateKey(now);
  return lastNDateKeys(7, now).map((dateKey) => {
    const dayLogs = getLogsForDay(logs, dateKey, todayKey).filter((l) => l.cat === catId);
    return {
      dateKey,
      label: weekdayLabelKo(dateKey, todayKey),
      count: dayLogs.length,
      sleepMinutes:
        catId === "sleep"
          ? dayLogs.reduce((s, l) => s + (parseInt(l.duration ?? "0", 10) || 0), 0)
          : undefined,
    };
  });
}

function lastOf(logs: BabyLogEntry[], pred: (l: BabyLogEntry) => boolean): string | undefined {
  const hits = logs.filter(pred);
  return hits.length ? hits[hits.length - 1].time : undefined;
}

export function buildTodaySummary(logs: BabyLogEntry[], now = new Date()): TodaySummary {
  const todayKey = formatDateKey(now);
  const yKey = yesterdayDateKey(now);
  const today = aggregateDay(logs, todayKey, todayKey);
  const yesterday = aggregateDay(logs, yKey, todayKey);
  const week = weeklyTrend(logs, now);
  const past6 = week.slice(0, 6);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);

  const avgFeed7 = avg(past6.map((d) => d.feedingCount));
  const avgSleepMinutes7 = avg(past6.map((d) => d.sleepMinutes));
  const avgDiaper7 = avg(past6.map((d) => d.diaperCount));

  const todayLogs = getLogsForDay(logs, todayKey, todayKey);
  const flags: TodaySummaryFlag[] = [];

  if (today.totalCount === 0) flags.push("no_logs_today");

  if (yesterday.sleepMinutes > 0 || today.sleepMinutes > 0) {
    if (today.sleepMinutes + 30 < yesterday.sleepMinutes) flags.push("sleep_less_than_yesterday");
    else if (today.sleepMinutes > yesterday.sleepMinutes + 30) flags.push("sleep_more_than_yesterday");
  }

  if (avgFeed7 > 0) {
    if (Math.abs(today.feedingCount - avgFeed7) < Math.max(1, avgFeed7 * 0.35)) flags.push("feeding_normal");
    else if (today.feedingCount > avgFeed7) flags.push("feeding_up");
    else flags.push("feeding_down");
  }

  if (avgDiaper7 > 0) {
    if (Math.abs(today.diaperCount - avgDiaper7) < Math.max(1, avgDiaper7 * 0.4)) flags.push("diaper_normal");
    else if (today.diaperCount > avgDiaper7) flags.push("diaper_up");
    else flags.push("diaper_down");
  }

  const weekTotal = week.reduce((s, d) => s + d.totalCount, 0);
  if (weekTotal < 5) flags.push("sparse_week");

  return {
    dateKey: todayKey,
    feedCount: today.feedingCount,
    sleepCount: today.sleepCount,
    totalSleepMinutes: today.sleepMinutes,
    diaperCount: today.diaperCount,
    totalCount: today.totalCount,
    lastFeedAt: lastOf(todayLogs, (l) => isFeeding(l.cat)),
    lastSleepAt: lastOf(todayLogs, (l) => l.cat === "sleep"),
    lastDiaperAt: lastOf(todayLogs, (l) => l.cat === "diaper"),
    yesterdayFeedCount: yesterday.feedingCount,
    yesterdaySleepMinutes: yesterday.sleepMinutes,
    yesterdayDiaperCount: yesterday.diaperCount,
    avgFeed7,
    avgSleepMinutes7,
    avgDiaper7,
    flags,
  };
}

export function formatSleepDuration(mins: number): string {
  if (mins <= 0) return "0분";
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

export type SummaryCards = {
  overview: string;
  changes: string;
  checklist: string;
};

export function buildSummaryCards(summary: TodaySummary, babyName: string): SummaryCards {
  if (summary.flags.includes("no_logs_today")) {
    return {
      overview: `오늘 ${babyName}의 돌봄 기록이 아직 없어요. 수유·수면·배변을 남기면 여기에 요약이 채워져요.`,
      changes: "어제·최근 7일과 비교하려면 오늘 기록이 필요해요.",
      checklist: "짧게라도 수유나 기저귀부터 남겨 보세요.",
    };
  }

  const overview = `오늘 ${babyName}는 수유 ${summary.feedCount}회, 수면 ${summary.sleepCount}회(${formatSleepDuration(summary.totalSleepMinutes)}), 배변 ${summary.diaperCount}회를 기록했어요.`;

  const changeBits: string[] = [];
  const sleepDiff = summary.totalSleepMinutes - summary.yesterdaySleepMinutes;
  if (summary.yesterdaySleepMinutes > 0 && Math.abs(sleepDiff) >= 20) {
    changeBits.push(
      sleepDiff < 0
        ? `어제보다 수면이 ${formatSleepDuration(Math.abs(sleepDiff))} 줄었어요`
        : `어제보다 수면이 ${formatSleepDuration(sleepDiff)} 늘었어요`,
    );
  }
  if (summary.flags.includes("diaper_normal")) changeBits.push("배변 횟수는 최근 평균 범위예요");
  else if (summary.flags.includes("diaper_up")) changeBits.push("배변이 최근 평균보다 잦아요");
  else if (summary.flags.includes("diaper_down")) changeBits.push("배변이 최근 평균보다 적어요");
  if (summary.flags.includes("feeding_up")) changeBits.push("수유가 평소보다 많아요");
  else if (summary.flags.includes("feeding_down")) changeBits.push("수유가 평소보다 적어요");
  else if (summary.flags.includes("feeding_normal")) changeBits.push("수유 횟수는 평소 수준이에요");

  const changes =
    changeBits.length > 0
      ? changeBits.join(". ") + "."
      : "어제·최근 7일과 큰 차이는 아직 드러나지 않아요.";

  const checks: string[] = [];
  if (summary.flags.includes("sleep_less_than_yesterday")) {
    checks.push("낮잠·저녁 취침이 부족한지 한 번 더 확인해 보세요");
  }
  if (summary.feedCount === 0) checks.push("수유/식사 기록이 없어요 — 놓친 기록이 있는지 확인해 보세요");
  if (summary.diaperCount === 0) checks.push("배변 기록이 없어요 — 다음 기저귀 교체를 남겨 보세요");
  if (summary.flags.includes("sparse_week")) checks.push("최근 7일 기록이 적어요 — 추세 파악을 위해 꾸준히 남겨 주세요");
  if (!checks.length) checks.push("특별한 이상 신호는 없어요. 평소처럼 리듬을 지켜보면 좋아요");

  return { overview, changes, checklist: checks.join(". ") + "." };
}

export function toBarPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(6, Math.min(100, Math.round((value / max) * 100)));
}
