import type { FamilyMember } from "../types/family";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

const STORAGE_KEY = STORAGE_KEYS.familyMembers;

let memory: FamilyMember[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function isMember(item: unknown): item is FamilyMember {
  if (typeof item !== "object" || item === null) return false;
  const m = item as FamilyMember;
  return typeof m.id === "string" && typeof m.name === "string" && typeof m.role === "string";
}

function normalizeMembers(raw: unknown): FamilyMember[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isMember).map((m) => ({
    ...m,
    status: m.status === "pending" || m.status === "inactive" ? m.status : "active",
    relationshipLabel: m.relationshipLabel ?? inferRelationship(m),
  }));
}

function inferRelationship(m: FamilyMember): FamilyMember["relationshipLabel"] {
  if (m.relationshipLabel) return m.relationshipLabel;
  if (m.role === "caregiver") return "시터";
  if (m.isMe) return "엄마";
  return "가족";
}

export async function hydrateFamilyMembers(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memory = raw ? normalizeMembers(JSON.parse(raw)) : null;
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

export function getFamilyMembers(): FamilyMember[] | null {
  return memory;
}

export async function saveFamilyMembers(members: FamilyMember[]): Promise<void> {
  memory = members;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
