import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CareSetup } from "../types/careSetup";
import { DEMO_CARE_SETUP } from "../types/careSetup";

const STORAGE_KEY = "darin:care-setup";

let memorySetup: CareSetup | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export async function hydrateCareSetup(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        memorySetup = raw ? (JSON.parse(raw) as CareSetup) : null;
      } catch {
        memorySetup = null;
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
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    // ignore persistence errors
  }
}
