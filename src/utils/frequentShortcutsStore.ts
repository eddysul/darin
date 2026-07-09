import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_FREQUENT_SHORTCUTS,
  normalizeFrequentShortcuts,
  type FrequentShortcutId,
} from "../constants/frequentShortcuts";

const STORAGE_KEY = "darin:frequent-shortcuts";

let memoryShortcuts: FrequentShortcutId[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export async function hydrateFrequentShortcuts(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        memoryShortcuts = raw ? normalizeFrequentShortcuts(JSON.parse(raw)) : null;
      } catch {
        memoryShortcuts = null;
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getFrequentShortcuts(): FrequentShortcutId[] {
  return memoryShortcuts ?? [...DEFAULT_FREQUENT_SHORTCUTS];
}

export async function saveFrequentShortcuts(shortcuts: FrequentShortcutId[]): Promise<void> {
  memoryShortcuts = normalizeFrequentShortcuts(shortcuts);
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryShortcuts));
  } catch {
    // ignore persistence errors
  }
}
