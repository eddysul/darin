import type { CareSetup } from "../types/careSetup";
import { DEMO_CARE_SETUP } from "../types/careSetup";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import { qaStorage } from "./qaStorage";

const STORAGE_KEY = STORAGE_KEYS.careSetup;

let memorySetup: CareSetup | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export async function hydrateCareSetup(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memorySetup = raw ? (JSON.parse(raw) as CareSetup) : null;
      } catch {
        memorySetup = null;
        reportStorageIssue("load", STORAGE_KEY);
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function loadCareSetup(): CareSetup | null {
  return memorySetup;
}

export function getEffectiveCareSetup(): CareSetup {
  return memorySetup ?? DEMO_CARE_SETUP;
}

export async function saveCareSetup(setup: CareSetup): Promise<void> {
  memorySetup = setup;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

/** Clear persisted parent setup so the next launch returns to login. */
export async function clearCareSetup(): Promise<void> {
  memorySetup = null;
  hydrated = true;
  try {
    await qaStorage.removeItem(STORAGE_KEY);
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
