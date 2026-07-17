/** Central AsyncStorage keys for CareLog persistence (2.7). */
export const STORAGE_KEYS = {
  babyLogs: "darin:baby-logs",
  diary: "darin:diary-entries",
  diaryDraft: "darin:diary-draft",
  diaryReminder: "darin:diary-reminder",
  consultChat: "darin:consult-chat",
  familyMembers: "darin:family-members",
  /** Keep the legacy runtime key so existing custom log metadata remains readable. */
  customCategories: "darin:custom-log-categories",
  quickRecords: "darin:quick-records",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
