/** Central AsyncStorage keys for CareLog persistence (2.7). */
export const STORAGE_KEYS = {
  careSetup: "darin:care-setup",
  babyLogs: "darin:baby-logs",
  careLogCacheMetadata: "darin:care-log-cache-metadata",
  diary: "darin:diary-entries",
  diaryDraft: "darin:diary-draft",
  diaryReminder: "darin:diary-reminder",
  consultChat: "darin:consult-chat",
  familyMembers: "darin:family-members",
  /** Keep the legacy runtime key so existing custom log metadata remains readable. */
  customCategories: "darin:custom-log-categories",
  quickRecords: "darin:quick-records",
  foodIngredients: "darin:food-ingredients",
  growthBookEdit: "darin:growth-book-edit",
  babyStickers: "darin:baby-stickers",
  babyStickersMigration: "darin:baby-stickers-server-migration:v1",
  growthRecords: "darin:growth-records",
  growthRecordsMigration: "darin:growth-records-migration",
  activeTimers: "darin:active-timers",
  /** Cached weekly report copy. Regenerated about once a week. */
  weeklyNarrative: "darin:weekly-narrative",
  /** Cached insight sentences after local correlation. */
  insightPhrases: "darin:insight-phrases",
  appSettings: "darin:app-settings",
  termsAccepted: "darin:terms-accepted",
  /** Optional marketing consent captured on the terms screen, with the decision time. */
  marketingConsent: "darin:marketing-consent",
  /** Supabase sync pointers (babyId / userId) — not secrets. */
  supabaseSync: "darin:supabase-sync",
  /** Legacy fallback credential key. Read/write is forbidden; cleanup only. */
  supabaseDeviceAuth: "darin:supabase-device-auth",
  /** Email verification/linking flow metadata. Never stores a password. */
  pendingEmailAuth: "darin:pending-email-auth",
  /** Invite code retained across OAuth/browser round-trips until accept. */
  pendingInvite: "darin:pending-invite",
  /** Local MVP identity metadata. The backend will later enforce globally unique Darin IDs. */
  darinIdentity: "darin:darin-identity",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function isDarinStorageKey(key: string): boolean {
  return Object.values(STORAGE_KEYS).some(
    (prefix) => key === prefix || key.startsWith(`${prefix}:`),
  );
}
