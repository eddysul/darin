import type { DiaryComposeDraft } from "../constants/diaryCompose";

export type DiaryDraft = DiaryComposeDraft & {
  dateKey: string;
  updatedAt: string;
};

/** UI + future OS scheduling. MVP scheduling uses daily only. */
export type DiaryReminderRepeat = "daily" | "weekdays" | "weekend" | "custom";

export type DiaryReminderSettings = {
  enabled: boolean;
  /** 0–23 */
  hour: number;
  /** 0–59 */
  minute: number;
  /** Last local dateKey we already fired the in-app toast for */
  lastFiredDateKey?: string;
  /** MVP: only `daily` is scheduled; others are UI placeholders. */
  repeat?: DiaryReminderRepeat;
  familyActivityEnabled?: boolean;
  inviteActivityEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  showPreview?: boolean;
};

export const DEFAULT_DIARY_REMINDER: DiaryReminderSettings = {
  enabled: true,
  hour: 21,
  minute: 0,
  repeat: "daily",
  familyActivityEnabled: true,
  inviteActivityEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  showPreview: true,
};

export const REMINDER_PRESETS: Array<{
  id: string;
  label: string;
  hour: number;
  minute: number;
  recommended?: boolean;
}> = [
  { id: "20", label: "저녁 8시", hour: 20, minute: 0 },
  { id: "20:30", label: "저녁 8시 30분", hour: 20, minute: 30 },
  { id: "21", label: "밤 9시", hour: 21, minute: 0, recommended: true },
];
