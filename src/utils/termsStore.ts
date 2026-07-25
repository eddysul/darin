import { STORAGE_KEYS } from "./storageKeys";
import { qaStorage } from "./qaStorage";
import { reportStorageIssue } from "./storageIssues";

const KEY = STORAGE_KEYS.termsAccepted;

let memory: boolean | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export async function hydrateTermsAccepted(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(KEY);
        memory = raw === "1";
      } catch {
        memory = false;
        reportStorageIssue("load", KEY);
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getTermsAccepted(): boolean {
  return memory === true;
}

export async function saveTermsAccepted(accepted: boolean): Promise<void> {
  memory = accepted;
  hydrated = true;
  try {
    if (accepted) await qaStorage.setItem(KEY, "1");
    else await qaStorage.removeItem(KEY);
  } catch {
    reportStorageIssue("save", KEY);
  }
}
