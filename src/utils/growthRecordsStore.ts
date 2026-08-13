import type { GrowthRecord } from "../types/growthRecord";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import {
  isValidLocalDataScope,
  localDataScopeId,
  readScopedWithLegacyMigration,
  scopedStorageKey,
  type LocalDataScope,
} from "./scopedLocalStorage";

const STORAGE_KEY = STORAGE_KEYS.growthRecords;

let memory: GrowthRecord[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

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

export async function hydrateGrowthRecords(scope: LocalDataScope | null, force = false): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetGrowthRecordsMemory();
    return true;
  }
  const nextScopeId = localDataScopeId(scope);
  if (activeScopeId !== nextScopeId) {
    resetGrowthRecordsMemory();
    activeScopeId = nextScopeId;
  }
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const requestedScopeId = nextScopeId;
        const result = await readScopedWithLegacyMigration({
          baseKey: STORAGE_KEY,
          scope,
          parse: (raw) => normalize(JSON.parse(raw)).map((record) => ({ ...record, babyId: scope.babyId })),
          serialize: JSON.stringify,
          merge: (scoped, legacy) => {
            const byId = new Map(legacy.map((record) => [record.id, { ...record, babyId: scope.babyId }]));
            for (const record of scoped ?? []) byId.set(record.id, record);
            return [...byId.values()];
          },
        });
        if (activeScopeId !== requestedScopeId) return false;
        memory = result.value;
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

export async function saveGrowthRecords(records: GrowthRecord[], scope: LocalDataScope | null): Promise<void> {
  if (!isValidLocalDataScope(scope) || activeScopeId !== localDataScopeId(scope)) return;
  memory = records;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(records));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetGrowthRecordsMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
