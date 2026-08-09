import type { DbRelationshipLabel, PermissionRole } from "./database";
import type { RelationshipLabel } from "./growthBook";

export const PROFILE_RELATION_OPTIONS: RelationshipLabel[] = [
  "엄마",
  "아빠",
  "보호자",
  "할머니",
  "할아버지",
  "이모",
  "삼촌",
  "시터",
  "친구",
  "가족",
  "기타",
];

export type DisplayProfile = {
  userId: string;
  displayName: string;
  nickname?: string;
  avatarStoragePath?: string;
  avatarUrl?: string;
  defaultRelation?: string;
};

export type BabyProfile = {
  id: string;
  name: string;
  nickname?: string;
  birthDate?: string;
  gender?: string;
  note?: string;
  avatarStoragePath?: string;
  avatarUrl?: string;
  photoUrl?: string;
};

export type UpdateMyProfileInput = {
  displayName: string;
  nickname?: string | null;
  defaultRelation?: RelationshipLabel | DbRelationshipLabel | null;
  preferredLanguage?: string;
  residenceCountry?: string | null;
  guardianBirthDate?: string | null;
  clearAvatar?: boolean;
};

export type UpdateBabyProfileInput = {
  babyId: string;
  name: string;
  nickname?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  note?: string | null;
  clearAvatar?: boolean;
};

export type UploadAvatarInput = {
  uri: string;
  mimeType?: string;
  fileSize?: number;
};

export type FamilyMemberDisplay = {
  membershipId: string;
  userId: string;
  displayName: string;
  realName?: string;
  nickname?: string;
  relation: RelationshipLabel;
  role: PermissionRole;
  status: "pending" | "active" | "inactive";
  isMe: boolean;
  avatarUrl?: string;
  avatarStoragePath?: string;
  kind: "family";
};

export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;
