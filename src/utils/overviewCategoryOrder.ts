/** Always-visible overview cards, in display order. */
export const OVERVIEW_FIXED_CATEGORY_IDS = ["feed", "sleep", "diaper"] as const;
export type OverviewFixedCategoryId = (typeof OVERVIEW_FIXED_CATEGORY_IDS)[number];

/**
 * Predefined extras after 수유·수면·기저귀.
 * Walk/산책 is omitted — it is not a stored log category.
 * Health is not aggregated; doctor / vaccination / temp appear separately when logged.
 */
export const OVERVIEW_OPTIONAL_CATEGORY_ORDER = [
  "tummy",
  "food",
  "bath",
  "play",
  "pump",
  "med",
  "doctor",
  "vaccination",
  "temp",
  "snack",
  "water",
  "memo",
  "other",
  "pregMood",
  "pregSymptom",
  "pregWeight",
  "pregBp",
  "pregMed",
  "pregKick",
  "pregHospital",
  "contraction",
] as const;

export const OVERVIEW_FEEDING_LOG_CATS = ["breast", "formula", "storedMilk", "milk"] as const;

const FEEDING_SET = new Set<string>(OVERVIEW_FEEDING_LOG_CATS);
const OPTIONAL_INDEX = new Map<string, number>(
  OVERVIEW_OPTIONAL_CATEGORY_ORDER.map((id, index) => [id, index]),
);

export function isOverviewFixedLogCat(cat: string): boolean {
  return cat === "sleep" || cat === "diaper" || FEEDING_SET.has(cat);
}

export function overviewOptionalOrderIndex(id: string): number {
  const index = OPTIONAL_INDEX.get(id);
  if (index != null) return index;
  return OVERVIEW_OPTIONAL_CATEGORY_ORDER.length + (id.startsWith("custom:") ? 1 : 2);
}

/** Compare-summary order: 수유·수면·기저귀, then the existing optional registry. No invented ids. */
export function overviewCompareOrderIndex(id: string): number {
  if (id === "feed") return 0;
  if (id === "sleep") return 1;
  if (id === "diaper") return 2;
  return 3 + overviewOptionalOrderIndex(id);
}

export function stampOfLog(entry: { dateKey?: string; time?: string }): string {
  return `${entry.dateKey ?? ""}T${entry.time ?? ""}`;
}

/**
 * Extra cards: only categories that actually appear in the given logs,
 * newest lastStamp first, then predefined order.
 */
export function collectOverviewExtraCategoryIds(
  entries: Array<{ cat: string; dateKey?: string; time?: string }>,
): string[] {
  const latest = new Map<string, string>();
  for (const entry of entries) {
    if (isOverviewFixedLogCat(entry.cat)) continue;
    const stamp = stampOfLog(entry);
    const previous = latest.get(entry.cat) ?? "";
    if (stamp > previous) latest.set(entry.cat, stamp);
  }
  return [...latest.entries()]
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] < b[1] ? 1 : -1;
      const order = overviewOptionalOrderIndex(a[0]) - overviewOptionalOrderIndex(b[0]);
      if (order !== 0) return order;
      return a[0].localeCompare(b[0]);
    })
    .map(([id]) => id);
}
