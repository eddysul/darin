import type { BabyLogActor } from "./babyLog";
import type { RelationshipLabel } from "./growthBook";

export type FamilyRole = "owner" | "admin" | "editor" | "viewer" | "caregiver";

export type FamilyMemberStatus = "active" | "pending" | "inactive";

export type FamilyMember = {
  id: string;
  /** Primary app nickname from profiles.display_name. */
  name: string;
  /** Confirmed name from the legacy profiles.nickname column. */
  realName?: string;
  emoji?: string;
  /** Signed URL for profile avatar when available (short-lived). */
  avatarUrl?: string;
  /** App permission (관리자 / 기록 가능 / 보기만 가능). */
  role: FamilyRole;
  /** User-facing relationship (엄마 / 아빠 / 시터…). Independent of `role`. */
  relationshipLabel?: RelationshipLabel;
  /** Legacy contact metadata retained for stored family-member compatibility. */
  contact?: string;
  status: FamilyMemberStatus;
  isMe?: boolean;
};

export const FAMILY_ROLE_LABELS: Record<FamilyRole, string> = {
  owner: "소유자",
  admin: "관리자",
  editor: "기록 가능",
  viewer: "보기만 가능",
  caregiver: "기록 가능",
};

export const FAMILY_STATUS_LABELS: Record<FamilyMemberStatus, string> = {
  pending: "초대 대기",
  active: "공유 중",
  inactive: "비활성",
};

export function memberRelationshipLabel(member: FamilyMember): RelationshipLabel {
  return member.relationshipLabel ?? "가족";
}

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

/** Growth book rolling comments / letters — write access. */
export function canWriteGrowthBookNote(role: FamilyRole): boolean {
  return role === "owner" || role === "admin" || role === "editor" || role === "caregiver";
}

export function canEditOwnGrowthBookNote(
  role: FamilyRole,
  authorId: string,
  me?: FamilyMember,
): boolean {
  if (!me) return false;
  if (authorId === me.id) return canWriteGrowthBookNote(role);
  return false;
}

export function canDeleteGrowthBookNote(
  role: FamilyRole,
  authorId: string,
  me?: FamilyMember,
): boolean {
  if (role === "owner" || role === "admin") return true;
  return canEditOwnGrowthBookNote(role, authorId, me);
}
