import { createClient } from "@supabase/supabase-js";
import {
  inQuietHours,
  isExpoPushToken,
  localeFor,
  sendExpoPush,
  type SupportedLocale,
} from "../_shared/notificationRuntime.ts";
import {
  currentClaimMatches,
  emptyCounts,
  expoDeliveryStatus,
  finalStateStatus,
  genericEventStatus,
  unavailableTokenStatus,
  type DeliveryCounts,
  type DeliveryStatus,
} from "./deliveryPolicy.ts";

type ClaimedState = {
  id: string; baby_id: string; reminder_type: "feeding" | "sleep";
  last_relevant_log_id: string | null; version: number; processing_started_at: string;
};
class StaleClaimError extends Error {
  constructor() { super("stale_claim"); }
}

function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

const REMINDER_COPY: Record<SupportedLocale, Record<"feeding" | "sleep", { title: string; body: string }>> = {
  ko: {
    feeding: { title: "수유 기록 리마인더", body: "수유 기록을 확인해볼 시간이에요. 마지막 기록을 기준으로 한 참고 알림이에요." },
    sleep: { title: "수면 기록 리마인더", body: "수면 기록을 확인해볼 시간이에요. 마지막 기록을 기준으로 한 참고 알림이에요." },
  },
  en: {
    feeding: { title: "Feeding log reminder", body: "It may be time to review the feeding log. This is a reference reminder based on the last log." },
    sleep: { title: "Sleep log reminder", body: "It may be time to review the sleep log. This is a reference reminder based on the last log." },
  },
  ja: {
    feeding: { title: "授乳記録のお知らせ", body: "授乳記録を確認する時間です。最後の記録を基準にした参考通知です。" },
    sleep: { title: "睡眠記録のお知らせ", body: "睡眠記録を確認する時間です。最後の記録を基準にした参考通知です。" },
  },
  es: {
    feeding: { title: "Recordatorio de alimentación", body: "Puede ser un buen momento para revisar el registro. Es un aviso orientativo basado en el último registro." },
    sleep: { title: "Recordatorio de sueño", body: "Puede ser un buen momento para revisar el registro. Es un aviso orientativo basado en el último registro." },
  },
  "zh-CN": {
    feeding: { title: "喂养记录提醒", body: "可以查看一下喂养记录。这是根据上次记录提供的参考提醒。" },
    sleep: { title: "睡眠记录提醒", body: "可以查看一下睡眠记录。这是根据上次记录提供的参考提醒。" },
  },
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CARE_REMINDER_CRON_SECRET");
  if (!url || !serviceKey || !cronSecret) return json(500, { error: "Server configuration missing" });
  if (request.headers.get("x-cron-secret") !== cronSecret) return json(401, { error: "Unauthorized" });

  const service = createClient(url, serviceKey);
  const { data: claimed, error: claimError } = await service.rpc("claim_due_care_reminders", { p_limit: 50 });
  if (claimError) return json(500, { error: claimError.message });

  const results: Array<{
    stateId: string; counts: DeliveryCounts; processed: boolean; retryScheduled: boolean; stale: boolean;
  }> = [];

  for (const state of (claimed ?? []) as ClaimedState[]) {
    const counts = emptyCounts();
    try {
      if (!["feeding", "sleep"].includes(state.reminder_type) || !state.last_relevant_log_id) throw new Error("invalid_claimed_state");

      // Repeated directly before each Expo request. This narrows, but cannot fully
      // eliminate, the post-check race window documented in the QA runbook.
      const assertCurrentDelivery = async () => {
        const [{ data: current, error: stateError }, { data: setting, error: settingError }] = await Promise.all([
          service.from("care_reminder_state")
            .select("version,last_relevant_log_id,processing_started_at,send_status")
            .eq("id", state.id).maybeSingle(),
          service.from("care_reminder_settings").select("enabled,interval_minutes")
            .eq("baby_id", state.baby_id).eq("reminder_type", state.reminder_type).maybeSingle(),
        ]);
        if (stateError || settingError) throw stateError ?? settingError;
        if (!setting || !currentClaimMatches({
          version: state.version,
          lastRelevantLogId: state.last_relevant_log_id,
          processingStartedAt: state.processing_started_at,
        }, current ? {
          version: current.version,
          lastRelevantLogId: current.last_relevant_log_id,
          processingStartedAt: current.processing_started_at,
          sendStatus: current.send_status,
        } : null, setting.enabled)) throw new StaleClaimError();
        return setting;
      };

      const setting = await assertCurrentDelivery();
      const { data: members, error: memberError } = await service.from("baby_members")
        .select("user_id,permission_role").eq("baby_id", state.baby_id).eq("status", "active");
      if (memberError) throw memberError;

      for (const member of members ?? []) {
        await assertCurrentDelivery();
        const [{ data: preference, error: preferenceError }, { data: profile, error: profileError }] = await Promise.all([
          service.from("care_reminder_member_preferences").select("*")
            .eq("baby_id", state.baby_id).eq("user_id", member.user_id)
            .eq("reminder_type", state.reminder_type).maybeSingle(),
          service.from("profiles").select("preferred_language").eq("id", member.user_id).maybeSingle(),
        ]);
        if (preferenceError || profileError) throw preferenceError ?? profileError;

        const eventType = `${state.reminder_type}_reminder` as "feeding_reminder" | "sleep_reminder";
        const dedupeKey = `${eventType}:${state.baby_id}:${state.last_relevant_log_id}:${state.version}:${member.user_id}`;
        const quiet = Boolean(preference?.delivery_enabled && preference.quiet_hours_enabled && inQuietHours(
          new Date(), preference.timezone, preference.quiet_start, preference.quiet_end,
        ));
        const initialDeliveryStatus: DeliveryStatus | null = !preference?.delivery_enabled
          ? "skipped_permission_or_disabled" : quiet ? "skipped_quiet_hours" : null;
        const { title, body } = REMINDER_COPY[localeFor(profile?.preferred_language)][state.reminder_type];
        const eventData = {
          route: "record",
          feature: state.reminder_type === "feeding" ? "feedingReminder" : "sleepReminder",
          reminderType: state.reminder_type,
          babyId: state.baby_id,
          logId: state.last_relevant_log_id,
        };
        let { data: event, error: eventError } = await service.from("notification_events").insert({
          recipient_id: member.user_id, actor_id: null, baby_id: state.baby_id,
          event_type: eventType, title, body, data: eventData, dedupe_key: dedupeKey,
          status: initialDeliveryStatus ? genericEventStatus(initialDeliveryStatus) : "pending",
          delivery_status: initialDeliveryStatus, error_message: initialDeliveryStatus,
        }).select("id,status,delivery_status").single();

        if (eventError) {
          if (eventError.code !== "23505") throw eventError;
          const existing = await service.from("notification_events").select("id,status,delivery_status")
            .eq("recipient_id", member.user_id).eq("dedupe_key", dedupeKey).maybeSingle();
          if (existing.error) throw existing.error;
          if (!existing.data) throw new Error("notification_event_missing");
          const prior = existing.data.delivery_status as DeliveryStatus | null;
          if (prior && prior !== "failed_retryable") { counts[prior] += 1; continue; }
          event = existing.data;
        }
        if (!event) throw new Error("notification_event_missing");

        if (initialDeliveryStatus) {
          const { error } = await service.from("notification_events").update({
            status: genericEventStatus(initialDeliveryStatus), delivery_status: initialDeliveryStatus,
            error_message: initialDeliveryStatus,
          }).eq("id", event.id);
          if (error) throw error;
          counts[initialDeliveryStatus] += 1;
          continue;
        }

        const { data: tokens, error: tokenError } = await service.from("push_tokens")
          .select("id,expo_push_token,disabled_at").eq("user_id", member.user_id);
        if (tokenError) throw tokenError;
        const activeTokens = (tokens ?? []).filter((token) => token.disabled_at === null);
        const validTokens = activeTokens.filter((token) => isExpoPushToken(token.expo_push_token));
        const unavailableStatus = unavailableTokenStatus((tokens ?? []).length, validTokens.length);
        if (unavailableStatus) {
          const deliveryStatus: DeliveryStatus = unavailableStatus;
          const { error } = await service.from("notification_events").update({
            status: "skipped", delivery_status: deliveryStatus, error_message: deliveryStatus,
          }).eq("id", event.id);
          if (error) throw error;
          counts[deliveryStatus] += 1;
          continue;
        }

        await assertCurrentDelivery();
        let deliveryStatus: DeliveryStatus;
        let disabledTokenCount = 0;
        try {
          const pushResult = await sendExpoPush(validTokens.map((token) => ({
              to: token.expo_push_token, sound: "default", title, body,
              data: { ...eventData, eventId: event.id },
          })));
          for (const index of pushResult.deviceNotRegisteredIndexes) {
            if (validTokens[index]) {
              const { error } = await service.from("push_tokens")
                .update({ disabled_at: new Date().toISOString() }).eq("id", validTokens[index].id);
              if (error) throw error;
              disabledTokenCount += 1;
            }
          }
          deliveryStatus = expoDeliveryStatus(pushResult.successCount, disabledTokenCount, validTokens.length);
        } catch (error) {
          console.error("care reminder Expo request failed", state.id, member.user_id, error);
          deliveryStatus = "failed_retryable";
        }

        const { error: eventUpdateError } = await service.from("notification_events").update({
          status: genericEventStatus(deliveryStatus), delivery_status: deliveryStatus,
          error_message: deliveryStatus === "sent" ? null : deliveryStatus,
          sent_at: deliveryStatus === "sent" ? new Date().toISOString() : null,
          data: { ...eventData, delivery: { disabledTokenCount, attemptedTokenCount: validTokens.length } },
        }).eq("id", event.id);
        if (eventUpdateError) throw eventUpdateError;
        counts[deliveryStatus] += 1;
      }

      const retryScheduled = counts.failed_retryable > 0;
      const finalStatus = finalStateStatus(counts);
      const { data: finished, error: finishError } = await service.from("care_reminder_state").update({
        send_status: finalStatus, last_sent_for_log_id: state.last_relevant_log_id,
        last_sent_at: counts.sent > 0 ? new Date().toISOString() : null, processing_started_at: null,
      }).eq("id", state.id).eq("version", state.version)
        .eq("last_relevant_log_id", state.last_relevant_log_id)
        .eq("processing_started_at", state.processing_started_at).select("id").maybeSingle();
      if (finishError) throw finishError;
      if (!finished) throw new StaleClaimError();
      results.push({ stateId: state.id, counts, processed: !retryScheduled, retryScheduled, stale: false });
    } catch (error) {
      await service.from("care_reminder_state").update({ processing_started_at: null })
        .eq("id", state.id).eq("version", state.version).eq("processing_started_at", state.processing_started_at);
      const stale = error instanceof StaleClaimError;
      results.push({ stateId: state.id, counts, processed: false, retryScheduled: !stale, stale });
      console.error("care reminder processing failed", state.id, error);
    }
  }
  return json(200, { ok: true, claimed: (claimed ?? []).length, results });
});
