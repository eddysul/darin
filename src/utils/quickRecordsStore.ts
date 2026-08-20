import { ALL_DEFAULT_QUICK_RECORDS, DEFAULT_PREGNANCY_QUICK_RECORDS } from "../constants/defaultQuickRecords";
import type { QuickRecord } from "../types/quickRecord";
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

const STORAGE_KEY = STORAGE_KEYS.quickRecords;

let memory: QuickRecord[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

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

function withPregnancySeeds(records: QuickRecord[]): QuickRecord[] {
  const ids = new Set(records.map((record) => record.id));
  const missing = DEFAULT_PREGNANCY_QUICK_RECORDS.filter((record) => !ids.has(record.id));
  return missing.length ? [...records, ...missing] : records;
}

function normalize(raw: unknown): QuickRecord[] {
  if (!Array.isArray(raw)) return [...ALL_DEFAULT_QUICK_RECORDS];
  const parsed = raw.filter(isQuickRecord).map((record) =>
    record.id === "qr-diaper" && record.defaults.cat === "diaper" && !record.defaults.chip
      ? {
          ...record,
          id: "qr-diaper-pee",
          label: "기저귀 소변",
          defaults: { ...record.defaults, chip: "소변" },
        }
      : record,
  );
  return parsed.length ? withPregnancySeeds(parsed) : [...ALL_DEFAULT_QUICK_RECORDS];
}

function parseRecords(raw: string): QuickRecord[] {
  return normalize(JSON.parse(raw));
}

function mergeRecords(scoped: QuickRecord[] | null, legacy: QuickRecord[]): QuickRecord[] {
  if (scoped && scoped.length > 0) return scoped;
  return legacy;
}

export async function hydrateQuickRecords(
  scope: LocalDataScope | null,
  force = false,
): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetQuickRecordsMemory();
    return true;
  }
  const nextScopeId = localDataScopeId(scope);
  if (activeScopeId !== nextScopeId) {
    memory = null;
    hydrated = false;
    hydratePromise = null;
    activeScopeId = nextScopeId;
  }
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    const requestedScopeId = nextScopeId;
    hydratePromise = (async () => {
      try {
        const result = await readScopedWithLegacyMigration({
          baseKey: STORAGE_KEY,
          scope,
          parse: parseRecords,
          serialize: JSON.stringify,
          merge: mergeRecords,
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

export function getQuickRecords(): QuickRecord[] {
  return memory ?? [...ALL_DEFAULT_QUICK_RECORDS];
}

export async function saveQuickRecords(
  records: QuickRecord[],
  scope: LocalDataScope | null,
): Promise<void> {
  if (!isValidLocalDataScope(scope)) return;
  const scopeId = localDataScopeId(scope);
  if (activeScopeId !== scopeId) return;
  memory = records;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(records));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetQuickRecordsMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
