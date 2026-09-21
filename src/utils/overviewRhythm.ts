import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { BabyLogEntry } from "../types/babyLog";
import type { GrowthRecord } from "../types/growthRecord";
import { FEEDING_CATS, formatSleepDuration, summarizeFeedingVolumes } from "./reportAggregates";
import { toMinutes } from "./formatLog";
import { isCustomCategoryKey } from "../types/logCategory";
import type { Translate } from "./recordDisplay";

export const OVERVIEW_RHYTHM_COLORS = {
  sleep: "#7c83fd",
  sleepFill: "#a8adf8",
  feed: "#E6A23A",
  diaper: "#3AA48D",
  activity: "#5b8dee",
  todayRail: "#F3F1F5",
  yesterdayRail: "#F6F5F3",
  mode: "#f4eee8",
  modeText: "#7a7168",
  statFeed: "#fff1ee",
  statSleep: "#eef0fe",
  statDiaper: "#fbf3e4",
  statActivity: "#e8f7f2",
} as const;

export type RhythmBlock = { start: number; duration: number };
export type RhythmTickKind = "feed" | "diaper" | "activity";
export type RhythmTick = { start: number; kind: RhythmTickKind; duration?: number };

export type DayRhythm = {
  sleep: RhythmBlock[];
  ticks: RhythmTick[];
};

export type CompareTone = "up" | "down" | "same";

export type OverviewCompareStat = {
  key: "feed" | "sleep" | "diaper" | "activity";
  numeric: number;
  delta: number;
  unit: "ml" | "min" | "count";
};

export type FeedAmount = { numeric: number; unit: "ml" | "count" };

const ACTIVITY_CATS: BabyLogCategoryId[] = ["tummy", "play"];

function isFeeding(cat: string): boolean {
  return !isCustomCategoryKey(cat) && FEEDING_CATS.includes(cat as BabyLogCategoryId);
}

function durationMinutes(entry: BabyLogEntry): number {
  return Number.parseInt(entry.duration ?? "0", 10) || 0;
}

function splitOvernight(start: number, duration: number): RhythmBlock[] {
  if (duration <= 0) return [];
  const end = start + duration;
  if (end <= 1440) return [{ start, duration }];
  return [
    { start, duration: 1440 - start },
    { start: 0, duration: end - 1440 },
  ];
}

function clipBlocks(blocks: RhythmBlock[], untilMinutes: number): RhythmBlock[] {
  return blocks
    .map((block) => {
      const from = Math.max(block.start, 0);
      const to = Math.min(block.start + block.duration, untilMinutes);
      return { start: from, duration: to - from };
    })
    .filter((block) => block.duration > 0);
}

export const RHYTHM_DAY_MINUTES = 1440;
export const RHYTHM_LAST_MINUTE = 1439;

export function minutesNow(now = new Date()): number {
  return Math.min(RHYTHM_LAST_MINUTE, now.getHours() * 60 + now.getMinutes());
}

export function localDateKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function clampRhythmMinutes(minutes: number, max = RHYTHM_LAST_MINUTE): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(max, Math.round(minutes)));
}

export function clockFromMinutes(minutes: number): string {
  const clamped = clampRhythmMinutes(minutes);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export function percentAt(minutes: number): number {
  return (Math.max(0, Math.min(1440, minutes)) / 1440) * 100;
}

export function sleepBlocksFor(logs: BabyLogEntry[], untilMinutes: number): RhythmBlock[] {
  const sleep: RhythmBlock[] = [];
  for (const entry of logs) {
    if (entry.cat !== "sleep") continue;
    const start = toMinutes(entry.time);
    if (!Number.isFinite(start) || start > untilMinutes) continue;
    sleep.push(...clipBlocks(splitOvernight(start, durationMinutes(entry) || 5), untilMinutes));
  }
  return sleep;
}

export function buildDayRhythm(logs: BabyLogEntry[], untilMinutes: number): DayRhythm {
  const sleep = sleepBlocksFor(logs, untilMinutes);
  const ticks: RhythmTick[] = [];
  for (const entry of logs) {
    const start = toMinutes(entry.time);
    if (!Number.isFinite(start) || start > untilMinutes) continue;
    if (entry.cat === "sleep") {
      continue;
    }
    if (isFeeding(entry.cat)) {
      ticks.push({ start, kind: "feed" });
      continue;
    }
    if (entry.cat === "diaper") {
      ticks.push({ start, kind: "diaper" });
      continue;
    }
    if (!isCustomCategoryKey(entry.cat) && ACTIVITY_CATS.includes(entry.cat as BabyLogCategoryId)) {
      ticks.push({ start, kind: "activity", duration: Math.max(3, durationMinutes(entry) || 8) });
    }
  }
  return { sleep, ticks };
}

export function sleepMinutesUntil(logs: BabyLogEntry[], minutes: number): number {
  const cutoff = Math.max(0, Math.min(1440, minutes));
  return logs.reduce((sum, entry) => {
    if (entry.cat !== "sleep") return sum;
    const start = toMinutes(entry.time);
    if (!Number.isFinite(start) || start > cutoff) return sum;
    const visibleEnd = Math.min(start + durationMinutes(entry), cutoff, 1440);
    return sum + Math.max(0, visibleEnd - start);
  }, 0);
}

function tummyMinutes(logs: BabyLogEntry[]): number {
  return logs
    .filter((entry) => entry.cat === "tummy")
    .reduce((sum, entry) => sum + durationMinutes(entry), 0);
}

export function compareTone(delta: number): CompareTone {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "same";
}

export function formatOverviewAmount(numeric: number, unit: "ml" | "min" | "count", t: Translate): string {
  const value = Math.round(numeric);
  if (unit === "ml") return t("insight.critical.147", { count: value });
  if (unit === "count") return t("report.critical.125", { count: value });
  return formatSleepDuration(value, t);
}

export function formatOverviewDelta(delta: number, unit: "ml" | "min" | "count", t: Translate) {
  const tone = compareTone(delta);
  if (tone === "same") {
    return { tone, signed: t("report.critical.167"), chip: `— ${t("report.critical.138")}` };
  }
  const signed = `${delta > 0 ? "+" : "-"}${formatOverviewAmount(Math.abs(delta), unit, t)}`;
  return { tone, signed, chip: `${delta > 0 ? "▲" : "▼"} ${signed}` };
}

export function compareHintKey(tone: CompareTone) {
  if (tone === "up") return "report.critical.135" as const;
  if (tone === "down") return "report.critical.136" as const;
  return "report.critical.137" as const;
}

function coversAt(entry: BabyLogEntry, minutes: number, fallback: number): boolean {
  const start = toMinutes(entry.time);
  if (!Number.isFinite(start)) return false;
  const duration = durationMinutes(entry) || fallback;
  const end = start + duration;
  if (end <= 1440) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end - 1440;
}

export function coveringKind(logs: BabyLogEntry[], minutes: number): "sleeping" | "feeding" | "diapered" | "resting" | "awake" {
  if (logs.some((entry) => entry.cat === "diaper" && coversAt(entry, minutes, 6))) return "diapered";
  if (logs.some((entry) => isFeeding(entry.cat) && coversAt(entry, minutes, 12))) return "feeding";
  if (logs.some((entry) => !isCustomCategoryKey(entry.cat) && ACTIVITY_CATS.includes(entry.cat as BabyLogCategoryId) && coversAt(entry, minutes, 8))) {
    return "resting";
  }
  if (logs.some((entry) => entry.cat === "sleep" && coversAt(entry, minutes, 5))) return "sleeping";
  return "awake";
}

export function lastFeedTime(logs: BabyLogEntry[]): string | undefined {
  const feeds = logs.filter((entry) => isFeeding(entry.cat));
  return feeds.at(-1)?.time;
}

export function sleepElapsedAt(logs: BabyLogEntry[], minutes: number): { start: string; elapsed: number } | null {
  const current = logs.find((entry) => entry.cat === "sleep" && coversAt(entry, minutes, 5));
  if (!current) return null;
  const start = toMinutes(current.time);
  const elapsed = minutes >= start ? minutes - start : 1440 - start + minutes;
  return { start: current.time, elapsed: Math.max(1, elapsed) };
}

function feedAmountUntil(logs: BabyLogEntry[], minutes: number): FeedAmount {
  const subset = logs.filter((entry) => isFeeding(entry.cat) && toMinutes(entry.time) <= minutes);
  const ml = summarizeFeedingVolumes(subset).ml;
  if (ml > 0) return { numeric: ml, unit: "ml" };
  return { numeric: subset.length, unit: "count" };
}

export function feedDisplay(logs: BabyLogEntry[]): FeedAmount {
  return feedAmountUntil(logs, 1440);
}

export function buildOverviewCompareStats(todayLogs: BabyLogEntry[], yesterdayLogs: BabyLogEntry[]): OverviewCompareStat[] {
  const todayFeed = feedDisplay(todayLogs);
  const yesterdayFeed = feedDisplay(yesterdayLogs);
  const useMl = todayFeed.unit === "ml" && yesterdayFeed.unit === "ml";
  const feedDelta = useMl
    ? todayFeed.numeric - yesterdayFeed.numeric
    : todayLogs.filter((entry) => isFeeding(entry.cat)).length - yesterdayLogs.filter((entry) => isFeeding(entry.cat)).length;
  return [
    { key: "feed", numeric: useMl ? todayFeed.numeric : todayLogs.filter((entry) => isFeeding(entry.cat)).length, delta: feedDelta, unit: useMl ? "ml" : "count" },
    { key: "sleep", numeric: sleepMinutesUntil(todayLogs, 1440), delta: sleepMinutesUntil(todayLogs, 1440) - sleepMinutesUntil(yesterdayLogs, 1440), unit: "min" },
    { key: "diaper", numeric: todayLogs.filter((entry) => entry.cat === "diaper").length, delta: todayLogs.filter((entry) => entry.cat === "diaper").length - yesterdayLogs.filter((entry) => entry.cat === "diaper").length, unit: "count" },
    { key: "activity", numeric: tummyMinutes(todayLogs), delta: tummyMinutes(todayLogs) - tummyMinutes(yesterdayLogs), unit: "min" },
  ];
}

export function overviewStatPills(todayLogs: BabyLogEntry[]) {
  const feed = feedDisplay(todayLogs);
  return {
    sleepMin: sleepMinutesUntil(todayLogs, 1440),
    feed: feed,
    diaperCount: todayLogs.filter((entry) => entry.cat === "diaper").length,
    tummyMin: tummyMinutes(todayLogs),
  };
}

export function buildOverviewHeadlineKind(todayLogs: BabyLogEntry[], yesterdayLogs: BabyLogEntry[]): "feedUpSleepDown" | "generic" | "empty" {
  if (!todayLogs.length) return "empty";
  const todayFeed = feedDisplay(todayLogs);
  const yesterdayFeed = feedDisplay(yesterdayLogs);
  const feedGap = todayFeed.unit === yesterdayFeed.unit ? todayFeed.numeric - yesterdayFeed.numeric : 0;
  const sleepGap = sleepMinutesUntil(todayLogs, 1440) - sleepMinutesUntil(yesterdayLogs, 1440);
  if (feedGap > 0 && sleepGap < 0) return "feedUpSleepDown";
  return "generic";
}

export function sleepMinutesFor(logs: BabyLogEntry[]): number {
  return sleepMinutesUntil(logs, 1440);
}

export function latestPair(records: GrowthRecord[], pick: (record: GrowthRecord) => number | undefined) {
  const ranked = records
    .map((record) => ({ record, value: pick(record) }))
    .filter((item): item is { record: GrowthRecord; value: number } => item.value != null);
  const current = ranked[ranked.length - 1];
  const previous = ranked[ranked.length - 2];
  return { current, previous, recent: ranked.slice(-3) };
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function previousMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthSpan(
  records: GrowthRecord[],
  month: string,
  pick: (record: GrowthRecord) => number | undefined,
) {
  const ranked = records
    .filter((record) => monthKey(record.measuredAt) === month)
    .map((record) => ({ record, value: pick(record) }))
    .filter((item): item is { record: GrowthRecord; value: number } => item.value != null);
  // A single measurement is a point-in-time value, not evidence of a trend.
  // Keep the overview's monthly comparison neutral until two values exist.
  if (ranked.length < 2) return null;
  const first = ranked[0];
  const last = ranked[ranked.length - 1];
  return { first, last, delta: last.value - first.value };
}
