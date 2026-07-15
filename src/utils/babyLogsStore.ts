import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BabyLogEntry } from "../types/babyLog";
import { STORAGE_KEYS } from "./storageKeys";

const STORAGE_KEY = STORAGE_KEYS.babyLogs;

let memoryLogs: BabyLogEntry[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function isLogEntry(item: unknown): item is BabyLogEntry {
  if (typeof item !== "object" || item === null) return false;
  const e = item as BabyLogEntry;
  return typeof e.id === "string" && typeof e.cat === "string" && typeof e.time === "string";
}

function normalizeLogs(raw: unknown): BabyLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isLogEntry);
}

export async function hydrateBabyLogs(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        memoryLogs = raw ? normalizeLogs(JSON.parse(raw)) : null;
      } catch {
        memoryLogs = null;
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

/** null means "never saved yet" — caller may seed */
export function getBabyLogs(): BabyLogEntry[] | null {
  return memoryLogs;
}

export async function saveBabyLogs(logs: BabyLogEntry[]): Promise<void> {
  memoryLogs = logs;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}
