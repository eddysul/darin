import type { LogCategoryKey } from "../types/logCategory";
import type { CareLogHistoryCoverage } from "./careLogHistory";
import { qaStorage } from "./qaStorage";
import { scopedStorageKey, type LocalDataScope } from "./scopedLocalStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

export type CareLogCacheMetadata = {
  coverage: CareLogHistoryCoverage | null;
  categoryCoverage: LogCategoryKey[];
  migrationCandidateCount: number;
  verifiedAt: string | null;
};

const EMPTY: CareLogCacheMetadata = {
  coverage: null,
  categoryCoverage: [],
  migrationCandidateCount: 0,
  verifiedAt: null,
};

function normalizeCoverage(value: unknown): CareLogHistoryCoverage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CareLogHistoryCoverage>;
  if (candidate.kind === "full") return { kind: "full" };
  if (
    candidate.kind === "range"
    && typeof candidate.fromDateKey === "string"
    && typeof candidate.toDateKey === "string"
  ) {
    return {
      kind: "range",
      fromDateKey: candidate.fromDateKey,
      toDateKey: candidate.toDateKey,
    };
  }
  return null;
}

function normalize(raw: unknown): CareLogCacheMetadata {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const candidate = raw as Partial<CareLogCacheMetadata>;
  return {
    coverage: normalizeCoverage(candidate.coverage),
    categoryCoverage: Array.isArray(candidate.categoryCoverage)
      ? [...new Set(candidate.categoryCoverage.filter((item): item is LogCategoryKey => typeof item === "string"))]
      : [],
    migrationCandidateCount: typeof candidate.migrationCandidateCount === "number"
      ? Math.max(0, Math.floor(candidate.migrationCandidateCount))
      : 0,
    verifiedAt: typeof candidate.verifiedAt === "string" ? candidate.verifiedAt : null,
  };
}

let memory: CareLogCacheMetadata = { ...EMPTY };
let activeScopeKey: string | null = null;

export async function hydrateCareLogCacheMetadata(scope: LocalDataScope | null): Promise<boolean> {
  if (!scope) {
    resetCareLogCacheMetadataMemory();
    return true;
  }
  const key = scopedStorageKey(STORAGE_KEYS.careLogCacheMetadata, scope);
  activeScopeKey = key;
  try {
    const raw = await qaStorage.getItem(key);
    if (activeScopeKey !== key) return false;
    memory = raw ? normalize(JSON.parse(raw)) : { ...EMPTY };
    return true;
  } catch {
    reportStorageIssue("load", STORAGE_KEYS.careLogCacheMetadata);
    if (activeScopeKey === key) memory = { ...EMPTY };
    return false;
  }
}

export function getCareLogCacheMetadata(): CareLogCacheMetadata {
  return {
    ...memory,
    categoryCoverage: [...memory.categoryCoverage],
  };
}

export async function saveCareLogCacheMetadata(
  scope: LocalDataScope | null,
  metadata: CareLogCacheMetadata,
): Promise<void> {
  if (!scope) return;
  const key = scopedStorageKey(STORAGE_KEYS.careLogCacheMetadata, scope);
  if (activeScopeKey !== key) return;
  memory = normalize(metadata);
  try {
    await qaStorage.setItem(key, JSON.stringify(memory));
  } catch {
    reportStorageIssue("save", STORAGE_KEYS.careLogCacheMetadata);
  }
}

export async function clearCareLogCacheMetadata(scope: LocalDataScope | null): Promise<void> {
  if (!scope) return;
  const key = scopedStorageKey(STORAGE_KEYS.careLogCacheMetadata, scope);
  if (activeScopeKey === key) memory = { ...EMPTY };
  try {
    await qaStorage.removeItem(key);
  } catch {
    reportStorageIssue("save", STORAGE_KEYS.careLogCacheMetadata);
  }
}

export function resetCareLogCacheMetadataMemory(): void {
  memory = { ...EMPTY };
  activeScopeKey = null;
}
