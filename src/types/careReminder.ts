export type CareReminderType = "feeding" | "sleep";
export type CareReminderMode = "custom" | "age_preset";
export type CareReminderSendStatus =
  | "scheduled"
  | "overdue_not_scheduled"
  | "sent"
  | "disabled"
  | "skipped_quiet_hours";

export type CareReminderSetting = {
  id?: string;
  babyId: string;
  reminderType: CareReminderType;
  enabled: boolean;
  mode: CareReminderMode;
  intervalMinutes: number;
  includedLogTypes: string[];
  updatedBy?: string | null;
};

export type CareReminderMemberPreference = {
  id?: string;
  babyId: string;
  userId: string;
  reminderType: CareReminderType;
  deliveryEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
  userModifiedAt?: string | null;
};

export type CareReminderState = {
  id: string;
  babyId: string;
  reminderType: CareReminderType;
  lastRelevantLogId: string | null;
  lastRelevantLogAt: string | null;
  nextDueAt: string | null;
  version: number;
  sendStatus: CareReminderSendStatus;
  lastSentForLogId: string | null;
  lastSentAt: string | null;
  processingStartedAt: string | null;
};

export type FeedingReminderBundle = {
  setting: CareReminderSetting | null;
  preference: CareReminderMemberPreference | null;
  state: CareReminderState | null;
};

export const DEFAULT_FEEDING_REMINDER_SETTING = {
  reminderType: "feeding" as const,
  enabled: false,
  mode: "custom" as const,
  intervalMinutes: 180,
  includedLogTypes: ["breast", "formula", "storedMilk"],
};
