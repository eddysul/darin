/** Central AsyncStorage keys for CareLog persistence (2.7). */
export const STORAGE_KEYS = {
  careSetup: "darin:care-setup",
  babyLogs: "darin:baby-logs",
  diary: "darin:diary-entries",
  diaryDraft: "darin:diary-draft",
  diaryReminder: "darin:diary-reminder",
  consultChat: "darin:consult-chat",
  familyMembers: "darin:family-members",
  /** Keep the legacy runtime key so existing custom log metadata remains readable. */
  customCategories: "darin:custom-log-categories",
  quickRecords: "darin:quick-records",
  growthBookEdit: "darin:growth-book-edit",
  babyStickers: "darin:baby-stickers",
  growthRecords: "darin:growth-records",
  growthRecordsMigration: "darin:growth-records-migration",
  activeTimers: "darin:active-timers",
  appSettings: "darin:app-settings",
  termsAccepted: "darin:terms-accepted",
  /** Supabase sync pointers (babyId / userId) — not secrets. */
  supabaseSync: "darin:supabase-sync",
  /** Legacy fallback credential key. Read/write is forbidden; cleanup only. */
  supabaseDeviceAuth: "darin:supabase-device-auth",
  /** Email verification/linking flow metadata. Never stores a password. */
  pendingEmailAuth: "darin:pending-email-auth",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
