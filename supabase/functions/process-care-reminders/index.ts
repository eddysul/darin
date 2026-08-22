import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ClaimedState = {
  id: string;
  baby_id: string;
  reminder_type: "feeding" | "sleep";
  last_relevant_log_id: string | null;
  version: number;
  processing_started_at: string;
};

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
  } catch {
    return false;
  }
}

function intervalText(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${minutes}분`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CARE_REMINDER_CRON_SECRET");
  if (!url || !serviceKey) return json(500, { error: "Server configuration missing" });

  const authorized = request.headers.get("authorization") === `Bearer ${serviceKey}`
    || Boolean(cronSecret && request.headers.get("x-cron-secret") === cronSecret);
  if (!authorized) return json(401, { error: "Unauthorized" });

  const service = createClient(url, serviceKey);
  const { data: claimed, error: claimError } = await service.rpc("claim_due_care_reminders", { p_limit: 50 });
  if (claimError) return json(500, { error: claimError.message });

  const results: Array<{ stateId: string; sent: number; skipped: number; failed: boolean }> = [];
  for (const state of (claimed ?? []) as ClaimedState[]) {
    let sent = 0;
    let skipped = 0;
    let quietSkipped = 0;
    try {
      if (state.reminder_type !== "feeding" || !state.last_relevant_log_id) continue;
      const assertCurrentClaim = async () => {
        const { data: current } = await service.from("care_reminder_state")
          .select("version,last_relevant_log_id,processing_started_at")
          .eq("id", state.id).maybeSingle();
        if (
          !current || current.version !== state.version
          || current.last_relevant_log_id !== state.last_relevant_log_id
          || current.processing_started_at !== state.processing_started_at
        ) throw new Error("stale_claim");
      };
      await assertCurrentClaim();
      const [{ data: setting, error: settingError }, { data: members, error: memberError }] = await Promise.all([
        service.from("care_reminder_settings").select("interval_minutes,enabled")
          .eq("baby_id", state.baby_id).eq("reminder_type", "feeding").single(),
        service.from("baby_members").select("user_id,permission_role")
          .eq("baby_id", state.baby_id).eq("status", "active"),
      ]);
      if (settingError || memberError || !setting?.enabled) throw settingError ?? memberError ?? new Error("setting_disabled");

      for (const member of members ?? []) {
        await assertCurrentClaim();
        const { data: preference } = await service.from("care_reminder_member_preferences").select("*")
          .eq("baby_id", state.baby_id).eq("user_id", member.user_id)
          .eq("reminder_type", "feeding").maybeSingle();
        if (!preference?.delivery_enabled) { skipped += 1; continue; }

        const dedupeKey = `feeding_reminder:${state.baby_id}:${state.last_relevant_log_id}:${state.version}:${member.user_id}`;
        const quiet = preference.quiet_hours_enabled && inQuietHours(
          new Date(), preference.timezone, preference.quiet_start, preference.quiet_end,
        );
        const title = "수유 기록을 확인해볼 시간이에요";
        const body = `마지막 수유 후 ${intervalText(setting.interval_minutes)}이 지났어요. 아기의 수유 신호를 함께 확인해 주세요.`;
        let { data: event, error: eventError } = await service.from("notification_events").insert({
          recipient_id: member.user_id,
          actor_id: null,
          baby_id: state.baby_id,
          event_type: "feeding_reminder",
          title,
          body,
          data: { route: "record", babyId: state.baby_id, logId: state.last_relevant_log_id },
          dedupe_key: dedupeKey,
          status: quiet ? "skipped" : "pending",
          error_message: quiet ? "skipped_quiet_hours" : null,
        }).select("id").single();
        if (eventError) {
          if (eventError.code !== "23505") throw eventError;
          const existing = await service.from("notification_events").select("id,status")
            .eq("recipient_id", member.user_id).eq("dedupe_key", dedupeKey).maybeSingle();
          if (!existing.data || existing.data.status === "sent" || existing.data.status === "skipped") {
            skipped += 1;
            continue;
          }
          event = { id: existing.data.id };
          eventError = null;
        }
        if (!event) throw new Error("notification_event_missing");
        if (quiet) { quietSkipped += 1; skipped += 1; continue; }

        const { data: tokens } = await service.from("push_tokens").select("id,expo_push_token")
          .eq("user_id", member.user_id).is("disabled_at", null);
        const validTokens = (tokens ?? []).filter((token) => /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token.expo_push_token));
        if (!validTokens.length) {
          await service.from("notification_events").update({ status: "skipped", error_message: "no_active_token" }).eq("id", event.id);
          skipped += 1;
          continue;
        }

        await assertCurrentClaim();
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(validTokens.map((token) => ({
            to: token.expo_push_token,
            sound: "default",
            title,
            body,
            data: { route: "record", babyId: state.baby_id, logId: state.last_relevant_log_id, eventId: event.id },
          }))),
        });
        const payload = await response.json();
        const receipts = Array.isArray(payload?.data) ? payload.data : [payload?.data];
        for (let index = 0; index < receipts.length; index += 1) {
          if (receipts[index]?.details?.error === "DeviceNotRegistered" && validTokens[index]) {
            await service.from("push_tokens").update({ disabled_at: new Date().toISOString() }).eq("id", validTokens[index].id);
          }
        }
        const ok = response.ok && receipts.some((receipt: { status?: string }) => receipt?.status === "ok");
        await service.from("notification_events").update(ok
          ? { status: "sent", sent_at: new Date().toISOString(), error_message: null }
          : { status: "failed", error_message: "expo_push_rejected" }).eq("id", event.id);
        if (ok) sent += 1;
        else skipped += 1;
      }

      const processedAt = new Date().toISOString();
      const finalStatus = quietSkipped > 0 && sent === 0 ? "skipped_quiet_hours" : "sent";
      const { error: finishError } = await service.from("care_reminder_state").update({
        send_status: finalStatus,
        last_sent_for_log_id: state.last_relevant_log_id,
        last_sent_at: sent > 0 ? processedAt : null,
        processing_started_at: null,
      }).eq("id", state.id).eq("version", state.version).eq("processing_started_at", state.processing_started_at);
      if (finishError) throw finishError;
      results.push({ stateId: state.id, sent, skipped, failed: false });
    } catch (error) {
      await service.from("care_reminder_state").update({ processing_started_at: null })
        .eq("id", state.id).eq("version", state.version);
      results.push({ stateId: state.id, sent, skipped, failed: true });
      console.error("care reminder processing failed", state.id, error);
    }
  }
  return json(200, { ok: true, claimed: (claimed ?? []).length, results });
});
