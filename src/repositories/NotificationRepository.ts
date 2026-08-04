import { Platform } from "react-native";
import type { Database, PushTokenRow } from "../types/database";
import type { NotificationSettings, SendNotificationInput } from "../types/notifications";
import { notificationSettingsFromRow } from "../types/notifications";
import { requireSupabase } from "../lib/supabase";
import { AuthRepository } from "./AuthRepository";

function timeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

async function requireUserId(): Promise<string> {
  const user = await AuthRepository.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  return user.id;
}

export const NotificationRepository = {
  async registerToken(input: {
    deviceId: string;
    expoPushToken: string;
    appVersion?: string | null;
    buildNumber?: string | null;
  }): Promise<PushTokenRow> {
    if (Platform.OS !== "ios" && Platform.OS !== "android") throw new Error("Push is unavailable on this platform.");
    const userId = await requireUserId();
    const { data, error } = await requireSupabase().from("push_tokens").upsert({
      user_id: userId,
      device_id: input.deviceId,
      expo_push_token: input.expoPushToken,
      platform: Platform.OS,
      app_version: input.appVersion ?? null,
      build_number: input.buildNumber ?? null,
      last_seen_at: new Date().toISOString(),
      disabled_at: null,
    }, { onConflict: "user_id,device_id" }).select("*").single();
    if (error) throw error;
    return data;
  },

  async unregisterToken(deviceId: string): Promise<void> {
    const userId = await requireUserId();
    const { error } = await requireSupabase().from("push_tokens")
      .update({ disabled_at: new Date().toISOString() })
      .eq("user_id", userId).eq("device_id", deviceId);
    if (error) throw error;
  },

  async getSettings(babyId: string | null): Promise<NotificationSettings | null> {
    const userId = await requireUserId();
    let query = requireSupabase().from("notification_settings").select("*").eq("user_id", userId);
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
      ? await sb.from("notification_settings").update(values).eq("id", row.id).select("*").single()
      : await sb.from("notification_settings").insert(values).select("*").single();
    if (result.error) throw result.error;
    return notificationSettingsFromRow(result.data);
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
