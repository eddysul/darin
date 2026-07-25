import type { AppSettings } from "../types/appSettings";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "../types/appSettings";
import { qaStorage } from "./qaStorage";
import { reportStorageIssue } from "./storageIssues";
import { STORAGE_KEYS } from "./storageKeys";

const STORAGE_KEY = STORAGE_KEYS.appSettings;

let memory: AppSettings = normalizeAppSettings(DEFAULT_APP_SETTINGS);
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

export function getAppSettings(): AppSettings {
  return memory;
}

export async function hydrateAppSettings(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memory = normalizeAppSettings(raw ? (JSON.parse(raw) as Partial<AppSettings>) : null);
        hydrated = true;
        return true;
      } catch {
        memory = normalizeAppSettings(DEFAULT_APP_SETTINGS);
        hydrated = true;
        reportStorageIssue("load", STORAGE_KEY);
        return false;
      }
    })();
  }
  return hydratePromise;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  memory = normalizeAppSettings(settings);
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export async function resetAppSettings(): Promise<void> {
  memory = normalizeAppSettings(DEFAULT_APP_SETTINGS);
  hydrated = true;
  try {
    await qaStorage.removeItem(STORAGE_KEY);
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
