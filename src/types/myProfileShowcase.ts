import type { FamilyRole } from "./family";

export type MyProfileBabyItem = {
  id: string;
  name: string;
  ageLabel: string;
  role: FamilyRole;
  avatarUrl?: string;
};

export type MyProfileStatKey = "baby" | "family" | "friend";
