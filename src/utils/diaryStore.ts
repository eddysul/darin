import type { DiaryEntry } from "../types/babyLog";
import { migrateDiaryEntry } from "./diaryModel";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";

const STORAGE_KEY = STORAGE_KEYS.diary;

let memory: DiaryEntry[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

export async function hydrateDiaryEntries(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        if (!raw) {
          memory = null;
        } else {
          const parsed = JSON.parse(raw) as unknown[];
          memory = Array.isArray(parsed)
            ? parsed.map((item) => migrateDiaryEntry(item)).filter((d): d is DiaryEntry => !!d)
            : null;
        }
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

export function getDiaryEntries(): DiaryEntry[] | null {
  return memory;
}

export async function saveDiaryEntries(entries: DiaryEntry[]): Promise<void> {
  memory = entries;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
