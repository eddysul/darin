import type { FamilyRole } from "../types/family";
import type { DbRelationshipLabel, PermissionRole } from "../types/database";
import type { RelationshipLabel } from "../types/growthBook";
import type { RelationshipToChild } from "../types/careSetup";

export function familyRoleToPermission(role: FamilyRole): PermissionRole {
  if (role === "owner" || role === "admin") return "admin";
  if (role === "viewer") return "viewer";
  return "editor";
}

export function permissionToFamilyRole(role: PermissionRole): FamilyRole {
  if (role === "admin") return "admin";
  if (role === "viewer") return "viewer";
  return "editor";
}

export function toDbRelationshipLabel(
  label: RelationshipLabel | RelationshipToChild | string | undefined,
): DbRelationshipLabel {
  const map: Record<string, DbRelationshipLabel> = {
    mom: "엄마",
    dad: "아빠",
    guardian: "보호자",
    family: "가족",
    sitter: "시터",
    엄마: "엄마",
    아빠: "아빠",
    보호자: "보호자",
    가족: "가족",
    시터: "시터",
    할머니: "할머니",
    할아버지: "할아버지",
    이모: "이모",
    삼촌: "삼촌",
    친구: "친구",
    기타: "기타",
  };
  if (!label) return "가족";
  return map[label] ?? "기타";
}

/** Combine local dateKey + HH:mm into an ISO timestamp (device-local interpreted). */
export function recordedAtFromDateKeyTime(dateKey: string, time: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return local.toISOString();
}
