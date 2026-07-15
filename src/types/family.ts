import type { BabyLogActor } from "./babyLog";

export type FamilyRole = "owner" | "admin" | "editor" | "viewer" | "caregiver";

export type FamilyMemberStatus = "active" | "pending";

export type FamilyMember = {
  id: string;
  name: string;
  emoji?: string;
  role: FamilyRole;
  /** Phone or email for invite prototype */
  contact?: string;
  inviteLink?: string;
  status: FamilyMemberStatus;
  isMe?: boolean;
};

export const FAMILY_ROLE_LABELS: Record<FamilyRole, string> = {
  owner: "소유자",
  admin: "관리자",
  editor: "기록 가능",
  viewer: "보기만",
  caregiver: "케어기버",
};

export function canInvite(role: FamilyRole): boolean {
  return role === "owner" || role === "admin";
}

export function canAddLog(role: FamilyRole): boolean {
  return role === "owner" || role === "admin" || role === "editor" || role === "caregiver";
}

export function canEditLog(role: FamilyRole, entryCreatedBy?: BabyLogActor, me?: FamilyMember): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "viewer") return false;
  if (role === "editor" || role === "caregiver") {
    if (!me || !entryCreatedBy) return role === "editor";
    return entryCreatedBy.userId === me.id;
  }
  return false;
}

export function canDeleteLog(role: FamilyRole, entryCreatedBy?: BabyLogActor, me?: FamilyMember): boolean {
  return canEditLog(role, entryCreatedBy, me);
}

export function familyRoleToActorRole(role: FamilyRole): BabyLogActor["role"] {
  return role;
}
