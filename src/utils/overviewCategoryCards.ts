import { BABY_LOG_CATEGORIES, PREGNANCY_LOG_CATEGORIES } from "../constants/babyLogCategories";
import type { DefaultFeedingMethod } from "../types/careSetup";
import type { BabyLogEntry } from "../types/babyLog";
import type { CustomCategory, LogCategoryKey } from "../types/logCategory";
import { isCustomCategoryKey } from "../types/logCategory";
import {
  collectOverviewExtraCategoryIds,
  isOverviewFixedLogCat,
  OVERVIEW_FIXED_CATEGORY_IDS,
  OVERVIEW_OPTIONAL_CATEGORY_ORDER,
  overviewCompareOrderIndex,
  overviewOptionalOrderIndex,
  stampOfLog,
  type OverviewFixedCategoryId,
} from "./overviewCategoryOrder";
import {
  OVERVIEW_RHYTHM_COLORS,
  compareTone,
  feedDisplay,
  sleepBlocksFor,
  sleepMinutesUntil,
  sleepMinutesFor,
  type CompareTone,
} from "./overviewRhythm";
import { toMinutes } from "./formatLog";
import { diaperTypeLabel } from "./diaperLog";
import { resolveLogCategory } from "./resolveLogCategory";

export {
  OVERVIEW_FIXED_CATEGORY_IDS,
  OVERVIEW_OPTIONAL_CATEGORY_ORDER,
  type OverviewFixedCategoryId,
};

const DURATION_CATS = new Set<string>(
  [...BABY_LOG_CATEGORIES, ...PREGNANCY_LOG_CATEGORIES]
    .filter((category) => category.duration)
    .map((category) => category.id),
);
const ML_CATS = new Set<string>(["pump", "water"]);

export type OverviewCategoryCardId = OverviewFixedCategoryId | LogCategoryKey;

export type OverviewCategoryHint = "empty" | "insufficient" | "up" | "down" | "same";

export type OverviewCategoryCard = {
  id: OverviewCategoryCardId;
  fixed: boolean;
  recordCategory: LogCategoryKey;
  numeric: number;
  delta: number;
  unit: "ml" | "min" | "count";
  hasToday: boolean;
  hasYesterday: boolean;
  lastStamp: string;
  tone: CompareTone;
};

export type OverviewCategoryCompareRow = {
  id: OverviewCategoryCardId;
  recordCategory: LogCategoryKey;
  delta: number | null;
  unit: "ml" | "min" | "count";
};

export type OverviewInspectionRow = {
  id: OverviewCategoryCardId;
  recordCategory: LogCategoryKey;
  eventValue: number | null;
  eventLabel: string | null;
  cumulative: number;
  unit: "ml" | "min" | "count";
};

export type OverviewCompareUnit = "ml" | "min" | "count" | "temp";

export type OverviewIndependentCompareRow = {
  id: OverviewCategoryCardId;
  recordCategory: LogCategoryKey;
  unit: OverviewCompareUnit;
  todayEventValue: number | null;
  todayEventLabel: string | null;
  todayCumulative: number | null;
  yesterdayEventValue: number | null;
  yesterdayEventLabel: string | null;
  yesterdayCumulative: number | null;
  delta: number | null;
  hasToday: boolean;
  hasYesterday: boolean;
  semanticDelta: boolean;
};

function durationMinutes(entry: BabyLogEntry): number {
  return Number.parseInt(entry.duration ?? "0", 10) || 0;
}

function amountSum(entries: BabyLogEntry[]): number {
  return entries.reduce((sum, entry) => {
    const fromValue = typeof entry.amountValue === "number"
      ? entry.amountValue
      : Number.parseFloat(String(entry.amountValue ?? ""));
    if (Number.isFinite(fromValue) && fromValue > 0) return sum + fromValue;
    const fromText = Number.parseFloat(entry.amount ?? "");
    return Number.isFinite(fromText) && fromText > 0 ? sum + fromText : sum;
  }, 0);
}

function latestStamp(entries: BabyLogEntry[]): string {
  return entries.reduce((latest, entry) => {
    const stamp = stampOfLog(entry);
    return stamp > latest ? stamp : latest;
  }, "");
}

function isFeedingCat(cat: string): boolean {
  return isOverviewFixedLogCat(cat) && cat !== "sleep" && cat !== "diaper";
}

export function feedRecordCategory(
  todayLogs: BabyLogEntry[],
  yesterdayLogs: BabyLogEntry[],
  method?: DefaultFeedingMethod,
): LogCategoryKey {
  const latest = [...todayLogs, ...yesterdayLogs]
    .filter((entry) => isFeedingCat(entry.cat))
    .sort((a, b) => stampOfLog(a).localeCompare(stampOfLog(b)))
    .at(-1);
  if (latest) return latest.cat;
  if (method === "breastfeeding") return "breast";
  if (method === "pumped_milk") return "storedMilk";
  return "formula";
}

function matchesCard(entry: BabyLogEntry, id: OverviewCategoryCardId): boolean {
  if (id === "feed") return isFeedingCat(entry.cat);
  if (id === "sleep") return entry.cat === "sleep";
  if (id === "diaper") return entry.cat === "diaper";
  return entry.cat === id;
}

const COMPARE_COUNT_IDS = new Set<string>([
  "diaper", "bath", "med", "food", "snack", "doctor", "vaccination", "memo", "other",
  "pregMood", "pregSymptom", "pregMed", "pregKick", "pregHospital",
]);
const COMPARE_LATEST_IDS = new Set<string>(["temp"]);

function recordsThrough(logs: BabyLogEntry[], id: OverviewCategoryCardId, minutes: number): BabyLogEntry[] {
  const cutoff = Math.max(0, Math.min(1440, minutes));
  return logs.filter((entry) => {
    if (!matchesCard(entry, id)) return false;
    const start = toMinutes(entry.time);
    return Number.isFinite(start) && start <= cutoff;
  });
}

function latestNumeric(entries: BabyLogEntry[]): number | null {
  const last = [...entries].sort((a, b) => stampOfLog(a).localeCompare(stampOfLog(b))).at(-1);
  if (!last) return null;
  const fromValue = typeof last.amountValue === "number"
    ? last.amountValue
    : Number.parseFloat(String(last.amountValue ?? last.amount ?? ""));
  return Number.isFinite(fromValue) ? fromValue : null;
}

/** Cursor-scoped summary for one day. Missing records stay missing — never a fake 0. */
export function compareMetricFor(
  id: OverviewCategoryCardId,
  logs: BabyLogEntry[],
  minutes: number,
  customCategories: CustomCategory[],
): { has: boolean; numeric: number | null; unit: OverviewCompareUnit } {
  const entries = recordsThrough(logs, id, minutes);
  if (id === "sleep") {
    const minutesUntil = sleepMinutesUntil(logs, minutes);
    return { has: entries.length > 0, numeric: entries.length ? minutesUntil : null, unit: "min" };
  }
  if (id === "feed") {
    if (!entries.length) return { has: false, numeric: null, unit: "ml" };
    const feed = feedDisplay(entries);
    return { has: true, numeric: feed.numeric, unit: feed.unit };
  }
  if (!entries.length) {
    if (COMPARE_LATEST_IDS.has(String(id))) return { has: false, numeric: null, unit: "temp" };
    if (typeof id === "string" && ML_CATS.has(id)) return { has: false, numeric: null, unit: "ml" };
    if (typeof id === "string" && DURATION_CATS.has(id) && !COMPARE_COUNT_IDS.has(id) && id !== "pump") {
      return { has: false, numeric: null, unit: "min" };
    }
    return { has: false, numeric: null, unit: "count" };
  }
  if (COMPARE_LATEST_IDS.has(String(id))) {
    return { has: true, numeric: latestNumeric(entries), unit: "temp" };
  }
  if (COMPARE_COUNT_IDS.has(String(id))) {
    return { has: true, numeric: entries.length, unit: "count" };
  }
  const metric = metricFor(id, entries, customCategories);
  return { has: true, numeric: metric.numeric, unit: metric.unit };
}

function metricFor(
  id: OverviewCategoryCardId,
  logs: BabyLogEntry[],
  customCategories: CustomCategory[],
): { numeric: number; unit: "ml" | "min" | "count" } {
  if (id === "feed") {
    const feed = feedDisplay(logs);
    return { numeric: feed.numeric, unit: feed.unit };
  }
  if (id === "sleep") return { numeric: sleepMinutesFor(logs), unit: "min" };
  const entries = logs.filter((entry) => matchesCard(entry, id));
  if (id === "diaper") return { numeric: entries.length, unit: "count" };
  if (typeof id === "string" && DURATION_CATS.has(id) && id !== "pump") {
    return { numeric: entries.reduce((sum, entry) => sum + durationMinutes(entry), 0), unit: "min" };
  }
  if (typeof id === "string" && ML_CATS.has(id)) {
    const ml = amountSum(entries);
    if (ml > 0) return { numeric: ml, unit: "ml" };
    return { numeric: entries.length, unit: "count" };
  }
  if (isCustomCategoryKey(String(id))) {
    const resolved = resolveLogCategory(id as LogCategoryKey, customCategories);
    if (resolved.duration) {
      return { numeric: entries.reduce((sum, entry) => sum + durationMinutes(entry), 0), unit: "min" };
    }
    return { numeric: entries.length, unit: "count" };
  }
  return { numeric: entries.length, unit: "count" };
}

function buildCard(
  id: OverviewCategoryCardId,
  todayLogs: BabyLogEntry[],
  yesterdayLogs: BabyLogEntry[],
  customCategories: CustomCategory[],
  recordCategory: LogCategoryKey,
  fixed: boolean,
): OverviewCategoryCard {
  const todayEntries = todayLogs.filter((entry) => matchesCard(entry, id));
  const yesterdayEntries = yesterdayLogs.filter((entry) => matchesCard(entry, id));
  const todayMetric = metricFor(id, todayLogs, customCategories);
  const yesterdayMetric = metricFor(id, yesterdayLogs, customCategories);
  const sameUnit = todayMetric.unit === yesterdayMetric.unit;
  const unit = sameUnit ? todayMetric.unit : "count";
  const todayNumeric = sameUnit ? todayMetric.numeric : todayEntries.length;
  const yesterdayNumeric = sameUnit ? yesterdayMetric.numeric : yesterdayEntries.length;
  const delta = todayNumeric - yesterdayNumeric;
  return {
    id,
    fixed,
    recordCategory,
    numeric: todayNumeric,
    delta,
    unit,
    hasToday: todayEntries.length > 0,
    hasYesterday: yesterdayEntries.length > 0,
    lastStamp: latestStamp([...todayEntries, ...yesterdayEntries]),
    tone: compareTone(delta),
  };
}

function logsThrough(logs: BabyLogEntry[], minutes: number): BabyLogEntry[] {
  const cutoff = Math.max(0, Math.min(1440, minutes));
  return logs.flatMap((entry) => {
    const start = toMinutes(entry.time);
    if (!Number.isFinite(start) || (entry.cat !== "sleep" && start > cutoff)) return [];
    if (entry.cat === "sleep") return [entry];
    const duration = durationMinutes(entry);
    return duration > 0 ? [{ ...entry, duration: String(Math.min(duration, Math.max(0, cutoff - start))) }] : [entry];
  });
}

function coversCursor(entry: BabyLogEntry, minutes: number): boolean {
  const start = toMinutes(entry.time);
  if (!Number.isFinite(start)) return false;
  const duration = durationMinutes(entry);
  if (duration <= 0) return false;
  return minutes >= start && minutes <= Math.min(1440, start + duration);
}

/** Last record at or before the cursor; covering intervals win when the cursor is inside one. */
function eventAt(logs: BabyLogEntry[], id: OverviewCategoryCardId, minutes: number): BabyLogEntry | undefined {
  const matches = logs.filter((entry) => matchesCard(entry, id));
  const covering = matches.find((entry) => coversCursor(entry, minutes));
  if (covering) return covering;
  return matches
    .filter((entry) => {
      const start = toMinutes(entry.time);
      return Number.isFinite(start) && start <= minutes;
    })
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
    .at(-1);
}

function eventDetail(
  entry: BabyLogEntry | undefined,
  id: OverviewCategoryCardId,
  minutes: number,
  customCategories: CustomCategory[],
  unit: "ml" | "min" | "count",
): { value: number | null; label: string | null } {
  if (!entry) return { value: null, label: null };
  if (id === "diaper") {
    return { value: 1, label: diaperTypeLabel(entry) ?? null };
  }
  if (id === "sleep") {
    return { value: sleepMinutesUntil([entry], minutes), label: null };
  }
  const metric = metricFor(id, [entry], customCategories);
  return { value: metric.unit === unit ? metric.numeric : null, label: null };
}

/** Values for one independently inspected day/cursor. */
export function buildOverviewInspectionRows(
  logs: BabyLogEntry[],
  minutes: number,
  options: {
    customCategories?: CustomCategory[];
    defaultFeedingMethod?: DefaultFeedingMethod;
  } = {},
): OverviewInspectionRow[] {
  const cutoff = Math.max(0, Math.min(1440, minutes));
  const customCategories = options.customCategories ?? [];
  const through = logsThrough(logs, cutoff);
  // Reuse the same day on both sides so unit negotiation stays faithful (for
  // example ml instead of falling back to count when the comparison side is empty).
  const cards = buildOverviewCategoryCards(through, through, options);
  return cards.flatMap((card) => {
    if (!card.hasToday) return [];
    const current = eventAt(logs, card.id, cutoff);
    const cumulative = card.id === "sleep"
      ? sleepMinutesUntil(logs, cutoff)
      : metricFor(card.id, through, customCategories).numeric;
    const detail = eventDetail(current, card.id, cutoff, customCategories, card.unit);
    return [{
      id: card.id,
      recordCategory: card.recordCategory,
      eventValue: detail.value,
      eventLabel: detail.label,
      cumulative,
      unit: card.unit,
    }];
  });
}

export function overviewCategoryHint(card: OverviewCategoryCard): OverviewCategoryHint {
  if (!card.hasToday && !card.hasYesterday) return "empty";
  if (!card.hasToday || !card.hasYesterday) return "insufficient";
  return card.tone;
}

export type OverviewTimelineEvent = {
  start: number;
  duration?: number;
};

export type OverviewTimelineRow = {
  id: OverviewCategoryCardId;
  recordCategory: LogCategoryKey;
  color: string;
  iconColor: string;
  asBar: boolean;
  events: OverviewTimelineEvent[];
};

function timelineEventsFor(logs: BabyLogEntry[], id: OverviewCategoryCardId): OverviewTimelineEvent[] {
  if (id === "sleep") {
    return sleepBlocksFor(logs, 1440).map((block) => ({ start: block.start, duration: block.duration }));
  }
  return logs
    .filter((entry) => matchesCard(entry, id))
    .map((entry) => {
      const start = toMinutes(entry.time);
      const duration = durationMinutes(entry);
      return { start, duration: duration > 0 ? duration : undefined };
    })
    .filter((event) => Number.isFinite(event.start));
}

/** Expanded 한눈에 rows + legend: only categories that have a today record. */
export function buildOverviewTimelineRows(
  todayLogs: BabyLogEntry[],
  options: {
    customCategories?: CustomCategory[];
    defaultFeedingMethod?: DefaultFeedingMethod;
  } = {},
): OverviewTimelineRow[] {
  const customCategories = options.customCategories ?? [];
  const feedCat = feedRecordCategory(todayLogs, [], options.defaultFeedingMethod);
  const fixed: OverviewTimelineRow[] = [
    {
      id: "feed",
      recordCategory: feedCat,
      color: OVERVIEW_RHYTHM_COLORS.feed,
      iconColor: OVERVIEW_RHYTHM_COLORS.feed,
      asBar: false,
      events: timelineEventsFor(todayLogs, "feed"),
    },
    {
      id: "sleep",
      recordCategory: "sleep",
      color: OVERVIEW_RHYTHM_COLORS.sleepFill,
      iconColor: OVERVIEW_RHYTHM_COLORS.sleep,
      asBar: true,
      events: timelineEventsFor(todayLogs, "sleep"),
    },
    {
      id: "diaper",
      recordCategory: "diaper",
      color: OVERVIEW_RHYTHM_COLORS.diaper,
      iconColor: OVERVIEW_RHYTHM_COLORS.diaper,
      asBar: false,
      events: timelineEventsFor(todayLogs, "diaper"),
    },
  ];
  const extras = collectOverviewExtraCategoryIds(todayLogs)
    .sort((a, b) => {
      const order = overviewOptionalOrderIndex(a) - overviewOptionalOrderIndex(b);
      if (order !== 0) return order;
      return a.localeCompare(b);
    })
    .map((id) => {
      const key = id as LogCategoryKey;
      const events = timelineEventsFor(todayLogs, key);
      const accent = resolveLogCategory(key, customCategories).color;
      return {
        id: key,
        recordCategory: key,
        color: accent,
        iconColor: accent,
        asBar: false,
        events,
      } satisfies OverviewTimelineRow;
    })
    .filter((row) => row.events.length > 0);
  return [...fixed, ...extras].filter((row) => row.events.length > 0);
}

export function buildOverviewCategoryCards(
  todayLogs: BabyLogEntry[],
  yesterdayLogs: BabyLogEntry[],
  options: {
    customCategories?: CustomCategory[];
    defaultFeedingMethod?: DefaultFeedingMethod;
  } = {},
): OverviewCategoryCard[] {
  const customCategories = options.customCategories ?? [];
  const feedCat = feedRecordCategory(todayLogs, yesterdayLogs, options.defaultFeedingMethod);
  const fixed: OverviewCategoryCard[] = [
    buildCard("feed", todayLogs, yesterdayLogs, customCategories, feedCat, true),
    buildCard("sleep", todayLogs, yesterdayLogs, customCategories, "sleep", true),
    buildCard("diaper", todayLogs, yesterdayLogs, customCategories, "diaper", true),
  ];

  const extras = collectOverviewExtraCategoryIds([...todayLogs, ...yesterdayLogs])
    .map((id) => buildCard(id as LogCategoryKey, todayLogs, yesterdayLogs, customCategories, id as LogCategoryKey, false))
    .filter((card) => card.hasToday || card.hasYesterday);

  return [...fixed, ...extras];
}

function clipSleepCard(
  card: OverviewCategoryCard,
  todaySleep: number,
  yesterdaySleep: number,
): OverviewCategoryCard {
  if (card.id !== "sleep") return card;
  return {
    ...card,
    numeric: todaySleep,
    delta: todaySleep - yesterdaySleep,
    hasToday: todaySleep > 0,
    hasYesterday: yesterdaySleep > 0,
    tone: compareTone(todaySleep - yesterdaySleep),
  };
}

/** Compare each day through its own cursor. Do not force the same x / wall-clock minute. */
export function buildOverviewCategoryCardsAtCursors(
  todayLogs: BabyLogEntry[],
  yesterdayLogs: BabyLogEntry[],
  todayMinutes: number,
  yesterdayMinutes: number,
  options: {
    customCategories?: CustomCategory[];
    defaultFeedingMethod?: DefaultFeedingMethod;
  } = {},
): OverviewCategoryCard[] {
  const todayCutoff = Math.max(0, Math.min(1440, todayMinutes));
  const yesterdayCutoff = Math.max(0, Math.min(1440, yesterdayMinutes));
  const cards = buildOverviewCategoryCards(
    logsThrough(todayLogs, todayCutoff),
    logsThrough(yesterdayLogs, yesterdayCutoff),
    options,
  );
  return cards.map((card) => clipSleepCard(
    card,
    sleepMinutesUntil(todayLogs, todayCutoff),
    sleepMinutesUntil(yesterdayLogs, yesterdayCutoff),
  ));
}

/** Default comparison contract: today-to-now versus yesterday-to-the-same wall-clock minute. */
export function buildOverviewCategoryCardsAtCutoff(
  todayLogs: BabyLogEntry[],
  yesterdayLogs: BabyLogEntry[],
  minutes: number,
  options: {
    customCategories?: CustomCategory[];
    defaultFeedingMethod?: DefaultFeedingMethod;
  } = {},
): OverviewCategoryCard[] {
  return buildOverviewCategoryCardsAtCursors(todayLogs, yesterdayLogs, minutes, minutes, options);
}

function inspectionById(rows: OverviewInspectionRow[]) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function compareCategoryIds(
  todayLogs: BabyLogEntry[],
  yesterdayLogs: BabyLogEntry[],
  options: {
    customCategories?: CustomCategory[];
    defaultFeedingMethod?: DefaultFeedingMethod;
  },
): { id: OverviewCategoryCardId; recordCategory: LogCategoryKey }[] {
  const feedCat = feedRecordCategory(todayLogs, yesterdayLogs, options.defaultFeedingMethod);
  const extras = collectOverviewExtraCategoryIds([...todayLogs, ...yesterdayLogs]);
  const ids: { id: OverviewCategoryCardId; recordCategory: LogCategoryKey }[] = [
    { id: "feed", recordCategory: feedCat },
    { id: "sleep", recordCategory: "sleep" },
    { id: "diaper", recordCategory: "diaper" },
    ...extras.map((id) => ({ id: id as LogCategoryKey, recordCategory: id as LogCategoryKey })),
  ];
  return ids.sort((a, b) => {
    const order = overviewCompareOrderIndex(String(a.id)) - overviewCompareOrderIndex(String(b.id));
    if (order !== 0) return order;
    return String(a.id).localeCompare(String(b.id));
  });
}

/** Independent today/yesterday cursors → only categories with a real record on either side. */
export function buildOverviewIndependentCompareRows(
  todayLogs: BabyLogEntry[],
  yesterdayLogs: BabyLogEntry[],
  todayMinutes: number,
  yesterdayMinutes: number,
  options: {
    customCategories?: CustomCategory[];
    defaultFeedingMethod?: DefaultFeedingMethod;
  } = {},
): OverviewIndependentCompareRow[] {
  const todayCutoff = Math.max(0, Math.min(1440, todayMinutes));
  const yesterdayCutoff = Math.max(0, Math.min(1440, yesterdayMinutes));
  const customCategories = options.customCategories ?? [];
  const todayInspect = inspectionById(buildOverviewInspectionRows(todayLogs, todayCutoff, options));
  const yesterdayInspect = inspectionById(buildOverviewInspectionRows(yesterdayLogs, yesterdayCutoff, options));
  return compareCategoryIds(todayLogs, yesterdayLogs, options).flatMap((item) => {
    const today = compareMetricFor(item.id, todayLogs, todayCutoff, customCategories);
    const yesterday = compareMetricFor(item.id, yesterdayLogs, yesterdayCutoff, customCategories);
    if (!today.has && !yesterday.has) return [];
    const unit = today.has ? today.unit : yesterday.unit;
    const comparable = today.has && yesterday.has
      && today.numeric != null
      && yesterday.numeric != null
      && today.unit === yesterday.unit;
    const inspectToday = todayInspect.get(String(item.id));
    const inspectYesterday = yesterdayInspect.get(String(item.id));
    return [{
      id: item.id,
      recordCategory: item.recordCategory,
      unit,
      todayEventValue: inspectToday?.eventValue ?? null,
      todayEventLabel: inspectToday?.eventLabel ?? null,
      todayCumulative: today.has ? today.numeric : null,
      yesterdayEventValue: inspectYesterday?.eventValue ?? null,
      yesterdayEventLabel: inspectYesterday?.eventLabel ?? null,
      yesterdayCumulative: yesterday.has ? yesterday.numeric : null,
      delta: comparable ? (today.numeric as number) - (yesterday.numeric as number) : null,
      hasToday: today.has,
      hasYesterday: yesterday.has,
      semanticDelta: unit !== "temp",
    }];
  });
}

/** Compare only facts recorded by the same wall-clock minute on each day. */
export function buildOverviewCategoryCompareRows(
  todayLogs: BabyLogEntry[],
  yesterdayLogs: BabyLogEntry[],
  minutes: number,
  options: {
    customCategories?: CustomCategory[];
    defaultFeedingMethod?: DefaultFeedingMethod;
  } = {},
): OverviewCategoryCompareRow[] {
  const cutoff = Math.max(0, Math.min(1440, minutes));
  const cards = buildOverviewCategoryCards(logsThrough(todayLogs, cutoff), logsThrough(yesterdayLogs, cutoff), options);
  const todaySleep = sleepMinutesUntil(todayLogs, cutoff);
  const yesterdaySleep = sleepMinutesUntil(yesterdayLogs, cutoff);
  const rows: OverviewCategoryCompareRow[] = [];
  for (const card of cards) {
    if (card.id === "sleep") {
      if (todaySleep <= 0 && yesterdaySleep <= 0) continue;
      rows.push({
        id: card.id,
        recordCategory: card.recordCategory,
        delta: todaySleep > 0 && yesterdaySleep > 0 ? todaySleep - yesterdaySleep : null,
        unit: "min",
      });
      continue;
    }
    if (!card.hasToday && !card.hasYesterday) continue;
    rows.push({
      id: card.id,
      recordCategory: card.recordCategory,
      delta: card.hasToday && card.hasYesterday ? card.delta : null,
      unit: card.unit,
    });
  }
  return rows;
}
