import { DEFAULT_DIARY_REMINDER, type DiaryReminderSettings } from "../types/diaryReminder";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";

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
        const raw = await qaStorage.getItem(KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : null;
        memory = isSettings(parsed)
          ? { ...DEFAULT_DIARY_REMINDER, ...parsed, repeat: parsed.repeat ?? "daily" }
          : { ...DEFAULT_DIARY_REMINDER };
      } catch {
        memory = { ...DEFAULT_DIARY_REMINDER };
        reportStorageIssue("load", KEY);
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
    await qaStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    reportStorageIssue("save", KEY);
  }
}

function periodWord(hour: number): string {
  if (hour >= 5 && hour < 12) return "오전";
  if (hour >= 12 && hour < 17) return "오후";
  if (hour >= 17 && hour < 21) return "저녁";
  return "밤";
}

function clockHm(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute % 60).padStart(2, "0")}`;
}

/** e.g. "매일 밤 10:00" */
export function formatReminderTime(hour: number, minute: number): string {
  return `매일 ${periodWord(hour % 24)} ${clockHm(hour % 24, minute)}`;
}

/** e.g. "오늘 밤 10:00" / "내일 밤 10:00" */
export function formatNextReminderLabel(hour: number, minute: number, now = new Date()): string {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  const dayLabel = next.getTime() > now.getTime() ? "오늘" : "내일";
  return `${dayLabel} ${periodWord(hour)} ${clockHm(hour, minute)}`;
}

export function matchesReminderPreset(hour: number, minute: number): string | "custom" {
  if (hour === 20 && minute === 0) return "20";
  if (hour === 21 && minute === 0) return "21";
  if (hour === 22 && minute === 0) return "22";
  return "custom";
}
