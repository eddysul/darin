import { isCustomCategoryIconKey } from "../constants/customCategoryTemplates";
import type { CustomCategory } from "../types/logCategory";
import { isCustomCategoryInputMode } from "../types/logCategory";
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

const STORAGE_KEY = STORAGE_KEYS.customCategories;

let memoryCategories: CustomCategory[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

function normalizeCategory(item: unknown): CustomCategory | null {
  if (typeof item !== "object" || item === null) return null;
  const raw = item as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.label !== "string" || typeof raw.color !== "string") {
    return null;
  }

  const legacyTemplate =
    typeof raw.templateId === "string" && isCustomCategoryIconKey(raw.templateId)
      ? raw.templateId
      : undefined;
  const iconKey =
    typeof raw.iconKey === "string" && isCustomCategoryIconKey(raw.iconKey)
      ? raw.iconKey
      : legacyTemplate;

  return {
    id: raw.id,
    label: raw.label,
    color: raw.color,
    iconKey,
    templateId: legacyTemplate ?? iconKey,
    kind: "custom",
    inputMode: isCustomCategoryInputMode(raw.inputMode) ? raw.inputMode : "memo",
    isEnabled: raw.isEnabled !== false,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    chips: Array.isArray(raw.chips) ? raw.chips.filter((c): c is string => typeof c === "string") : undefined,
    duration: typeof raw.duration === "boolean" ? raw.duration : undefined,
    amount: typeof raw.amount === "string" ? raw.amount : undefined,
  };
}

function normalizeCategories(raw: unknown): CustomCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCategory).filter((item): item is CustomCategory => item !== null);
}

export async function hydrateCustomCategories(
  scope: LocalDataScope | null,
  force = false,
): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetCustomCategoriesMemory();
    return true;
  }
  const nextScopeId = localDataScopeId(scope);
  if (activeScopeId !== nextScopeId) {
    resetCustomCategoriesMemory();
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
          parse: (raw) => normalizeCategories(JSON.parse(raw)),
          serialize: JSON.stringify,
          merge: (scoped, legacy) => {
            const byId = new Map(legacy.map((item) => [item.id, item]));
            for (const item of scoped ?? []) byId.set(item.id, item);
            return [...byId.values()];
          },
        });
        if (activeScopeId !== requestedScopeId) return false;
        memoryCategories = result.value ?? [];
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

export function getCustomCategories(): CustomCategory[] {
  return memoryCategories ?? [];
}

export async function saveCustomCategories(
  categories: CustomCategory[],
  scope: LocalDataScope | null,
): Promise<void> {
  if (!isValidLocalDataScope(scope) || activeScopeId !== localDataScopeId(scope)) return;
  memoryCategories = categories;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(categories));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetCustomCategoriesMemory(): void {
  memoryCategories = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
