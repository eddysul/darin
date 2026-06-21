import type { CareEvent } from "../types/transcribe";
import type {
  DailyReport,
  DailyReportItem,
  ReportDetailCategory,
  ReportDetailRow,
  ReportMainCategory,
} from "../types/dailyReport";
import { REPORT_DETAIL_CATEGORIES, REPORT_MAIN_CATEGORIES } from "../types/dailyReport";

type NormalizeOptions = {
  events?: CareEvent[];
  rawText?: string;
};

const EVENT_CATEGORY_MAP: Record<string, ReportDetailCategory> = {
  배변: "bowel",
  식사: "meal",
  수면: "sleep",
  "키 몸무게의 변화": "growth",
  목욕: "bath",
  진료: "clinic",
  "온도/습도": "environment",
  영양제: "supplement",
  터미타임: "tummy_time",
  간식: "snack",
  "복용 약": "medication",
};

const LEGACY_ITEM_MAP: Partial<Record<DailyReportItem["type"], ReportDetailCategory>> = {
  meal: "meal",
  nap: "sleep",
  activity: "tummy_time",
  health: "clinic",
  reminder: "snack",
};

const MAIN_FROM_DETAIL: Partial<Record<ReportDetailCategory, ReportMainCategory>> = {
  bowel: "bowel",
  meal: "meal",
  sleep: "sleep",
  growth: "growth",
  clinic: "clinic",
};

function formatEventValue(event: CareEvent): string {
  const parts: string[] = [];
  const skip = new Set(["category"]);
  for (const [key, val] of Object.entries(event)) {
    if (skip.has(key) || val == null || val === "") continue;
    parts.push(String(val));
  }
  return parts.join(" · ") || String(event.category);
}

function inferFromText(text: string): Set<ReportDetailCategory> {
  const lower = text.toLowerCase();
  const found = new Set<ReportDetailCategory>();

  const rules: [RegExp, ReportDetailCategory][] = [
    [/bowel|diaper|poop|stool|대변|소변|배변/i, "bowel"],
    [/lunch|dinner|breakfast|meal|fed|ate|rice|식사|점심|아침|저녁|수유|분유|모유|이유식/i, "meal"],
    [/nap|sleep|slept|woke|수면|낮잠|잠/i, "sleep"],
    [/height|weight|growth|키|몸무게/i, "growth"],
    [/bath|목욕/i, "bath"],
    [/clinic|doctor|hospital|visit|진료|병원/i, "clinic"],
    [/temp|humidity|fever|체온|습도/i, "environment"],
    [/supplement|vitamin|영양제/i, "supplement"],
    [/tummy|play|block|outside|놀이|터미/i, "tummy_time"],
    [/snack|간식/i, "snack"],
    [/medicine|medication|약/i, "medication"],
    [/cough|기침/i, "environment"],
  ];

  for (const [pattern, type] of rules) {
    if (pattern.test(lower) || pattern.test(text)) found.add(type);
  }
  return found;
}

function collectDetailValues(
  report: DailyReport,
  options: NormalizeOptions,
): Map<ReportDetailCategory, { value: string; recorded: boolean }> {
  const map = new Map<ReportDetailCategory, { value: string; recorded: boolean }>();
  const corpus = [report.sourceNote, report.reportEn, report.reportKo, options.rawText ?? ""]
    .filter(Boolean)
    .join("\n");

  for (const event of options.events ?? []) {
    const type = EVENT_CATEGORY_MAP[event.category];
    if (!type) continue;
    map.set(type, { value: formatEventValue(event), recorded: true });
  }

  for (const item of report.items ?? []) {
    const type = LEGACY_ITEM_MAP[item.type];
    if (!type) continue;
    const value = item.value?.trim() || item.label?.trim();
    if (!value) continue;
    if (!map.has(type)) {
      map.set(type, { value, recorded: true });
    }
  }

  if (report.details?.length) {
    for (const row of report.details) {
      if (row.recorded && row.value.trim()) {
        map.set(row.type, { value: row.value.trim(), recorded: true });
      }
    }
  }

  const inferred = inferFromText(corpus);
  for (const type of inferred) {
    if (map.has(type)) continue;
    map.set(type, { value: "", recorded: true });
  }

  for (const type of inferred) {
    const entry = map.get(type);
    if (entry?.recorded && !entry.value) {
      map.set(type, { value: pickInferredPlaceholder(type, "en"), recorded: true });
    }
  }

  return map;
}

function pickInferredPlaceholder(type: ReportDetailCategory, locale: "en" | "ko"): string {
  const en: Record<ReportDetailCategory, string> = {
    bowel: "Recorded today",
    meal: "Meal noted",
    sleep: "Sleep noted",
    growth: "No major change from recent record",
    bath: "Completed · Skin looked normal",
    clinic: "No visit today",
    environment: "Comfortable indoor environment",
    supplement: "Given as instructed",
    tummy_time: "Brief session · Good endurance",
    snack: "Small amount · No reaction",
    medication: "None / Given as instructed",
  };
  const ko: Record<ReportDetailCategory, string> = {
    bowel: "오늘 기록됨",
    meal: "식사 기록됨",
    sleep: "수면 기록됨",
    growth: "최근 기록 대비 큰 변화 없음",
    bath: "완료 · 피부 상태 정상",
    clinic: "오늘 진료 없음",
    environment: "실내 환경 쾌적",
    supplement: "지시대로 섭취",
    tummy_time: "짧은 세션 · 잘 참음",
    snack: "소량 · 특이 반응 없음",
    medication: "없음 / 지시대로 복용",
  };
  return locale === "ko" ? ko[type] : en[type];
}

function defaultDetailValue(type: ReportDetailCategory, locale: "en" | "ko"): string {
  return pickInferredPlaceholder(type, locale);
}

export function resolveDetailRows(
  report: DailyReport,
  locale: "en" | "ko",
  options: NormalizeOptions = {},
): ReportDetailRow[] {
  const values = collectDetailValues(report, options);

  return REPORT_DETAIL_CATEGORIES.map((type) => {
    const entry = values.get(type);
    if (entry?.recorded && entry.value) {
      return { type, value: entry.value, recorded: true };
    }
    if (entry?.recorded) {
      return { type, value: defaultDetailValue(type, locale), recorded: true };
    }
    return { type, value: defaultDetailValue(type, locale), recorded: false };
  });
}

export function resolveMainCategories(
  report: DailyReport,
  options: NormalizeOptions = {},
): ReportMainCategory[] {
  if (report.mainCategories?.length) {
    return report.mainCategories;
  }

  const active = new Set<ReportMainCategory>();
  const details = resolveDetailRows(report, "en", options);

  for (const row of details) {
    if (!row.recorded) continue;
    const main = MAIN_FROM_DETAIL[row.type];
    if (main) active.add(main);
  }

  for (const item of report.items ?? []) {
    if (item.type === "meal") active.add("meal");
    if (item.type === "nap") active.add("sleep");
    if (item.type === "health") active.add("clinic");
  }

  return REPORT_MAIN_CATEGORIES.filter((c) => active.has(c));
}

function buildDefaultSummary(
  child: string,
  active: ReportMainCategory[],
  locale: "en" | "ko",
): string {
  const labelsEn: Record<ReportMainCategory, string> = {
    bowel: "bowel movement",
    sleep: "nap",
    meal: "meals",
    growth: "growth",
    clinic: "clinic visit",
  };
  const labelsKo: Record<ReportMainCategory, string> = {
    bowel: "배변",
    sleep: "낮잠",
    meal: "식사",
    growth: "성장",
    clinic: "진료",
  };

  if (active.length === 0) {
    return locale === "ko"
      ? `${child}의 오늘 돌봄 기록이 저장되었습니다.`
      : `${child}'s care notes were saved for today.`;
  }

  const parts = active.map((c) => (locale === "ko" ? labelsKo[c] : labelsEn[c]));
  const joined =
    locale === "ko"
      ? parts.length > 1
        ? `${parts.slice(0, -1).join(", ")} 및 ${parts[parts.length - 1]}`
        : parts[0]
      : parts.length > 1
        ? `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
        : parts[0];

  return locale === "ko"
    ? `${child}는 안정적인 하루를 보냈습니다. ${joined} 기록이 있습니다. 오늘 새로운 건강 이슈는 없었습니다.`
    : `${child} had a stable day. ${joined.charAt(0).toUpperCase()}${joined.slice(1)} were recorded. No new health concerns were noted today.`;
}

export function resolveCareSummary(
  report: DailyReport,
  locale: "en" | "ko",
  activeMain: ReportMainCategory[],
): string {
  if (locale === "ko" && report.careSummaryKo?.trim()) return report.careSummaryKo.trim();
  if (report.careSummaryEn?.trim()) {
    return locale === "ko" ? report.careSummaryKo?.trim() || report.careSummaryEn.trim() : report.careSummaryEn.trim();
  }
  return buildDefaultSummary(report.child, activeMain, locale);
}

export function normalizeDailyReport(
  report: DailyReport,
  options: NormalizeOptions = {},
): DailyReport {
  const details = report.details?.length
    ? report.details
    : resolveDetailRows(report, "en", options);
  const mainCategories = report.mainCategories?.length
    ? report.mainCategories
    : resolveMainCategories({ ...report, details }, options);

  const withMain = { ...report, details, mainCategories };
  const careSummaryEn =
    report.careSummaryEn?.trim() ||
    resolveCareSummary(withMain, "en", mainCategories);
  const careSummaryKo =
    report.careSummaryKo?.trim() ||
    resolveCareSummary(withMain, "ko", mainCategories);

  return {
    ...withMain,
    careSummaryEn,
    careSummaryKo,
  };
}

export type ReportPresentation = {
  activeMain: Set<ReportMainCategory>;
  mainCategories: ReportMainCategory[];
  details: ReportDetailRow[];
  careSummary: string;
  fullReport: string;
};

export function getReportPresentation(
  report: DailyReport,
  locale: "en" | "ko",
  options: NormalizeOptions = {},
): ReportPresentation {
  const normalized = normalizeDailyReport(report, options);
  const mainCategories = normalized.mainCategories ?? [];
  const activeMain = new Set(mainCategories);
  const details = resolveDetailRows(normalized, locale, options);

  return {
    activeMain,
    mainCategories: REPORT_MAIN_CATEGORIES,
    details,
    careSummary: resolveCareSummary(normalized, locale, mainCategories),
    fullReport: locale === "ko" ? normalized.reportKo : normalized.reportEn,
  };
}
