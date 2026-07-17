import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_QUICK_RECORDS } from "../constants/defaultQuickRecords";
import type { QuickRecord } from "../types/quickRecord";
import { STORAGE_KEYS } from "./storageKeys";

const STORAGE_KEY = STORAGE_KEYS.quickRecords;

let memory: QuickRecord[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function isQuickRecord(item: unknown): item is QuickRecord {
  if (typeof item !== "object" || item === null) return false;
  const r = item as QuickRecord;
  return (
    typeof r.id === "string" &&
    typeof r.label === "string" &&
    typeof r.color === "string" &&
    typeof r.icon === "string" &&
    typeof r.pinned === "boolean" &&
    typeof r.isCustom === "boolean" &&
    typeof r.defaults === "object" &&
    r.defaults !== null &&
    typeof (r.defaults as QuickRecord["defaults"]).cat === "string"
  );
}

function normalize(raw: unknown): QuickRecord[] {
  if (!Array.isArray(raw)) return [...DEFAULT_QUICK_RECORDS];
  const parsed = raw.filter(isQuickRecord);
  return parsed.length ? parsed : [...DEFAULT_QUICK_RECORDS];
}

export async function hydrateQuickRecords(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        memory = raw ? normalize(JSON.parse(raw)) : null;
      } catch {
        memory = null;
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getQuickRecords(): QuickRecord[] {
  return memory ?? [...DEFAULT_QUICK_RECORDS];
}

export async function saveQuickRecords(records: QuickRecord[]): Promise<void> {
  memory = records;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}
