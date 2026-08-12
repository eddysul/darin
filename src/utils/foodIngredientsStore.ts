import type { FoodIngredient } from "../types/foodIngredient";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { isValidLocalDataScope, scopedStorageKey, type LocalDataScope } from "./scopedLocalStorage";
import { reportStorageIssue } from "./storageIssues";

const LOCAL_KEY = `${STORAGE_KEYS.foodIngredients}:local`;

function keyFor(scope: LocalDataScope | null): string {
  return isValidLocalDataScope(scope) ? scopedStorageKey(STORAGE_KEYS.foodIngredients, scope) : LOCAL_KEY;
}

export function normalizeIngredientName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 30);
}

export function normalizeFoodIngredients(raw: unknown): FoodIngredient[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const value = item as Partial<FoodIngredient>;
    const name = normalizeIngredientName(value.name ?? "");
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key) || (value.source !== "baby_food" && value.source !== "snack")) return [];
    seen.add(key);
    return [{
      id: typeof value.id === "string" ? value.id : key,
      name,
      source: value.source,
      createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
      babyId: typeof value.babyId === "string" ? value.babyId : undefined,
      createdBy: typeof value.createdBy === "string" ? value.createdBy : undefined,
    }];
  });
}

export async function loadFoodIngredients(scope: LocalDataScope | null): Promise<FoodIngredient[]> {
  try {
    const raw = await qaStorage.getItem(keyFor(scope));
    if (!raw) return [];
    return normalizeFoodIngredients(JSON.parse(raw));
  } catch {
    reportStorageIssue("load", STORAGE_KEYS.foodIngredients);
    return [];
  }
}

export async function saveFoodIngredients(items: FoodIngredient[], scope: LocalDataScope | null): Promise<void> {
  try {
    await qaStorage.setItem(keyFor(scope), JSON.stringify(normalizeFoodIngredients(items)));
  } catch {
    reportStorageIssue("save", STORAGE_KEYS.foodIngredients);
  }
}
