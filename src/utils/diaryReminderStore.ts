import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_DIARY_REMINDER, type DiaryReminderSettings } from "../types/diaryReminder";
import { STORAGE_KEYS } from "./storageKeys";

const KEY = STORAGE_KEYS.diaryReminder;

let memory: DiaryReminderSettings = { ...DEFAULT_DIARY_REMINDER };
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function isSettings(item: unknown): item is DiaryReminderSettings {
  if (typeof item !== "object" || item === null) return false;
  const s = item as DiaryReminderSettings;
  return typeof s.enabled === "boolean" && typeof s.hour === "number" && typeof s.minute === "number";
}

export async function hydrateDiaryReminder(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : null;
        memory = isSettings(parsed) ? { ...DEFAULT_DIARY_REMINDER, ...parsed } : { ...DEFAULT_DIARY_REMINDER };
      } catch {
        memory = { ...DEFAULT_DIARY_REMINDER };
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getDiaryReminder(): DiaryReminderSettings {
  return memory;
}

export async function saveDiaryReminder(settings: DiaryReminderSettings): Promise<void> {
  memory = settings;
  hydrated = true;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function formatReminderTime(hour: number, minute: number): string {
  const h = hour % 24;
  const m = minute % 60;
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `매일 ${period} ${h12}시${m === 0 ? "" : ` ${String(m).padStart(2, "0")}분`}`;
}
