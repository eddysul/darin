import type { CustomCategory } from "../types/logCategory";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

const STORAGE_KEY = STORAGE_KEYS.customCategories;

let memoryCategories: CustomCategory[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function normalizeCategories(raw: unknown): CustomCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is CustomCategory =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as CustomCategory).id === "string" &&
      typeof (item as CustomCategory).label === "string" &&
      typeof (item as CustomCategory).color === "string",
  );
}

export async function hydrateCustomCategories(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memoryCategories = raw ? normalizeCategories(JSON.parse(raw)) : [];
        hydrated = true;
        return true;
      } catch {
        reportStorageIssue("load", STORAGE_KEY);
        return false;
      }
    })();
  }
  return hydratePromise;
}

export function getCustomCategories(): CustomCategory[] {
  return memoryCategories ?? [];
}

export async function saveCustomCategories(categories: CustomCategory[]): Promise<void> {
  memoryCategories = categories;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
