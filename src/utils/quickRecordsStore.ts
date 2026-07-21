import { DEFAULT_QUICK_RECORDS } from "../constants/defaultQuickRecords";
import type { QuickRecord } from "../types/quickRecord";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";

const STORAGE_KEY = STORAGE_KEYS.quickRecords;

let memory: QuickRecord[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function isQuickRecord(item: unknown): item is QuickRecord {
  if (typeof item !== "object" || item === null) return false;
  const r = item as QuickRecord;
  return (
    typeof r.id === "string" &&
    typeof r.label === "string" &&
    typeof r.color === "string" &&
    typeof r.icon === "string" &&
    typeof r.pinned === "boolean" &&
    typeof r.isCustom === "boolean" &&
    typeof r.defaults === "object" &&
    r.defaults !== null &&
    typeof (r.defaults as QuickRecord["defaults"]).cat === "string"
  );
}

function normalize(raw: unknown): QuickRecord[] {
  if (!Array.isArray(raw)) return [...DEFAULT_QUICK_RECORDS];
  const parsed = raw.filter(isQuickRecord);
  return parsed.length ? parsed : [...DEFAULT_QUICK_RECORDS];
}

export async function hydrateQuickRecords(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memory = raw ? normalize(JSON.parse(raw)) : null;
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

export function getQuickRecords(): QuickRecord[] {
  return memory ?? [...DEFAULT_QUICK_RECORDS];
}

export async function saveQuickRecords(records: QuickRecord[]): Promise<void> {
  memory = records;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
