import { Platform } from "react-native";
import type { Database } from "../types/database";
import type { NotificationSettings, SendNotificationInput } from "../types/notifications";
import { notificationSettingsFromRow } from "../types/notifications";
import { captureSessionScope, requireSupabase } from "../lib/supabase";
import { readDismissedNotificationEventIds, rememberDismissedNotificationEvent } from "../utils/dismissedNotificationEventsStore";
import { AuthRepository } from "./AuthRepository";

function timeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

const NOTIFICATION_SETTINGS_SELECT = "id,user_id,baby_id,diary_reminder_enabled,diary_reminder_time,timezone,family_activity_enabled,invite_activity_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,show_preview";

async function requireUserId(): Promise<string> {
  const user = await AuthRepository.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  return user.id;
}

function isMissingDismissRpc(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist|schema cache/i.test(message);
}

export const NotificationRepository = {
  async registerToken(input: {
    deviceId: string;
    installationSecret: string;
    expoPushToken: string;
    appVersion?: string | null;
    buildNumber?: string | null;
  }): Promise<void> {
    if (Platform.OS !== "ios" && Platform.OS !== "android") throw new Error("Push is unavailable on this platform.");
    const scope = await captureSessionScope();
    await scope.assertCurrent();
    const { error } = await scope.client.rpc("register_current_push_token", {
      p_device_id: input.deviceId,
      p_expo_push_token: input.expoPushToken,
      p_platform: Platform.OS,
      p_installation_secret: input.installationSecret,
      p_app_version: input.appVersion ?? null,
      p_build_number: input.buildNumber ?? null,
    });
    if (error) throw error;
    try {
      await scope.assertCurrent();
    } catch (scopeError) {
      // A session switch after dispatch must not leave this device subscribed
      // to the previous account while its replacement registration is queued.
      await scope.client.rpc("unregister_current_push_token", { p_device_id: input.deviceId });
      throw scopeError;
    }
  },

  async unregisterToken(deviceId: string): Promise<void> {
    const scope = await captureSessionScope();
    const { error } = await scope.client.rpc("unregister_current_push_token", {
      p_device_id: deviceId,
    });
    if (error) throw error;
  },

  async getSettings(babyId: string | null): Promise<NotificationSettings | null> {
    const userId = await requireUserId();
    let query = requireSupabase().from("notification_settings").select(NOTIFICATION_SETTINGS_SELECT).eq("user_id", userId);
    query = babyId ? query.eq("baby_id", babyId) : query.is("baby_id", null);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? notificationSettingsFromRow(data) : null;
  },

  async updateSettings(input: NotificationSettings): Promise<NotificationSettings> {
    const userId = await requireUserId();
    const values: Database["public"]["Tables"]["notification_settings"]["Insert"] = {
      user_id: userId,
      baby_id: input.babyId,
      diary_reminder_enabled: input.diaryReminderEnabled,
      diary_reminder_time: timeValue(input.diaryReminderHour, input.diaryReminderMinute),
      timezone: input.timezone,
      family_activity_enabled: input.familyActivityEnabled,
      invite_activity_enabled: input.inviteActivityEnabled,
      quiet_hours_enabled: input.quietHoursEnabled,
      quiet_hours_start: input.quietHoursStart,
      quiet_hours_end: input.quietHoursEnd,
      show_preview: input.showPreview,
    };
    const sb = requireSupabase();
    let existing = sb.from("notification_settings").select("id").eq("user_id", userId);
    existing = input.babyId ? existing.eq("baby_id", input.babyId) : existing.is("baby_id", null);
    const { data: row, error: findError } = await existing.maybeSingle();
    if (findError) throw findError;
    const result = row
      ? await sb.from("notification_settings").update(values).eq("id", row.id).select(NOTIFICATION_SETTINGS_SELECT).single()
      : await sb.from("notification_settings").insert(values).select(NOTIFICATION_SETTINGS_SELECT).single();
    if (result.error) throw result.error;
    return notificationSettingsFromRow(result.data);
  },

  async listInAppEvents() {
    const userId = await requireUserId();
    const [{ data, error }, dismissed] = await Promise.all([
      requireSupabase()
        .from("notification_events")
        .select("id, event_type, actor_id, baby_id, title, body, data, read_at, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      readDismissedNotificationEventIds(userId),
    ]);
    if (error) throw error;
    return (data ?? []).filter((event) => !dismissed.has(event.id));
  },

  async markInAppEventRead(eventId: string): Promise<void> {
    const { error } = await requireSupabase().rpc("mark_notification_event_read", {
      p_event_id: eventId,
    });
    if (error) throw error;
  },

  async dismissInAppEvent(eventId: string): Promise<void> {
    const userId = await requireUserId();
    if (eventId.startsWith("qa-")) {
      await rememberDismissedNotificationEvent(userId, eventId);
      return;
    }
    const { error } = await requireSupabase().rpc("dismiss_notification_event", {
      p_event_id: eventId,
    });
    if (!error) return;
    if (isMissingDismissRpc(error)) {
      await rememberDismissedNotificationEvent(userId, eventId);
      return;
    }
    throw error;
  },

  async createNotificationEvent(input: SendNotificationInput): Promise<void> {
    await this.sendPushToBabyMembers(input);
  },

  async sendPushToUser(input: SendNotificationInput & { recipientId: string }): Promise<void> {
    const { error } = await requireSupabase().functions.invoke("send-push-notification", {
      body: { action: "sendToUser", ...input },
    });
    if (error) throw error;
  },

  async sendPushToBabyMembers(input: SendNotificationInput): Promise<void> {
    const { error } = await requireSupabase().functions.invoke("send-push-notification", {
      body: { action: "sendToBabyMembers", ...input },
    });
    if (error) throw error;
  },

  async markSent(): Promise<never> {
    throw new Error("Notification delivery status is server-only.");
  },

  async markFailed(): Promise<never> {
    throw new Error("Notification delivery status is server-only.");
  },
};
