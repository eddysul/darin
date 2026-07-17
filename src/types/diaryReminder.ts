import type { DiaryComposeDraft } from "../constants/diaryCompose";

export type DiaryDraft = DiaryComposeDraft & {
  dateKey: string;
  updatedAt: string;
};

export type DiaryReminderSettings = {
  enabled: boolean;
  /** 0–23 */
  hour: number;
  /** 0–59 */
  minute: number;
  /** Last local dateKey we already fired the in-app toast for */
  lastFiredDateKey?: string;
};

export const DEFAULT_DIARY_REMINDER: DiaryReminderSettings = {
  enabled: true,
  hour: 22,
  minute: 0,
};
