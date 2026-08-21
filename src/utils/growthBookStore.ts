import type { GrowthBookEdit } from "../types/growthBook";
import { createEmptyGrowthBookEdit } from "../types/growthBook";
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

const STORAGE_KEY = STORAGE_KEYS.growthBookEdit;

let memory: GrowthBookEdit | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

function isEdit(raw: unknown): raw is GrowthBookEdit {
  if (typeof raw !== "object" || raw === null) return false;
  const e = raw as GrowthBookEdit;
  return typeof e.id === "string" && typeof e.babyId === "string" && typeof e.coverTitle === "string";
}

function normalizeEdit(raw: unknown): GrowthBookEdit | null {
  if (!isEdit(raw)) return null;
  return {
    ...raw,
    coverPhotoUri: raw.coverPhotoUri ?? null,
    coverTemplateId: raw.coverTemplateId,
    pageTemplateId: raw.pageTemplateId,
    letterTemplateId: raw.letterTemplateId,
    pages: raw.pages && typeof raw.pages === "object" ? raw.pages : {},
    letters: Array.isArray(raw.letters) ? raw.letters : [],
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function parseEdit(raw: string, scope: LocalDataScope): GrowthBookEdit | null {
  const edit = normalizeEdit(JSON.parse(raw));
  return edit ? { ...edit, babyId: scope.babyId } : null;
}

function mergeEdit(scoped: GrowthBookEdit | null, legacy: GrowthBookEdit): GrowthBookEdit {
  if (!scoped) return legacy;
  const lettersById = new Map(legacy.letters.map((letter) => [letter.id, letter]));
  for (const letter of scoped.letters) lettersById.set(letter.id, letter);
  return {
    ...legacy,
    ...scoped,
    pages: { ...legacy.pages, ...scoped.pages },
    letters: [...lettersById.values()],
    updatedAt: scoped.updatedAt > legacy.updatedAt ? scoped.updatedAt : legacy.updatedAt,
  };
}

export async function hydrateGrowthBookEdit(
  scope: LocalDataScope | null,
  force = false,
): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetGrowthBookEditMemory();
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
          parse: (raw) => parseEdit(raw, scope),
          serialize: JSON.stringify,
          merge: mergeEdit,
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

export function getGrowthBookEdit(): GrowthBookEdit | null {
  return memory;
}

export async function saveGrowthBookEdit(
  edit: GrowthBookEdit,
  scope: LocalDataScope | null,
): Promise<void> {
  if (!isValidLocalDataScope(scope)) return;
  const scopeId = localDataScopeId(scope);
  if (activeScopeId !== scopeId) return;
  memory = edit;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(edit));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetGrowthBookEditMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}

export function ensureGrowthBookEdit(input: {
  babyId: string;
  babyName: string;
  existing: GrowthBookEdit | null;
}): GrowthBookEdit {
  if (input.existing && input.existing.babyId === input.babyId) {
    const coverTitle = input.existing.coverTitle.trim();
    if (!coverTitle || coverTitle === "의 성장책") {
      return { ...input.existing, coverTitle: `${input.babyName}의 성장책` };
    }
    return input.existing;
  }
  return createEmptyGrowthBookEdit(input);
}
