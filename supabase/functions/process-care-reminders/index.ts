import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ClaimedState = {
  id: string; baby_id: string; reminder_type: "feeding" | "sleep";
  last_relevant_log_id: string | null; version: number; processing_started_at: string;
};
type DeliveryStatus = "sent" | "skipped_quiet_hours" | "skipped_no_token"
  | "skipped_permission_or_disabled" | "failed_retryable" | "failed_permanent";
type DeliveryCounts = Record<DeliveryStatus, number>;

const emptyCounts = (): DeliveryCounts => ({
  sent: 0, skipped_quiet_hours: 0, skipped_no_token: 0,
  skipped_permission_or_disabled: 0, failed_retryable: 0, failed_permanent: 0,
});

class StaleClaimError extends Error {
  constructor() { super("stale_claim"); }
}

function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function inQuietHours(now: Date, timezone: string | null, start: string | null, end: string | null): boolean {
  if (!timezone || !start || !end) return false;
  try {
    const hm = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);
    const current = Number(hm.replace(":", ""));
    const from = Number(start.slice(0, 5).replace(":", ""));
    const to = Number(end.slice(0, 5).replace(":", ""));
    return from <= to ? current >= from && current < to : current >= from || current < to;
  } catch { return false; }
}

function intervalText(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${minutes}분`;
}

function genericEventStatus(status: DeliveryStatus): "sent" | "failed" | "skipped" {
  if (status === "sent") return "sent";
  return status.startsWith("failed_") ? "failed" : "skipped";
}

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
      if (state.reminder_type !== "feeding" || !state.last_relevant_log_id) throw new Error("invalid_claimed_state");

      // Repeated directly before each Expo request. This narrows, but cannot fully
      // eliminate, the post-check race window documented in the QA runbook.
      const assertCurrentDelivery = async () => {
        const [{ data: current, error: stateError }, { data: setting, error: settingError }] = await Promise.all([
          service.from("care_reminder_state")
            .select("version,last_relevant_log_id,processing_started_at,send_status")
            .eq("id", state.id).maybeSingle(),
          service.from("care_reminder_settings").select("enabled,interval_minutes")
            .eq("baby_id", state.baby_id).eq("reminder_type", "feeding").maybeSingle(),
        ]);
        if (stateError || settingError) throw stateError ?? settingError;
        if (!current || !setting?.enabled || current.send_status !== "scheduled"
          || current.version !== state.version
          || current.last_relevant_log_id !== state.last_relevant_log_id
          || current.processing_started_at !== state.processing_started_at) throw new StaleClaimError();
        return setting;
      };

      const setting = await assertCurrentDelivery();
      const { data: members, error: memberError } = await service.from("baby_members")
        .select("user_id,permission_role").eq("baby_id", state.baby_id).eq("status", "active");
      if (memberError) throw memberError;

      for (const member of members ?? []) {
        await assertCurrentDelivery();
        const { data: preference, error: preferenceError } = await service
          .from("care_reminder_member_preferences").select("*")
          .eq("baby_id", state.baby_id).eq("user_id", member.user_id)
          .eq("reminder_type", "feeding").maybeSingle();
        if (preferenceError) throw preferenceError;

        const dedupeKey = `feeding_reminder:${state.baby_id}:${state.last_relevant_log_id}:${state.version}:${member.user_id}`;
        const quiet = Boolean(preference?.delivery_enabled && preference.quiet_hours_enabled && inQuietHours(
          new Date(), preference.timezone, preference.quiet_start, preference.quiet_end,
        ));
        const initialDeliveryStatus: DeliveryStatus | null = !preference?.delivery_enabled
          ? "skipped_permission_or_disabled" : quiet ? "skipped_quiet_hours" : null;
        const title = "수유 기록을 확인해볼 시간이에요";
        const body = `마지막 수유 후 ${intervalText(setting.interval_minutes)}이 지났어요. 아기의 수유 신호를 함께 확인해 주세요.`;
        const eventData = { route: "record", feature: "feedingReminder", babyId: state.baby_id, logId: state.last_relevant_log_id };
        let { data: event, error: eventError } = await service.from("notification_events").insert({
          recipient_id: member.user_id, actor_id: null, baby_id: state.baby_id,
          event_type: "feeding_reminder", title, body, data: eventData, dedupe_key: dedupeKey,
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
        const validTokens = activeTokens.filter((token) => /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token.expo_push_token));
        if (!validTokens.length) {
          const deliveryStatus: DeliveryStatus = (tokens ?? []).length === 0
            ? "skipped_no_token" : "skipped_permission_or_disabled";
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
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify(validTokens.map((token) => ({
              to: token.expo_push_token, sound: "default", title, body,
              data: { ...eventData, eventId: event.id },
            }))),
            signal: AbortSignal.timeout(10_000),
          });
          const payload = await response.json().catch(() => null);
          const tickets = Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
          let successCount = 0;
          for (let index = 0; index < validTokens.length; index += 1) {
            const ticket = tickets[index];
            if (response.ok && ticket?.status === "ok") successCount += 1;
            if (ticket?.details?.error === "DeviceNotRegistered") {
              const { error } = await service.from("push_tokens")
                .update({ disabled_at: new Date().toISOString() }).eq("id", validTokens[index].id);
              if (error) throw error;
              disabledTokenCount += 1;
            }
          }
          deliveryStatus = successCount > 0 ? "sent"
            : disabledTokenCount === validTokens.length ? "failed_permanent" : "failed_retryable";
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
      const finalStatus = retryScheduled ? "scheduled" : counts.sent > 0 ? "sent" : "processed";
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
