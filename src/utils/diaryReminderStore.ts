import { DEFAULT_DIARY_REMINDER, type DiaryReminderSettings } from "../types/diaryReminder";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";
import {
  isValidLocalDataScope,
  localDataScopeId,
  readScopedWithLegacyMigration,
  scopedStorageKey,
  type LocalDataScope,
} from "./scopedLocalStorage";

const KEY = STORAGE_KEYS.diaryReminder;

let memory: DiaryReminderSettings = { ...DEFAULT_DIARY_REMINDER };
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let activeScopeId: string | null = null;

function isSettings(item: unknown): item is DiaryReminderSettings {
  if (typeof item !== "object" || item === null) return false;
  const s = item as DiaryReminderSettings;
  return typeof s.enabled === "boolean" && typeof s.hour === "number" && typeof s.minute === "number";
}

export async function hydrateDiaryReminder(scope: LocalDataScope | null): Promise<void> {
  if (!isValidLocalDataScope(scope)) {
    memory = { ...DEFAULT_DIARY_REMINDER };
    hydrated = true;
    hydratePromise = null;
    activeScopeId = null;
    return;
  }
  const scopeId = localDataScopeId(scope);
  if (activeScopeId !== scopeId) { hydrated = false; hydratePromise = null; memory = { ...DEFAULT_DIARY_REMINDER }; activeScopeId = scopeId; }
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const requestedScopeId = scopeId;
        const result = await readScopedWithLegacyMigration({
          baseKey: KEY,
          scope,
          parse: (raw) => {
            const parsed = JSON.parse(raw) as unknown;
            return isSettings(parsed) ? parsed : null;
          },
          serialize: JSON.stringify,
          merge: (scoped, legacy) => scoped ?? legacy,
        });
        if (activeScopeId !== requestedScopeId) return;
        memory = result.value
          ? { ...DEFAULT_DIARY_REMINDER, ...result.value, repeat: result.value.repeat ?? "daily" }
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

export async function saveDiaryReminder(settings: DiaryReminderSettings, scope: LocalDataScope | null): Promise<void> {
  if (!isValidLocalDataScope(scope) || activeScopeId !== localDataScopeId(scope)) return;
  memory = settings;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(KEY, scope), JSON.stringify(settings));
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
  if (hour === 20 && minute === 30) return "20:30";
  if (hour === 21 && minute === 0) return "21";
  return "custom";
}
