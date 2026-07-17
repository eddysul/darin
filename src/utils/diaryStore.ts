import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DiaryEntry } from "../types/babyLog";
import { migrateDiaryEntry } from "./diaryModel";
import { STORAGE_KEYS } from "./storageKeys";

const STORAGE_KEY = STORAGE_KEYS.diary;

let memory: DiaryEntry[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export async function hydrateDiaryEntries(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          memory = null;
        } else {
          const parsed = JSON.parse(raw) as unknown[];
          memory = Array.isArray(parsed)
            ? parsed.map((item) => migrateDiaryEntry(item)).filter((d): d is DiaryEntry => !!d)
            : null;
        }
      } catch {
        memory = null;
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getDiaryEntries(): DiaryEntry[] | null {
  return memory;
}

export async function saveDiaryEntries(entries: DiaryEntry[]): Promise<void> {
  memory = entries;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}
