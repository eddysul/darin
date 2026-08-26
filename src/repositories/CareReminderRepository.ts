import { requireSupabase } from "../lib/supabase";
import type {
  CareReminderMemberPreferenceRow,
  CareReminderSettingRow,
  CareReminderStateRow,
} from "../types/database";
import type {
  CareReminderMemberPreference,
  CareReminderBundle,
  CareReminderSetting,
  CareReminderState,
  CareReminderType,
} from "../types/careReminder";
import { AuthRepository } from "./AuthRepository";

function settingFromRow(row: CareReminderSettingRow): CareReminderSetting {
  return {
    id: row.id, babyId: row.baby_id, reminderType: row.reminder_type,
    enabled: row.enabled, mode: row.mode, intervalMinutes: row.interval_minutes,
    includedLogTypes: row.included_log_types, updatedBy: row.updated_by,
  };
}

function preferenceFromRow(row: CareReminderMemberPreferenceRow): CareReminderMemberPreference {
  return {
    id: row.id, babyId: row.baby_id, userId: row.user_id, reminderType: row.reminder_type,
    deliveryEnabled: row.delivery_enabled, quietHoursEnabled: row.quiet_hours_enabled,
    quietStart: row.quiet_start?.slice(0, 5) ?? null, quietEnd: row.quiet_end?.slice(0, 5) ?? null,
    timezone: row.timezone, userModifiedAt: row.user_modified_at,
  };
}

function stateFromRow(row: CareReminderStateRow): CareReminderState {
  return {
    id: row.id, babyId: row.baby_id, reminderType: row.reminder_type,
    lastRelevantLogId: row.last_relevant_log_id, lastRelevantLogAt: row.last_relevant_log_at,
    nextDueAt: row.next_due_at, version: row.version, sendStatus: row.send_status,
    lastSentForLogId: row.last_sent_for_log_id, lastSentAt: row.last_sent_at,
    processingStartedAt: row.processing_started_at,
  };
}

export const CareReminderRepository = {
  async getBundle(babyId: string, reminderType: CareReminderType): Promise<CareReminderBundle> {
    const user = await AuthRepository.getUser();
    if (!user) return { setting: null, preference: null, state: null };
    const sb = requireSupabase();
    const [settingResult, preferenceResult, stateResult] = await Promise.all([
      sb.from("care_reminder_settings").select("*").eq("baby_id", babyId).eq("reminder_type", reminderType).maybeSingle(),
      sb.from("care_reminder_member_preferences").select("*").eq("baby_id", babyId).eq("user_id", user.id).eq("reminder_type", reminderType).maybeSingle(),
      sb.from("care_reminder_state").select("*").eq("baby_id", babyId).eq("reminder_type", reminderType).maybeSingle(),
    ]);
    const error = settingResult.error ?? preferenceResult.error ?? stateResult.error;
    if (error) throw error;
    return {
      setting: settingResult.data ? settingFromRow(settingResult.data) : null,
      preference: preferenceResult.data ? preferenceFromRow(preferenceResult.data) : null,
      state: stateResult.data ? stateFromRow(stateResult.data) : null,
    };
  },

  getFeedingBundle(babyId: string) { return this.getBundle(babyId, "feeding"); },
  getSleepBundle(babyId: string) { return this.getBundle(babyId, "sleep"); },

  async saveSetting(babyId: string, reminderType: CareReminderType, input: { enabled: boolean; intervalMinutes: number }): Promise<CareReminderSetting> {
    const user = await AuthRepository.getUser();
    if (!user) throw new Error("로그인이 필요해요.");
    const { data, error } = await requireSupabase().from("care_reminder_settings").upsert({
      baby_id: babyId,
      reminder_type: reminderType,
      enabled: input.enabled,
      mode: "custom",
      interval_minutes: input.intervalMinutes,
      included_log_types: reminderType === "feeding" ? ["breast", "formula", "storedMilk"] : ["sleep"],
      updated_by: user.id,
    }, { onConflict: "baby_id,reminder_type" }).select("*").single();
    if (error) throw error;
    return settingFromRow(data);
  },

  saveFeedingSetting(babyId: string, input: { enabled: boolean; intervalMinutes: number }) {
    return this.saveSetting(babyId, "feeding", input);
  },
  saveSleepSetting(babyId: string, input: { enabled: boolean; intervalMinutes: number }) {
    return this.saveSetting(babyId, "sleep", input);
  },

  async saveMyPreference(
    babyId: string,
    reminderType: CareReminderType,
    input: { deliveryEnabled: boolean; quietHoursEnabled?: boolean; quietStart?: string | null; quietEnd?: string | null; timezone?: string | null },
  ): Promise<CareReminderMemberPreference> {
    const user = await AuthRepository.getUser();
    if (!user) throw new Error("로그인이 필요해요.");
    const { data, error } = await requireSupabase().from("care_reminder_member_preferences").upsert({
      baby_id: babyId,
      user_id: user.id,
      reminder_type: reminderType,
      delivery_enabled: input.deliveryEnabled,
      quiet_hours_enabled: input.quietHoursEnabled ?? false,
      quiet_start: input.quietStart ?? null,
      quiet_end: input.quietEnd ?? null,
      timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      user_modified_at: new Date().toISOString(),
    }, { onConflict: "baby_id,user_id,reminder_type" }).select("*").single();
    if (error) throw error;
    return preferenceFromRow(data);
  },

  saveMyFeedingPreference(babyId: string, input: { deliveryEnabled: boolean; quietHoursEnabled?: boolean; quietStart?: string | null; quietEnd?: string | null; timezone?: string | null }) {
    return this.saveMyPreference(babyId, "feeding", input);
  },
  saveMySleepPreference(babyId: string, input: { deliveryEnabled: boolean; quietHoursEnabled?: boolean; quietStart?: string | null; quietEnd?: string | null; timezone?: string | null }) {
    return this.saveMyPreference(babyId, "sleep", input);
  },

  async migrateLegacyFeedingSetting(babyId: string, enabled: boolean, intervalMinutes: number): Promise<CareReminderBundle> {
    const current = await this.getFeedingBundle(babyId);
    if (current.setting || !enabled) return current;
    try {
      await this.saveFeedingSetting(babyId, { enabled: true, intervalMinutes });
    } catch {
      // A viewer cannot create the shared setting, and another family member may
      // have won the migration race. In both cases the server is authoritative.
    }
    return this.getFeedingBundle(babyId);
  },

  async migrateLegacySleepSetting(babyId: string, enabled: boolean, intervalMinutes: number): Promise<CareReminderBundle> {
    const current = await this.getSleepBundle(babyId);
    if (current.setting || !enabled) return current;
    try {
      await this.saveSleepSetting(babyId, { enabled: true, intervalMinutes });
    } catch {
      // Viewers cannot create the shared setting. A concurrent family update is
      // also harmless because the next read remains authoritative.
    }
    return this.getSleepBundle(babyId);
  },
};
