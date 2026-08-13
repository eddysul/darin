import type { FamilyMember } from "../types/family";
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

const STORAGE_KEY = STORAGE_KEYS.familyMembers;

let memory: FamilyMember[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

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

export async function hydrateFamilyMembers(scope: LocalDataScope | null, force = false): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetFamilyMembersMemory();
    return true;
  }
  const nextScopeId = localDataScopeId(scope);
  if (activeScopeId !== nextScopeId) {
    resetFamilyMembersMemory();
    activeScopeId = nextScopeId;
  }
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const requestedScopeId = nextScopeId;
        const result = await readScopedWithLegacyMigration({
          baseKey: STORAGE_KEY,
          scope,
          parse: (raw) => normalizeMembers(JSON.parse(raw)),
          serialize: JSON.stringify,
          merge: (scoped, legacy) => {
            const byId = new Map(legacy.map((member) => [member.id, member]));
            for (const member of scoped ?? []) byId.set(member.id, member);
            return [...byId.values()];
          },
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

export function getFamilyMembers(): FamilyMember[] | null {
  return memory;
}

export async function saveFamilyMembers(members: FamilyMember[], scope: LocalDataScope | null): Promise<void> {
  if (!isValidLocalDataScope(scope) || activeScopeId !== localDataScopeId(scope)) return;
  memory = members;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(members));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetFamilyMembersMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
