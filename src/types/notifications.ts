import type { NotificationEventType, NotificationSettingsRow } from "./database";

export type PushPermissionState = "not_determined" | "granted" | "denied" | "unavailable";

export type NotificationSettings = {
  id?: string;
  userId: string;
  babyId: string | null;
  diaryReminderEnabled: boolean;
  diaryReminderHour: number;
  diaryReminderMinute: number;
  timezone: string;
  familyActivityEnabled: boolean;
  inviteActivityEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  showPreview: boolean;
};

export type NotificationRouteData = {
  route: "record" | "diary" | "memory" | "growth_book" | "family" | "report" | "settings";
  memoryPostId?: string;
  diaryEntryId?: string;
  logId?: string;
  growthBookId?: string;
  pageId?: string;
  babyId?: string;
  date?: string;
  settingsPage?: "careAlerts";
  openCompose?: boolean;
};

export type SendNotificationInput = {
  eventType: NotificationEventType;
  babyId: string;
  targetId?: string;
  routeData: NotificationRouteData;
};

function timeParts(value: string): [number, number] {
  const [hour, minute] = value.split(":").map(Number);
  return [Number.isFinite(hour) ? hour : 21, Number.isFinite(minute) ? minute : 0];
}

export function notificationSettingsFromRow(row: NotificationSettingsRow): NotificationSettings {
  const [hour, minute] = timeParts(row.diary_reminder_time);
  return {
    id: row.id,
    userId: row.user_id,
    babyId: row.baby_id,
    diaryReminderEnabled: row.diary_reminder_enabled,
    diaryReminderHour: hour,
    diaryReminderMinute: minute,
    timezone: row.timezone,
    familyActivityEnabled: row.family_activity_enabled,
    inviteActivityEnabled: row.invite_activity_enabled,
    quietHoursEnabled: row.quiet_hours_enabled,
    quietHoursStart: row.quiet_hours_start.slice(0, 5),
    quietHoursEnd: row.quiet_hours_end.slice(0, 5),
    showPreview: row.show_preview,
  };
}
