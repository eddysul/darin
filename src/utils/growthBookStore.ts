import type { GrowthBookEdit } from "../types/growthBook";
import { createEmptyGrowthBookEdit } from "../types/growthBook";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

const STORAGE_KEY = STORAGE_KEYS.growthBookEdit;

let memory: GrowthBookEdit | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

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
    pages: raw.pages && typeof raw.pages === "object" ? raw.pages : {},
    letters: Array.isArray(raw.letters) ? raw.letters : [],
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export async function hydrateGrowthBookEdit(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memory = raw ? normalizeEdit(JSON.parse(raw)) : null;
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

export async function saveGrowthBookEdit(edit: GrowthBookEdit): Promise<void> {
  memory = edit;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(edit));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function ensureGrowthBookEdit(input: {
  babyId: string;
  babyName: string;
  existing: GrowthBookEdit | null;
}): GrowthBookEdit {
  if (input.existing && input.existing.babyId === input.babyId) return input.existing;
  return createEmptyGrowthBookEdit(input);
}
