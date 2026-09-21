import type { BabyLogEntry, DiaryEntry } from "../types/babyLog";
import { ageDaysBetween } from "./growthPercentile";
import { extractDailyFeatures, type DailyFeatures } from "./careInsights";
import { diaryHasMilestone, diaryMilestoneLabel } from "./diaryModel";
import { formatDateKey, offsetDateKey, parseDateKey } from "./dateKey";
import type { Translate } from "./recordDisplay";

const MIN_DAYS = 3;

export type PeriodWindow = {
  avg: number;
  days: number;
};

export type PeriodTrendPoint = {
  labelKey: "report.critical.200" | "report.critical.201" | "report.critical.202" | "report.critical.203" | "report.critical.204" | "report.critical.205";
  labelValue?: number;
  value: number | null;
};

export type PeriodTrend = {
  key: string;
  points: PeriodTrendPoint[];
};

export type PeriodCompareRow = {
  key: string;
  before: number;
  after: number;
  trend: "up" | "down" | "same";
};

export type PeriodMilestone = {
  dateKey: string;
  ageDays: number | null;
  label: string;
};

export type MonthReport = {
  monthLabel: string;
  dateKeys: string[];
  recordedDays: number;
  previousRecordedDays: number;
  headlineKey: "report.critical.208" | "report.critical.209" | "report.critical.210";
  bodyKey: "report.critical.261" | "report.critical.206";
  metrics: Array<{ key: string; value: number | null }>;
  weekTrends: PeriodTrend[];
  compares: PeriodCompareRow[];
};

export type AllReport = {
  logCount: number;
  recordedDays: number;
  firstDateKey?: string;
  ageDays: number | null;
  monthTrends: PeriodTrend[];
  milestones: PeriodMilestone[];
  recentVsEarlier: PeriodCompareRow[];
};

const WEEK_LABELS = [
  "report.critical.200",
  "report.critical.201",
  "report.critical.202",
  "report.critical.203",
] as const;

const KEY_METRICS = ["feedCount", "sleepMinutes", "diaperCount", "longestSleepMinutes", "tummyMinutes"] as const;
const TREND_METRICS = ["longestSleepMinutes", "feedCount", "tummyMinutes"] as const;
const ALL_TREND_METRICS = ["longestSleepMinutes", "feedCount"] as const;

function monthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function previousMonthStartKey(dateKey: string): string {
  const date = parseDateKey(monthStartKey(dateKey));
  date.setMonth(date.getMonth() - 1);
  return formatDateKey(date, "midnight");
}

function keysBetween(from: string, to: string): string[] {
  if (from > to) return [];
  const keys: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    keys.push(cursor);
    cursor = offsetDateKey(cursor, 1);
  }
  return keys;
}

function featureMap(logs: BabyLogEntry[], todayKey: string): Map<string, DailyFeatures> {
  return new Map(extractDailyFeatures(logs, todayKey).map((day) => [day.dateKey, day]));
}

function hasAny(day?: DailyFeatures): boolean {
  if (!day) return false;
  return day.feedCount !== null || day.sleepMinutes !== null || day.diaperCount !== null;
}

function average(
  byDate: Map<string, DailyFeatures>,
  keys: string[],
  metric: keyof Omit<DailyFeatures, "dateKey">,
): PeriodWindow | null {
  const values = keys
    .map((key) => byDate.get(key)?.[metric] ?? null)
    .filter((value): value is number => value !== null);
  if (values.length < MIN_DAYS) return null;
  return {
    avg: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
    days: values.length,
  };
}

function trendOf(before: number, after: number): "up" | "down" | "same" {
  const gap = Math.abs(after - before);
  const ratio = before === 0 ? (after === 0 ? 0 : 1) : gap / before;
  if (ratio < 0.08) return "same";
  return after > before ? "up" : "down";
}

export function buildMonthReport(logs: BabyLogEntry[], now = new Date()): MonthReport {
  const todayKey = formatDateKey(now);
  const endKey = offsetDateKey(todayKey, -1);
  const thisStart = monthStartKey(endKey);
  const prevStart = previousMonthStartKey(thisStart);
  const prevEnd = offsetDateKey(thisStart, -1);
  const thisKeys = keysBetween(thisStart, endKey);
  const prevKeys = keysBetween(prevStart, prevEnd);
  const byDate = featureMap(logs, todayKey);
  const weekEnd = endKey;
  const weekTrends = TREND_METRICS.map((key) => {
    const points = WEEK_LABELS.map((labelKey, index) => {
      const to = offsetDateKey(weekEnd, -7 * (3 - index));
      const from = offsetDateKey(to, -6);
      return { labelKey, value: average(byDate, keysBetween(from, to), key)?.avg ?? null };
    });
    return { key, points };
  });
  const compares = KEY_METRICS.flatMap((key) => {
    const current = average(byDate, thisKeys, key);
    const previous = average(byDate, prevKeys, key);
    if (!current || !previous) return [];
    return [{
      key,
      before: previous.avg,
      after: current.avg,
      trend: trendOf(previous.avg, current.avg),
    } satisfies PeriodCompareRow];
  });
  const night = compares.find((row) => row.key === "longestSleepMinutes");
  const feed = compares.find((row) => row.key === "feedCount");
  const headlineKey = night && night.trend === "up"
    ? "report.critical.208"
    : feed && feed.trend === "down"
      ? "report.critical.209"
      : "report.critical.210";
  return {
    monthLabel: `${Number(thisStart.slice(5, 7))}`,
    dateKeys: thisKeys,
    recordedDays: thisKeys.filter((key) => hasAny(byDate.get(key))).length,
    previousRecordedDays: prevKeys.filter((key) => hasAny(byDate.get(key))).length,
    headlineKey,
    bodyKey: headlineKey === "report.critical.210" ? "report.critical.206" : "report.critical.261",
    metrics: KEY_METRICS.map((key) => ({ key, value: average(byDate, thisKeys, key)?.avg ?? null })),
    weekTrends,
    compares,
  };
}

export function buildAllReport(
  logs: BabyLogEntry[],
  diaryEntries: DiaryEntry[],
  birthDate: string | undefined,
  t: Translate,
  now = new Date(),
): AllReport {
  const todayKey = formatDateKey(now);
  const byDate = featureMap(logs, todayKey);
  const recordedKeys = [...byDate.keys()].filter((key) => hasAny(byDate.get(key))).sort();
  const firstDateKey = recordedKeys[0];
  const lastDateKey = recordedKeys[recordedKeys.length - 1];
  const months: string[] = [];
  if (firstDateKey && lastDateKey) {
    let cursor = monthStartKey(firstDateKey);
    const lastMonth = monthStartKey(lastDateKey);
    while (cursor <= lastMonth) {
      months.push(cursor);
      const next = parseDateKey(cursor);
      next.setMonth(next.getMonth() + 1);
      cursor = formatDateKey(next, "midnight");
    }
  }
  const pickedMonths = months.length <= 3
    ? months
    : [months[0], months[Math.floor((months.length - 1) / 2)], months[months.length - 1]];
  const monthTrends = ALL_TREND_METRICS.map((key) => {
    const points: PeriodTrendPoint[] = pickedMonths.map((start, index) => {
      const next = months[months.indexOf(start) + 1];
      const end = next ? offsetDateKey(next, -1) : lastDateKey ?? start;
      const monthIndex = Math.max(1, months.indexOf(start) + 1);
      const isLast = index === pickedMonths.length - 1;
      return {
        labelKey: isLast ? "report.critical.204" : "report.critical.205",
        labelValue: isLast ? undefined : monthIndex,
        value: average(byDate, keysBetween(start, end), key)?.avg ?? null,
      };
    });
    return { key, points };
  });
  const recentKeys = keysBetween(offsetDateKey(todayKey, -28), offsetDateKey(todayKey, -1));
  const earlierKeys = keysBetween(offsetDateKey(todayKey, -56), offsetDateKey(todayKey, -29));
  const recentVsEarlier = ALL_TREND_METRICS.flatMap((key) => {
    const recent = average(byDate, recentKeys, key);
    const earlier = average(byDate, earlierKeys, key);
    if (!recent || !earlier) return [];
    return [{ key, before: earlier.avg, after: recent.avg, trend: trendOf(earlier.avg, recent.avg) }];
  });
  const milestones = diaryEntries
    .filter((entry) => diaryHasMilestone(entry))
    .slice()
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .map((entry) => ({
      dateKey: entry.dateKey,
      ageDays: birthDate ? ageDaysBetween(birthDate, `${entry.dateKey}T00:00:00`) : null,
      label: diaryMilestoneLabel(entry, t) ?? entry.customMilestoneTag ?? entry.milestoneTag ?? "",
    }))
    .filter((item) => item.label)
    .slice(-6);

  return {
    logCount: logs.length,
    recordedDays: recordedKeys.length,
    firstDateKey,
    ageDays: birthDate ? ageDaysBetween(birthDate, `${todayKey}T00:00:00`) : null,
    monthTrends,
    milestones,
    recentVsEarlier,
  };
}

export function reportHistoryFromKey(birthDate: string | undefined, todayKey: string): string {
  if (birthDate && birthDate <= todayKey) return birthDate;
  return offsetDateKey(todayKey, -180);
}
