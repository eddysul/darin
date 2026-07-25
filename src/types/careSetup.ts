import type { RelationshipLabel } from "./growthBook";

export type RelationshipToChild = "mom" | "dad" | "guardian" | "family" | "sitter";
export type PostpartumStatus = "pregnant" | "expecting" | "postpartum" | "not_applicable";
export type PreferredLanguage = "ko" | "en";
export type ChildStatus = "unborn" | "newborn" | "infant";
export type ChildGender = "girl" | "boy" | "unknown";
export type DefaultFeedingMethod =
  | "breastfeeding"
  | "formula"
  | "mixed"
  | "pumped_milk"
  | "not_sure";
export type LogCategoryGroup =
  | "feeding"
  | "sleep"
  | "diaper"
  | "medication"
  | "health"
  | "mood"
  | "note";

export type ParentProfile = {
  parentName: string;
  relationshipToChild: RelationshipToChild;
  postpartumStatus: PostpartumStatus;
  birthRecoveryNote?: string;
  preferredLanguage: PreferredLanguage;
};

export type ChildProfile = {
  childName: string;
  birthDate?: string;
  dueDate?: string;
  childStatus: ChildStatus;
  gender?: ChildGender;
  photoUri?: string;
  gestationalAgeWeeks?: number;
  birthWeight?: string;
  specialNotes?: string;
};

export type CarePreferences = {
  defaultFeedingMethod: DefaultFeedingMethod;
  enabledLogCategories: LogCategoryGroup[];
  familySharingEnabled: boolean;
};

export type CareSetup = {
  parent: ParentProfile;
  child: ChildProfile;
  preferences: CarePreferences;
};

/** Canonical event shape for daily care timeline (profile fields stay separate). */
export type CareLogEvent = {
  id: string;
  type: LogCategoryGroup;
  startedAt: string;
  endedAt?: string;
  note?: string;
  feedingType?: "breastfeeding" | "formula" | "pumped_milk" | "mixed";
  amountMl?: number;
  durationMin?: number;
};

export const ALL_LOG_CATEGORY_GROUPS: LogCategoryGroup[] = [
  "feeding",
  "sleep",
  "diaper",
  "medication",
  "health",
  "mood",
  "note",
];

export const RELATIONSHIP_OPTIONS: Array<{ value: RelationshipToChild; label: string }> = [
  { value: "mom", label: "엄마" },
  { value: "dad", label: "아빠" },
  { value: "guardian", label: "보호자" },
  { value: "family", label: "가족" },
  { value: "sitter", label: "시터" },
];

export function relationshipToLabel(value: RelationshipToChild): RelationshipLabel {
  switch (value) {
    case "mom":
      return "엄마";
    case "dad":
      return "아빠";
    case "sitter":
      return "시터";
    case "guardian":
      return "보호자";
    case "family":
    default:
      return "가족";
  }
}

/** Display like "엄마 민지" for growth-book attribution. */
export function formatAuthorByline(name: string, relationship: RelationshipToChild): string {
  const label = relationshipToLabel(relationship);
  const trimmed = name.trim() || "나";
  return `${label} ${trimmed}`;
}

export const FEEDING_OPTIONS: Array<{ value: DefaultFeedingMethod; label: string }> = [
  { value: "breastfeeding", label: "모유수유" },
  { value: "formula", label: "분유" },
  { value: "mixed", label: "혼합수유" },
  { value: "pumped_milk", label: "유축모유" },
  { value: "not_sure", label: "아직 모름" },
];

export const CATEGORY_OPTIONS: Array<{ value: LogCategoryGroup; label: string }> = [
  { value: "feeding", label: "수유·식사" },
  { value: "sleep", label: "수면" },
  { value: "diaper", label: "기저귀" },
  { value: "medication", label: "투약" },
  { value: "health", label: "건강" },
  { value: "mood", label: "기분·놀이" },
  { value: "note", label: "메모" },
];

export const DEFAULT_CARE_SETUP: CareSetup = {
  parent: {
    parentName: "",
    relationshipToChild: "mom",
    postpartumStatus: "postpartum",
    preferredLanguage: "ko",
  },
  child: {
    childName: "",
    childStatus: "newborn",
    gender: "unknown",
  },
  preferences: {
    defaultFeedingMethod: "not_sure",
    enabledLogCategories: [...ALL_LOG_CATEGORY_GROUPS],
    familySharingEnabled: false,
  },
};

export const DEMO_CARE_SETUP: CareSetup = {
  parent: {
    parentName: "김민지",
    relationshipToChild: "mom",
    postpartumStatus: "postpartum",
    preferredLanguage: "ko",
  },
  child: {
    childName: "콩이",
    birthDate: "2026-05-15",
    childStatus: "newborn",
    gender: "girl",
    specialNotes: "황금색 대변 패턴이 안정적이에요.",
  },
  preferences: {
    defaultFeedingMethod: "mixed",
    enabledLogCategories: [...ALL_LOG_CATEGORY_GROUPS],
    familySharingEnabled: true,
  },
};
