import type { BabyLogEntry } from "../types/babyLog";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

const STORAGE_KEY = STORAGE_KEYS.babyLogs;

let memoryLogs: BabyLogEntry[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function isLogEntry(item: unknown): item is BabyLogEntry {
  if (typeof item !== "object" || item === null) return false;
  const e = item as BabyLogEntry;
  return typeof e.id === "string" && typeof e.cat === "string" && typeof e.time === "string";
}

function normalizeLogs(raw: unknown): BabyLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isLogEntry);
}

export async function hydrateBabyLogs(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memoryLogs = raw ? normalizeLogs(JSON.parse(raw)) : null;
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

/** null means "never saved yet" — caller may seed */
export function getBabyLogs(): BabyLogEntry[] | null {
  return memoryLogs;
}

export async function saveBabyLogs(logs: BabyLogEntry[]): Promise<void> {
  memoryLogs = logs;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
