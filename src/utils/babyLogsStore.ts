import type { BabyLogEntry } from "../types/babyLog";
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

const STORAGE_KEY = STORAGE_KEYS.babyLogs;

let memoryLogs: BabyLogEntry[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

function isLogEntry(item: unknown): item is BabyLogEntry {
  if (typeof item !== "object" || item === null) return false;
  const e = item as BabyLogEntry;
  return typeof e.id === "string" && typeof e.cat === "string" && typeof e.time === "string";
}

function normalizeLogs(raw: unknown): BabyLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isLogEntry);
}

export async function hydrateBabyLogs(scope: LocalDataScope | null, force = false): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetBabyLogsMemory();
    return true;
  }
  const nextScopeId = localDataScopeId(scope);
  if (activeScopeId !== nextScopeId) {
    resetBabyLogsMemory();
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
          parse: (raw) => normalizeLogs(JSON.parse(raw)).map((entry) => ({ ...entry, babyId: scope.babyId })),
          serialize: JSON.stringify,
          merge: (scoped, legacy) => {
            const byId = new Map(legacy.map((entry) => [entry.id, { ...entry, babyId: scope.babyId }]));
            for (const entry of scoped ?? []) byId.set(entry.id, entry);
            return [...byId.values()];
          },
        });
        if (activeScopeId !== requestedScopeId) return false;
        memoryLogs = result.value;
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

/** null means "never saved yet" — caller may seed */
export function getBabyLogs(): BabyLogEntry[] | null {
  return memoryLogs;
}

export async function saveBabyLogs(logs: BabyLogEntry[], scope: LocalDataScope | null): Promise<void> {
  if (!isValidLocalDataScope(scope) || activeScopeId !== localDataScopeId(scope)) return;
  memoryLogs = logs;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(logs));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetBabyLogsMemory(): void {
  memoryLogs = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
