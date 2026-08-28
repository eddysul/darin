import type { FamilyRole } from "../types/family";
import {
  isValidLocalDataScope,
  localDataScopeId,
  type LocalDataScope,
} from "../utils/scopedLocalStorage";

export function migrateActorRole(role: string): FamilyRole {
  if (role === "parent" || role === "other") return "owner";
  if (role === "owner" || role === "admin" || role === "editor" || role === "viewer" || role === "caregiver") {
    return role;
  }
  return "editor";
}

export function sameLocalDataScope(left: LocalDataScope | null, right: LocalDataScope): boolean {
  return isValidLocalDataScope(left) && localDataScopeId(left) === localDataScopeId(right);
}
