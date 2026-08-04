import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import type { DiaryReminderSettings } from "../types/diaryReminder";

const DIARY_REMINDER_ID = "darin-diary-daily-reminder";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type ReminderPermissionStatus = "granted" | "denied" | "not_determined" | "unavailable";

export async function getReminderPermissionStatus(): Promise<ReminderPermissionStatus> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return "unavailable";
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return "granted";
    if (status === "denied") return "denied";
    return "not_determined";
  } catch {
    return "unavailable";
  }
}

export async function requestReminderPermission(): Promise<ReminderPermissionStatus> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return "unavailable";
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") return "granted";
    const asked = await Notifications.requestPermissionsAsync();
    if (asked.status === "granted") return "granted";
    return asked.status === "denied" ? "denied" : "not_determined";
  } catch {
    return "unavailable";
  }
}

export async function sendDiaryNotificationPreview(babyName: string): Promise<boolean> {
  const permission = await requestReminderPermission();
  if (permission !== "granted") return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "오늘 하루 어땠나요?",
        body: `자기 전 ${babyName}와의 순간을 남겨보세요.`,
        data: { route: "diary", source: "notification", date: "today", openCompose: true },
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

export async function openDeviceNotificationSettings(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      await Linking.openURL("app-settings:");
      return;
    }
    await Linking.openSettings();
  } catch {
    await Linking.openSettings();
  }
}

/** Cancel scheduled diary reminder notifications. */
export async function cancelDiaryReminderNotifications(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DIARY_REMINDER_ID);
  } catch {
    // ignore — id may not exist
  }
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.identifier.startsWith("darin-diary"))
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
  } catch {
    // ignore
  }
}

/**
 * Schedule a daily local reminder. Deep-link data keeps Diary openCompose flow intact.
 * If OS permission is missing, this is a no-op (in-app toast still works).
 */
export async function syncDiaryReminderNotifications(
  settings: DiaryReminderSettings,
  copy: { title: string; body: string },
): Promise<void> {
  await cancelDiaryReminderNotifications();
  if (!settings.enabled) return;

  const permission = await getReminderPermissionStatus();
  if (permission !== "granted") return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DIARY_REMINDER_ID,
      content: {
        title: copy.title,
        body: copy.body,
        data: {
          source: "notification",
          date: "today",
          openCompose: true,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.hour,
        minute: settings.minute,
      },
    });
  } catch {
    // Expo Go / simulator quirks — keep settings saved either way
  }
}
