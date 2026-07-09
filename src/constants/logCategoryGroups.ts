import type { BabyLogCategoryId } from "./babyLogCategories";
import type { DefaultFeedingMethod, LogCategoryGroup } from "../types/careSetup";

export const LOG_GROUP_CATEGORIES: Record<LogCategoryGroup, BabyLogCategoryId[]> = {
  feeding: ["breast", "formula", "food", "snack", "pump"],
  sleep: ["sleep"],
  diaper: ["diaper"],
  medication: ["med"],
  health: ["temp", "doctor", "bath"],
  mood: ["tummy", "play"],
  note: ["memo"],
};

const FEEDING_IDS: BabyLogCategoryId[] = ["breast", "formula", "pump", "food", "snack"];

export function resolveEnabledCategoryIds(groups: LogCategoryGroup[]): BabyLogCategoryId[] {
  const ids = new Set<BabyLogCategoryId>();
  for (const group of groups) {
    for (const id of LOG_GROUP_CATEGORIES[group]) ids.add(id);
  }
  return Array.from(ids);
}

export function sortCategoriesForFeeding(
  ids: BabyLogCategoryId[],
  method: DefaultFeedingMethod,
): BabyLogCategoryId[] {
  const priority: BabyLogCategoryId[] =
    method === "breastfeeding"
      ? ["breast", "formula", "pump", "food", "snack"]
      : method === "formula"
        ? ["formula", "breast", "pump", "food", "snack"]
        : method === "pumped_milk"
          ? ["pump", "formula", "breast", "food", "snack"]
          : method === "mixed"
            ? FEEDING_IDS
            : [];

  if (!priority.length) return ids;

  const rank = new Map(priority.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a)! : 99;
    const rb = rank.has(b) ? rank.get(b)! : 99;
    if (ra !== rb) return ra - rb;
    return ids.indexOf(a) - ids.indexOf(b);
  });
}

export function isFeedingCategory(catId: BabyLogCategoryId): boolean {
  return FEEDING_IDS.includes(catId);
}
