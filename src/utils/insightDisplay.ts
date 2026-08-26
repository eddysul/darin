import type { Locale } from "../i18n";
import type { InsightCriticalKey } from "../i18nInsightCriticalMessages";
import { isCustomCategoryKey } from "../types/logCategory";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import { offsetDateKey, parseDateKey, formatDateKey } from "./dateKey";
import { recordCategoryLabel, type Translate } from "./recordDisplay";
import { featureFormatKind, type FeatureKey, type Insight } from "./careInsights";
import { toIntlLocale } from "./localeFormat";

const FEATURE_ORDER: FeatureKey[] = [
  "feedCount", "feedVolume", "feedIntervalAvg", "firstFeedMinutes", "lastFeedMinutes",
  "sleepMinutes", "nightSleepMinutes", "longestSleepMinutes", "sleepCount",
  "diaperCount", "stoolCount", "tummyMinutes", "playMinutes", "bathMinutes",
  "waterVolume", "foodAmount", "milkVolume",
];

const NARRATIVE_ORDER: FeatureKey[] = [
  "feedCount", "feedVolume", "feedIntervalAvg", "sleepMinutes", "nightSleepMinutes",
  "longestSleepMinutes", "sleepCount", "diaperCount", "stoolCount", "tummyMinutes",
  "playMinutes", "waterVolume", "foodAmount", "milkVolume",
];

function padId(n: number): string {
  return String(n).padStart(3, "0");
}

function keyAt(start: number, index: number): InsightCriticalKey {
  return `insight.critical.${padId(start + index)}` as InsightCriticalKey;
}

export function weeklyMetricLabel(key: string, t: Translate): string {
  const index = FEATURE_ORDER.indexOf(key as FeatureKey);
  return index >= 0 ? t(keyAt(1, index)) : key;
}

export function insightLeadKey(feature: FeatureKey, high: boolean): InsightCriticalKey {
  const index = FEATURE_ORDER.indexOf(feature);
  return keyAt(high ? 35 : 18, index);
}

export function insightTailKey(feature: FeatureKey): InsightCriticalKey {
  return keyAt(52, FEATURE_ORDER.indexOf(feature));
}

export function narrativeSubjectKey(feature: string): InsightCriticalKey | null {
  const index = NARRATIVE_ORDER.indexOf(feature as FeatureKey);
  return index >= 0 ? keyAt(102, index) : null;
}

export function narrativeChangeKey(feature: string, up: boolean): InsightCriticalKey | null {
  const index = NARRATIVE_ORDER.indexOf(feature as FeatureKey);
  return index >= 0 ? keyAt(up ? 116 : 130, index) : null;
}

export function weekdayMessageKey(day: number): InsightCriticalKey {
  return keyAt(83, ((day % 7) + 7) % 7);
}

function bucketNameKeys(kind: ReturnType<typeof featureFormatKind>): [InsightCriticalKey, InsightCriticalKey, InsightCriticalKey] {
  if (kind === "clock") return ["insight.critical.069", "insight.critical.070", "insight.critical.071"];
  if (kind === "minutes") return ["insight.critical.075", "insight.critical.076", "insight.critical.077"];
  return ["insight.critical.072", "insight.critical.073", "insight.critical.074"];
}

function formatClockHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatClockReading(minutes: number, locale: Locale): string {
  const total = Math.round(minutes) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const date = new Date(2000, 0, 1, hour, minute);
  const hour12 = locale !== "es";
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    hour: "numeric",
    minute: minute ? "2-digit" : undefined,
    hour12,
  }).format(date);
}

export function formatFeatureValue(key: FeatureKey, value: number, t: Translate, _locale: Locale): string {
  const kind = featureFormatKind(key);
  const rounded = Math.round(value);
  if (kind === "clock") return formatClockHHmm(value);
  if (kind === "count") return t("report.critical.125", { count: rounded });
  if (kind === "minutes") {
    if (rounded < 60) return t("report.critical.114", { count: rounded });
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    return minutes ? t("report.critical.115", { hours, minutes }) : t("report.critical.116", { hours });
  }
  if (kind === "ml") return t("insight.critical.147", { count: rounded });
  return t("insight.critical.148", { count: rounded });
}

function formatRangeBound(key: FeatureKey, value: number, t: Translate, locale: Locale): string {
  return featureFormatKind(key) === "clock" ? formatClockHHmm(value) : formatFeatureValue(key, value, t, locale);
}

function formatBucketRange(
  key: FeatureKey,
  index: number,
  start: number,
  end: number,
  t: Translate,
  locale: Locale,
): string {
  if (index === 0) return t("insight.critical.144", { value: formatRangeBound(key, end, t, locale) });
  if (index === 2) return t("insight.critical.145", { value: formatRangeBound(key, start, t, locale) });
  return t("insight.critical.146", {
    min: formatRangeBound(key, start, t, locale),
    max: formatRangeBound(key, end, t, locale),
  });
}

export type LocalizedInsight = {
  lead: string;
  gapText: string;
  tail: string;
  headline: string;
  bucketLabel: string;
  valueLabel: string;
  subtitle: string;
  formatValue: (value: number) => string;
  buckets: { name: string; range: string; valueLabel: string; daysLabel: string }[];
};

export function localizeInsight(insight: Insight, t: Translate, locale: Locale): LocalizedInsight {
  const high = insight.rho >= 0;
  const lead = t(insightLeadKey(insight.input, high));
  const first = insight.distribution.buckets[0];
  const last = insight.distribution.buckets[insight.distribution.buckets.length - 1];
  const gapText = formatFeatureValue(insight.output, Math.abs(last.value - first.value), t, locale);
  const tail = t(insightTailKey(insight.output));
  const bucketLabel = weeklyMetricLabel(insight.input, t);
  const valueLabel = weeklyMetricLabel(insight.output, t);
  const names = bucketNameKeys(featureFormatKind(insight.input));
  return {
    lead,
    gapText,
    tail,
    headline: `${lead}${gapText} ${tail}`,
    bucketLabel,
    valueLabel,
    subtitle: t("insight.critical.078", { days: insight.distribution.totalDays, bucketLabel, valueLabel }),
    formatValue: (value) => formatFeatureValue(insight.output, value, t, locale),
    buckets: insight.distribution.buckets.map((bucket, index) => ({
      name: t(names[index] ?? names[1]),
      range: formatBucketRange(insight.input, index, bucket.rangeStart ?? 0, bucket.rangeEnd ?? 0, t, locale),
      valueLabel: formatFeatureValue(insight.output, bucket.value, t, locale),
      daysLabel: t("insight.critical.079", { count: bucket.days }),
    })),
  };
}

export function chartCategoryLabel(key: string, t: Translate): string {
  if (key === "feed") return t("home.metric.feeding");
  if (!isCustomCategoryKey(key)) return recordCategoryLabel(t, key as BabyLogCategoryId);
  return key;
}

export function stripDayLabel(dateKey: string, t: Translate, todayKey = formatDateKey()): string {
  if (dateKey === todayKey) return t("insight.critical.090");
  if (dateKey === offsetDateKey(todayKey, -1)) return t("insight.critical.091");
  if (dateKey === offsetDateKey(todayKey, 1)) return t("insight.critical.092");
  return t(weekdayMessageKey(parseDateKey(dateKey).getDay()));
}

export function formatDayNavLabel(dateKey: string, t: Translate, todayKey = formatDateKey()): string {
  const date = parseDateKey(dateKey);
  const compact = `${date.getMonth() + 1}.${date.getDate()}`;
  const weekday = t(weekdayMessageKey(date.getDay()));
  if (dateKey === todayKey) {
    return t("chrome.critical.009", { label: t("insight.critical.090"), date: compact, weekday });
  }
  if (dateKey === offsetDateKey(todayKey, -1)) {
    return t("chrome.critical.009", { label: t("insight.critical.091"), date: compact, weekday });
  }
  if (dateKey === offsetDateKey(todayKey, 1)) {
    return t("chrome.critical.009", { label: t("insight.critical.092"), date: compact, weekday });
  }
  return t("chrome.critical.010", { date: compact, weekday });
}

export function formatMonthDay(dateKey: string, t: Translate): string {
  const date = parseDateKey(dateKey);
  return t("insight.critical.099", { month: date.getMonth() + 1, day: date.getDate() });
}

export function formatWeekOfMonth(dateKey: string, t: Translate): string {
  const date = parseDateKey(dateKey);
  return t("insight.critical.100", { month: date.getMonth() + 1, week: Math.ceil(date.getDate() / 7) });
}

export function formatPeriodRange(dateKeys: string[], t: Translate): string {
  if (!dateKeys.length) return "";
  return t("insight.critical.101", {
    start: formatMonthDay(dateKeys[0], t),
    end: formatMonthDay(dateKeys[dateKeys.length - 1], t),
  });
}

export function formatWeeklyAmount(key: string, unit: string, value: number, t: Translate, locale: Locale): string {
  const rounded = Math.round(value);
  if (key === "firstFeedMinutes" || key === "lastFeedMinutes" || key === "bathMinutes") {
    const h = Math.floor(rounded / 60) % 24;
    return `${h}:${String(rounded % 60).padStart(2, "0")}`;
  }
  if (FEATURE_ORDER.includes(key as FeatureKey)) return formatFeatureValue(key as FeatureKey, value, t, locale);
  if (unit === "분" || unit === "minutes") return formatFeatureValue("sleepMinutes", value, t, locale);
  if (unit === "회") return t("report.critical.125", { count: rounded });
  if (unit === "ml") return t("insight.critical.147", { count: rounded });
  if (unit === "g") return t("insight.critical.148", { count: rounded });
  return `${rounded}${unit}`;
}
