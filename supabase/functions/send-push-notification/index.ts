import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EventType =
  | "memory_comment" | "memory_reaction" | "growth_book_comment"
  | "growth_book_rolling_paper" | "family_joined" | "invite_request"
  | "new_shared_log" | "new_diary" | "daily_summary" | "weekly_summary"
  | "diary_reminder" | "reminder" | "event" | "test";

type RequestBody = {
  action: "sendToBabyMembers" | "sendToUser";
  eventType: EventType;
  babyId: string;
  recipientId?: string;
  targetId?: string;
  routeData?: Record<string, unknown>;
};

const COPY: Record<EventType, { title: string; body: string }> = {
  memory_comment: { title: "새 가족 댓글", body: "가족이 추억에 댓글을 남겼어요." },
  memory_reaction: { title: "새 하트", body: "가족이 추억에 마음을 보냈어요." },
  growth_book_comment: { title: "성장책 새 코멘트", body: "가족이 성장책에 코멘트를 남겼어요." },
  growth_book_rolling_paper: { title: "성장책 롤링페이퍼", body: "가족의 새 메시지가 도착했어요." },
  family_joined: { title: "가족이 참여했어요", body: "초대한 가족이 아기 기록에 참여했어요." },
  invite_request: { title: "가족 초대 요청", body: "새 공유 멤버 요청이 도착했어요." },
  new_shared_log: { title: "새 공유 기록", body: "가족이 새로운 돌봄 기록을 남겼어요." },
  new_diary: { title: "새 일기", body: "가족이 새로운 일기를 남겼어요." },
  daily_summary: { title: "오늘의 요약", body: "오늘의 돌봄 기록 요약을 확인해 보세요." },
  weekly_summary: { title: "이번 주 요약", body: "이번 주 성장과 돌봄 기록을 확인해 보세요." },
  diary_reminder: { title: "일기 리마인더", body: "오늘의 순간을 일기로 남겨보세요." },
  reminder: { title: "리마인더", body: "예정된 돌봄 일정을 확인해 주세요." },
  event: { title: "다가오는 일정", body: "예정된 접종·검진·일정을 확인해 주세요." },
  test: { title: "Darin 알림 테스트", body: "알림이 정상적으로 연결됐어요." },
};

function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function inQuietHours(now: Date, timezone: string, start: string, end: string): boolean {
  try {
    const hm = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const current = Number(hm.replace(":", ""));
    const from = Number(start.slice(0, 5).replace(":", ""));
    const to = Number(end.slice(0, 5).replace(":", ""));
    return from <= to ? current >= from && current < to : current >= from || current < to;
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json(200, { ok: true });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json(500, { error: "Server configuration missing" });

  const authHeader = request.headers.get("authorization") ?? "";
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json(401, { error: "Unauthorized" });

  let body: RequestBody;
  try { body = await request.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  if (!body.babyId || !COPY[body.eventType]) return json(400, { error: "Invalid notification request" });

  const service = createClient(url, serviceKey);
  const { data: actorMembership } = await service.from("baby_members").select("permission_role,status")
    .eq("baby_id", body.babyId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  if (!actorMembership) return json(403, { error: "Baby membership required" });

  let recipientIds: string[] = [];
  if (body.action === "sendToUser") {
    if (!body.recipientId) return json(400, { error: "recipientId required" });
    const { data: target } = await service.from("baby_members").select("user_id")
      .eq("baby_id", body.babyId).eq("user_id", body.recipientId).eq("status", "active").maybeSingle();
    if (!target) return json(403, { error: "Recipient is not an active member" });
    recipientIds = [body.recipientId];
  } else {
    const { data: members, error } = await service.from("baby_members").select("user_id,permission_role")
      .eq("baby_id", body.babyId).eq("status", "active");
    if (error) return json(500, { error: error.message });
    recipientIds = (members ?? [])
      .filter((member) => member.user_id !== auth.user.id)
      .filter((member) => body.eventType !== "family_joined" || member.permission_role === "admin")
      .map((member) => member.user_id);
  }

  const copy = COPY[body.eventType];
  const results: Array<{ recipientId: string; status: string }> = [];
  for (const recipientId of recipientIds) {
    const { data: settings } = await service.from("notification_settings").select("*")
      .eq("user_id", recipientId).eq("baby_id", body.babyId).maybeSingle();
    const enabled = body.eventType === "family_joined"
      ? settings?.invite_activity_enabled !== false
      : settings?.family_activity_enabled !== false;
    const quiet = settings?.quiet_hours_enabled === true && inQuietHours(
      new Date(), settings.timezone, settings.quiet_hours_start, settings.quiet_hours_end,
    );
    const fiveMinuteBucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const dedupeKey = `${body.eventType}:${body.targetId ?? "none"}:${auth.user.id}:${fiveMinuteBucket}`;
    const eventBody = settings?.show_preview === false ? "Darin에서 새 소식을 확인해보세요." : copy.body;
    const { data: event, error: eventError } = await service.from("notification_events").insert({
      recipient_id: recipientId, actor_id: auth.user.id, baby_id: body.babyId,
      event_type: body.eventType, title: copy.title, body: eventBody,
      data: body.routeData ?? {}, dedupe_key: dedupeKey,
      status: enabled && !quiet ? "pending" : "skipped",
    }).select("id").single();
    if (eventError) {
      if (eventError.code === "23505") results.push({ recipientId, status: "deduplicated" });
      else results.push({ recipientId, status: "failed" });
      continue;
    }
    if (!enabled || quiet) { results.push({ recipientId, status: "skipped" }); continue; }

    const { data: tokens } = await service.from("push_tokens").select("id,expo_push_token")
      .eq("user_id", recipientId).is("disabled_at", null);
    if (!tokens?.length) {
      await service.from("notification_events").update({ status: "skipped", error_message: "no_active_token" }).eq("id", event.id);
      results.push({ recipientId, status: "skipped" });
      continue;
    }

    const messages = tokens.filter((token) => /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token.expo_push_token)).map((token) => ({
      to: token.expo_push_token, sound: "default", title: copy.title, body: eventBody,
      data: { ...(body.routeData ?? {}), eventId: event.id },
    }));
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(messages),
      });
      const payload = await response.json();
      const receipts = Array.isArray(payload?.data) ? payload.data : [payload?.data];
      for (let index = 0; index < receipts.length; index += 1) {
        if (receipts[index]?.details?.error === "DeviceNotRegistered" && tokens[index]) {
          await service.from("push_tokens").update({ disabled_at: new Date().toISOString() }).eq("id", tokens[index].id);
        }
      }
      const ok = response.ok && receipts.some((receipt: { status?: string }) => receipt?.status === "ok");
      await service.from("notification_events").update(ok
        ? { status: "sent", sent_at: new Date().toISOString(), error_message: null }
        : { status: "failed", error_message: "expo_push_rejected" }).eq("id", event.id);
      results.push({ recipientId, status: ok ? "sent" : "failed" });
    } catch (error) {
      await service.from("notification_events").update({ status: "failed", error_message: String(error) }).eq("id", event.id);
      results.push({ recipientId, status: "failed" });
    }
  }
  return json(200, { ok: true, results });
});
