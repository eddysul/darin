import type { BabyLogCategoryId } from "./babyLogCategories";
import type { DefaultFeedingMethod, LogCategoryGroup } from "../types/careSetup";

export const LOG_GROUP_CATEGORIES: Record<LogCategoryGroup, BabyLogCategoryId[]> = {
  feeding: ["breast", "formula", "storedMilk", "milk", "food", "snack", "pump", "water"],
  sleep: ["sleep"],
  diaper: ["diaper"],
  medication: ["med"],
  health: ["temp", "doctor", "bath"],
  mood: ["tummy", "play"],
  note: ["memo", "other"],
};

const FEEDING_IDS: BabyLogCategoryId[] = ["breast", "formula", "storedMilk", "milk", "pump", "food", "snack", "water"];

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
      ? ["breast", "formula", "storedMilk", "pump", "milk", "food", "snack", "water"]
      : method === "formula"
        ? ["formula", "breast", "storedMilk", "pump", "milk", "food", "snack", "water"]
        : method === "pumped_milk"
          ? ["storedMilk", "pump", "formula", "breast", "milk", "food", "snack", "water"]
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
