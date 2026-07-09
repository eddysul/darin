export type RelationshipToChild = "mom" | "dad" | "guardian" | "family";
export type PostpartumStatus = "pregnant" | "expecting" | "postpartum" | "not_applicable";
export type PreferredLanguage = "ko" | "en";
export type ChildStatus = "unborn" | "newborn" | "infant";
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
  },
  preferences: {
    defaultFeedingMethod: "not_sure",
    enabledLogCategories: [...ALL_LOG_CATEGORY_GROUPS],
    familySharingEnabled: true,
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
    specialNotes: "황금색 대변 패턴이 안정적이에요.",
  },
  preferences: {
    defaultFeedingMethod: "mixed",
    enabledLogCategories: [...ALL_LOG_CATEGORY_GROUPS],
    familySharingEnabled: true,
  },
};
