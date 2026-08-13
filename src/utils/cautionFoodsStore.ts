import type { CautionFood } from "../types/cautionFood";
import { qaStorage } from "./qaStorage";
import { scopedStorageKey, type LocalDataScope } from "./scopedLocalStorage";

const BASE_KEY = "darin:baby-caution-foods";

export function normalizeCautionFoodName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase().slice(0, 40);
}

export async function loadCautionFoods(scope: LocalDataScope): Promise<CautionFood[]> {
  const raw = await qaStorage.getItem(scopedStorageKey(BASE_KEY, scope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CautionFood[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.babyId === scope.babyId && !item.archivedAt) : [];
  } catch {
    return [];
  }
}

export async function saveCautionFoods(scope: LocalDataScope, foods: CautionFood[]): Promise<void> {
  await qaStorage.setItem(scopedStorageKey(BASE_KEY, scope), JSON.stringify(foods.filter((item) => item.babyId === scope.babyId)));
}

export function matchCautionFoods(ingredients: string[], foods: CautionFood[]): string[] {
  const cautionNames = new Set(foods.filter((item) => !item.archivedAt).map((item) => item.normalizedFoodName));
  return [...new Set(ingredients.filter((ingredient) => cautionNames.has(normalizeCautionFoodName(ingredient))))];
}
