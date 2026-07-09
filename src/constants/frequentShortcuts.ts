import { getCategory, type BabyLogCategoryId } from "./babyLogCategories";

export type FrequentShortcutId = "feeding" | BabyLogCategoryId;

export const MAX_FREQUENT_SHORTCUTS = 4;

export const DEFAULT_FREQUENT_SHORTCUTS: FrequentShortcutId[] = [
  "feeding",
  "sleep",
  "diaper",
  "temp",
];

export const FREQUENT_SHORTCUT_OPTIONS: FrequentShortcutId[] = [
  "feeding",
  "breast",
  "formula",
  "pump",
  "food",
  "snack",
  "sleep",
  "diaper",
  "temp",
  "med",
  "bath",
  "doctor",
  "tummy",
  "play",
  "memo",
];

export type FrequentShortcutMeta = {
  title: string;
  subtitle: string;
  accent: string;
  bg: string;
};

const FEEDING_META: FrequentShortcutMeta = {
  title: "수유",
  subtitle: "모유 · 분유 · 유축",
  accent: "#E8918A",
  bg: "rgba(232,145,138,0.12)",
};

const CATEGORY_SUBTITLES: Partial<Record<BabyLogCategoryId, string>> = {
  breast: "좌측 · 우측 · 양쪽",
  formula: "용량 ml",
  pump: "유축량 ml",
  food: "이유식 기록",
  snack: "간식 기록",
  sleep: "낮잠 · 밤잠",
  diaper: "소변 · 대변",
  temp: "체온 기록",
  med: "투약 기록",
  bath: "목욕 기록",
  doctor: "진료 기록",
  tummy: "터미 타임",
  play: "놀이 시간",
  memo: "자유 메모",
};

export function getFrequentShortcutMeta(id: FrequentShortcutId): FrequentShortcutMeta {
  if (id === "feeding") return FEEDING_META;
  const c = getCategory(id);
  return {
    title: c.label,
    subtitle: CATEGORY_SUBTITLES[id] ?? "빠른 기록",
    accent: c.color,
    bg: `${c.color}22`,
  };
}

export function normalizeFrequentShortcuts(ids: unknown): FrequentShortcutId[] {
  if (!Array.isArray(ids)) return [...DEFAULT_FREQUENT_SHORTCUTS];
  const valid = ids.filter(
    (id): id is FrequentShortcutId =>
      typeof id === "string" &&
      (id === "feeding" || FREQUENT_SHORTCUT_OPTIONS.includes(id as FrequentShortcutId)),
  );
  const unique = [...new Set(valid)].slice(0, MAX_FREQUENT_SHORTCUTS);
  return unique.length ? unique : [...DEFAULT_FREQUENT_SHORTCUTS];
}

export function shortcutToCategoryId(id: FrequentShortcutId): BabyLogCategoryId | null {
  return id === "feeding" ? null : id;
}
