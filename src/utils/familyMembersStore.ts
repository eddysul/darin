import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FamilyMember } from "../types/family";
import { STORAGE_KEYS } from "./storageKeys";

const STORAGE_KEY = STORAGE_KEYS.familyMembers;

let memory: FamilyMember[] | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function isMember(item: unknown): item is FamilyMember {
  if (typeof item !== "object" || item === null) return false;
  const m = item as FamilyMember;
  return typeof m.id === "string" && typeof m.name === "string" && typeof m.role === "string";
}

export async function hydrateFamilyMembers(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        memory = raw ? (JSON.parse(raw) as unknown[]).filter(isMember) : null;
      } catch {
        memory = null;
      }
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export function getFamilyMembers(): FamilyMember[] | null {
  return memory;
}

export async function saveFamilyMembers(members: FamilyMember[]): Promise<void> {
  memory = members;
  hydrated = true;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  } catch {
    // ignore
  }
}
