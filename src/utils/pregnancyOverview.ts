import type { BabyLogEntry, DiaryEntry } from "../types/babyLog";
import type { LogCategoryKey } from "../types/logCategory";

const PREGNANCY_CATEGORY_IDS = new Set([
  "pregMood",
  "pregSymptom",
  "pregWeight",
  "pregBp",
  "pregMed",
  "pregKick",
  "pregHospital",
  "contraction",
]);

function localDateKey(value = new Date()): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export type PregnancyUpcomingEvent = {
  id: string;
  dateKey: string;
  time: string;
  source: BabyLogEntry;
};

export type PregnancyDayItem =
  | { kind: "event"; id: string; dateKey: string; time: string; log: BabyLogEntry }
  | { kind: "log"; id: string; dateKey: string; time: string; log: BabyLogEntry }
  | { kind: "diary"; id: string; dateKey: string; time: string; diary: DiaryEntry };

export type PregnancyRecentItem = PregnancyDayItem;

export type PregnancyTodayStatus = {
  condition: BabyLogEntry | null;
  symptomCount: number;
  kickCount: number;
  memoCount: number;
};

const NEXT_AT = /^(\d{4}-\d{2}-\d{2})(?:[ T]+(\d{1,2}:\d{2}))?/;

export function parsePregnancyEventDate(nextAt?: string): { dateKey: string; time: string } | null {
  const match = nextAt?.trim().match(NEXT_AT);
  if (!match) return null;
  return { dateKey: match[1], time: match[2] ?? "" };
}

export function isPregnancyOverviewLog(
  entry: BabyLogEntry,
  pregnancyCustomCategories: ReadonlySet<LogCategoryKey>,
): boolean {
  return PREGNANCY_CATEGORY_IDS.has(entry.cat)
    || pregnancyCustomCategories.has(entry.cat);
}

export function buildPregnancyUpcomingEvents(
  logs: BabyLogEntry[],
  todayKey = localDateKey(),
  pregnancyCustomCategories: ReadonlySet<LogCategoryKey> = new Set(),
): PregnancyUpcomingEvent[] {
  return logs.flatMap((source) => {
    if (!isPregnancyOverviewLog(source, pregnancyCustomCategories)) return [];
    const parsed = parsePregnancyEventDate(source.nextAt);
    if (!parsed || parsed.dateKey < todayKey) return [];
    return [{ id: `event:${source.id}:${parsed.dateKey}`, ...parsed, source }];
  }).sort((a, b) => `${a.dateKey}T${a.time || "00:00"}`.localeCompare(`${b.dateKey}T${b.time || "00:00"}`));
}

export function buildPregnancyDayItems(input: {
  dateKey: string;
  logs: BabyLogEntry[];
  diaries: DiaryEntry[];
  events: PregnancyUpcomingEvent[];
  pregnancyCustomCategories: ReadonlySet<LogCategoryKey>;
}): PregnancyDayItem[] {
  const items: PregnancyDayItem[] = [];
  for (const event of input.events) {
    if (event.dateKey === input.dateKey) {
      items.push({ kind: "event", id: event.id, dateKey: event.dateKey, time: event.time, log: event.source });
    }
  }
  for (const log of input.logs) {
    if ((log.dateKey ?? localDateKey()) === input.dateKey
      && isPregnancyOverviewLog(log, input.pregnancyCustomCategories)) {
      items.push({ kind: "log", id: `log:${log.id}`, dateKey: input.dateKey, time: log.time, log });
    }
  }
  for (const diary of input.diaries) {
    if (diary.dateKey === input.dateKey) {
      const createdTime = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(diary.createdAt)?.[1] ?? "";
      items.push({ kind: "diary", id: `diary:${diary.id}`, dateKey: diary.dateKey, time: createdTime, diary });
    }
  }
  return items.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

export function buildPregnancyRecentItems(input: {
  logs: BabyLogEntry[];
  diaries: DiaryEntry[];
  pregnancyCustomCategories: ReadonlySet<LogCategoryKey>;
  limit?: number;
}): PregnancyRecentItem[] {
  const logs: PregnancyRecentItem[] = input.logs
    .filter((entry) => isPregnancyOverviewLog(entry, input.pregnancyCustomCategories))
    .map((log) => ({ kind: "log", id: `log:${log.id}`, dateKey: log.dateKey ?? localDateKey(), time: log.time, log }));
  const diaries: PregnancyRecentItem[] = input.diaries.map((diary) => ({
    kind: "diary", id: `diary:${diary.id}`, dateKey: diary.dateKey,
    time: /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(diary.createdAt)?.[1] ?? "", diary,
  }));
  return [...logs, ...diaries]
    .sort((a, b) => `${b.dateKey}T${b.time || "00:00"}`.localeCompare(`${a.dateKey}T${a.time || "00:00"}`))
    .slice(0, input.limit ?? 5);
}

export function buildPregnancyTodayStatus(
  logs: BabyLogEntry[],
  diaries: DiaryEntry[],
  todayKey = localDateKey(),
): PregnancyTodayStatus {
  const today = logs.filter((entry) => (entry.dateKey ?? todayKey) === todayKey);
  const condition = today.filter((entry) => entry.cat === "pregMood")
    .sort((a, b) => b.time.localeCompare(a.time))[0] ?? null;
  return {
    condition,
    symptomCount: today.filter((entry) => entry.cat === "pregSymptom").length,
    kickCount: today.filter((entry) => entry.cat === "pregKick").length,
    memoCount: today.filter((entry) => Boolean(entry.notes?.trim()) || entry.cat === "pregHospital").length
      + diaries.filter((entry) => entry.dateKey === todayKey).length,
  };
}

export function pregnancyCalendarMarkedDates(input: {
  logs: BabyLogEntry[];
  diaries: DiaryEntry[];
  events: PregnancyUpcomingEvent[];
  pregnancyCustomCategories: ReadonlySet<LogCategoryKey>;
}): Set<string> {
  const marked = new Set(input.events.map((event) => event.dateKey));
  for (const entry of input.logs) {
    if (isPregnancyOverviewLog(entry, input.pregnancyCustomCategories) && entry.dateKey) marked.add(entry.dateKey);
  }
  for (const diary of input.diaries) marked.add(diary.dateKey);
  return marked;
}

/** Content is intentionally empty until Darin has an approved, reviewed pregnancy source. */
export type PregnancyWeekContent = { week: number; title: string; body: string };
export const PREGNANCY_WEEK_CONTENT: readonly PregnancyWeekContent[] = [];
