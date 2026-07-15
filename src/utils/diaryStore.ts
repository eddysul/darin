import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DiaryEntry } from "../types/babyLog";
import { STORAGE_KEYS } from "./storageKeys";

const STORAGE_KEY = STORAGE_KEYS.diary;

let memory: DiaryEntry[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function isDiary(item: unknown): item is DiaryEntry {
  if (typeof item !== "object" || item === null) return false;
  const d = item as DiaryEntry;
  return typeof d.id === "string" && typeof d.date === "string" && typeof d.comment === "string";
}

export async function hydrateDiaryEntries(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        memory = raw ? (JSON.parse(raw) as unknown[]).filter(isDiary) : null;
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
