import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CustomCategory } from "../types/logCategory";
import { STORAGE_KEYS } from "./storageKeys";

const STORAGE_KEY = STORAGE_KEYS.customCategories;

let memoryCategories: CustomCategory[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

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

export async function hydrateCustomCategories(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        memoryCategories = raw ? normalizeCategories(JSON.parse(raw)) : [];
      } catch {
        memoryCategories = [];
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getCustomCategories(): CustomCategory[] {
  return memoryCategories ?? [];
}

export async function saveCustomCategories(categories: CustomCategory[]): Promise<void> {
  memoryCategories = categories;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // ignore persistence errors
  }
}
