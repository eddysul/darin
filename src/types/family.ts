import type { BabyLogActor } from "./babyLog";

export type FamilyRole = "owner" | "admin" | "editor" | "viewer" | "caregiver";

export type FamilyMemberStatus = "active" | "pending" | "inactive";

export type FamilyMember = {
  id: string;
  name: string;
  emoji?: string;
  role: FamilyRole;
  /** Phone or email for invite prototype */
  contact?: string;
  inviteLink?: string;
  /** Short mock invite code */
  inviteCode?: string;
  status: FamilyMemberStatus;
  isMe?: boolean;
};

export const FAMILY_ROLE_LABELS: Record<FamilyRole, string> = {
  owner: "소유자",
  admin: "관리자",
  editor: "편집 가능",
  viewer: "보기만 가능",
  caregiver: "편집 가능",
};

export const FAMILY_STATUS_LABELS: Record<FamilyMemberStatus, string> = {
  pending: "초대 대기",
  active: "공유 중",
  inactive: "비활성",
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
    if (!me || !entryCreatedBy) return false;
    return entryCreatedBy.userId === me.id;
  }
  return false;
}

export function canDeleteLog(role: FamilyRole, entryCreatedBy?: BabyLogActor, me?: FamilyMember): boolean {
  return canEditLog(role, entryCreatedBy, me);
}

export function canManageMembers(role: FamilyRole): boolean {
  return role === "owner" || role === "admin";
}
