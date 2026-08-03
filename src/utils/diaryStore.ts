import type { DiaryEntry } from "../types/babyLog";
import { migrateDiaryEntry } from "./diaryModel";
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

const STORAGE_KEY = STORAGE_KEYS.diary;

let memory: DiaryEntry[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

function parseEntries(raw: string, scope: LocalDataScope): DiaryEntry[] | null {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return null;
  return parsed
    .map((item) => migrateDiaryEntry(item, scope.babyId))
    .filter((entry): entry is DiaryEntry => !!entry)
    .map((entry) => ({ ...entry, babyId: scope.babyId }));
}

function mergeEntries(scoped: DiaryEntry[] | null, legacy: DiaryEntry[]): DiaryEntry[] {
  const byId = new Map<string, DiaryEntry>();
  for (const entry of legacy) byId.set(entry.id, entry);
  for (const entry of scoped ?? []) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function hydrateDiaryEntries(
  scope: LocalDataScope | null,
  force = false,
): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetDiaryEntriesMemory();
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
          parse: (raw) => parseEntries(raw, scope),
          serialize: JSON.stringify,
          merge: mergeEntries,
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

export function getDiaryEntries(): DiaryEntry[] | null {
  return memory;
}

export async function saveDiaryEntries(
  entries: DiaryEntry[],
  scope: LocalDataScope | null,
): Promise<void> {
  if (!isValidLocalDataScope(scope)) return;
  const scopeId = localDataScopeId(scope);
  if (activeScopeId !== scopeId) return;
  memory = entries;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(entries));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetDiaryEntriesMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
