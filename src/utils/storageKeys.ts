/** Central AsyncStorage keys for CareLog persistence (2.7). */
export const STORAGE_KEYS = {
  babyLogs: "darin:baby-logs",
  diary: "darin:diary-entries",
  consultChat: "darin:consult-chat",
  familyMembers: "darin:family-members",
  customCategories: "darin:custom-categories",
  frequentShortcuts: "darin:frequent-shortcuts",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
