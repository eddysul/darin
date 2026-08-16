import * as Notifications from "expo-notifications";
import {
  openDeviceNotificationSettings,
  requestReminderPermission,
} from "./diaryReminderNotifications";

export { openDeviceNotificationSettings, requestReminderPermission };

const MEMO_REMINDER_PREFIX = "darin-memo-";

export function memoReminderId(logId: string) {
  return `${MEMO_REMINDER_PREFIX}${logId}`;
}

export async function cancelMemoReminder(logId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(memoReminderId(logId));
  } catch {
    // ignore — id may not exist
  }
}

/** One-shot local reminder for a consult/record memo. */
export async function scheduleMemoReminder(input: {
  logId: string;
  fireAt: Date;
  title: string;
  body: string;
}): Promise<boolean> {
  const permission = await requestReminderPermission();
  if (permission !== "granted") return false;
  if (input.fireAt.getTime() <= Date.now() + 10_000) return false;

  await cancelMemoReminder(input.logId);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: memoReminderId(input.logId),
      content: {
        title: input.title,
        body: input.body,
        data: { route: "record", source: "memo-reminder", logId: input.logId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: input.fireAt,
      },
    });
    return true;
  } catch {
    return false;
  }
}
