import type { GrowthRecord } from "../types/growthRecord";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

const STORAGE_KEY = STORAGE_KEYS.growthRecords;

let memory: GrowthRecord[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function isGrowthRecord(value: unknown): value is GrowthRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as GrowthRecord;
  return (
    typeof record.id === "string" &&
    typeof record.babyId === "string" &&
    typeof record.measuredAt === "string" &&
    (record.source === "hospital" || record.source === "home")
  );
}

function normalize(raw: unknown): GrowthRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isGrowthRecord).map((record) => {
    const legacy = record as GrowthRecord & {
      weightValue?: number;
      heightValue?: number;
      headCircumferenceValue?: number;
    };
    return {
      ...record,
      weightKg: record.weightKg ?? legacy.weightValue,
      heightCm: record.heightCm ?? legacy.heightValue,
      headCircumferenceCm: record.headCircumferenceCm ?? legacy.headCircumferenceValue,
      weightUnit: record.weightUnit ?? "kg",
      heightUnit: record.heightUnit ?? "cm",
      headCircumferenceUnit: record.headCircumferenceUnit ?? "cm",
      inputMethod: record.inputMethod ?? "manual",
      userConfirmed: record.userConfirmed ?? true,
    };
  });
}

export async function hydrateGrowthRecords(force = false): Promise<boolean> {
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

export function getGrowthRecords(): GrowthRecord[] | null {
  return memory;
}

export async function saveGrowthRecords(records: GrowthRecord[]): Promise<void> {
  memory = records;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
