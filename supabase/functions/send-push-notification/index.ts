import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  inQuietHours,
  isExpoPushToken,
  localeFor,
  sendExpoPush,
  type SupportedLocale,
} from "../_shared/notificationRuntime.ts";
import {
  canActorInteractWithMemory,
  dedupeRecipients,
  deriveMemoryRecipients,
  isClientEventType,
  isFreshResource,
  isUuid,
  providerFailureCode,
  safeRouteData,
  type ClientEventType,
} from "./securityPolicy.ts";

type EventType =
  | "memory_comment" | "memory_reaction" | "growth_book_comment"
  | "growth_book_rolling_paper" | "family_joined" | "invite_request"
  | "invite_declined"
  | "new_shared_log" | "new_diary" | "daily_summary" | "weekly_summary"
  | "diary_reminder" | "reminder" | "event" | "test";

type RequestBody = {
  action: "sendToBabyMembers" | "sendToUser" | "sendInviteResponse";
  eventType?: unknown;
  babyId?: string;
  recipientId?: string;
  targetId?: string;
};

type ServiceClient = ReturnType<typeof createClient>;
type DispatchSpec = {
  eventType: ClientEventType;
  babyId: string;
  targetId: string;
  actorId: string;
  recipientIds: string[];
  routeData: Record<string, string>;
  createdAt: string;
};

type Copy = { title: string; body: string; privateBody?: string };
const NOTIFICATION_SETTINGS_COLUMNS = [
  "invite_activity_enabled",
  "family_activity_enabled",
  "quiet_hours_enabled",
  "quiet_hours_start",
  "quiet_hours_end",
  "timezone",
  "show_preview",
].join(",");

const COPY: Record<SupportedLocale, Record<EventType, Copy>> = {
  ko: {
    memory_comment: { title: "새 댓글", body: "공유한 추억에 새 댓글이 달렸어요." }, memory_reaction: { title: "새 반응", body: "공유한 추억에 새 반응이 도착했어요." },
    growth_book_comment: { title: "성장책 새 코멘트", body: "성장책에 새 코멘트가 도착했어요." }, growth_book_rolling_paper: { title: "성장책 새 메시지", body: "성장책에 새 메시지가 도착했어요." },
    family_joined: { title: "공유 요청이 수락됐어요", body: "요청한 사용자가 공유에 참여했어요." }, invite_request: { title: "새 공유 요청", body: "새 가족 또는 친구 공유 요청이 도착했어요." },
    invite_declined: { title: "공유 요청이 수락되지 않았어요", body: "필요하면 새 요청을 보낼 수 있어요." }, new_shared_log: { title: "새 공유 기록", body: "가족이 새로운 돌봄 기록을 남겼어요." },
    new_diary: { title: "새 일기", body: "가족이 새로운 일기를 남겼어요." }, daily_summary: { title: "오늘의 요약", body: "오늘의 돌봄 기록 요약을 확인해 보세요." },
    weekly_summary: { title: "이번 주 요약", body: "이번 주 기록 요약을 확인해 보세요." }, diary_reminder: { title: "일기 리마인더", body: "오늘의 순간을 일기로 남겨보세요." },
    reminder: { title: "기록 리마인더", body: "최근 기록을 확인해볼 시간이에요." }, event: { title: "다가오는 일정", body: "예정된 일정을 확인해 주세요." },
    test: { title: "Darin 알림 테스트", body: "알림이 정상적으로 연결됐어요." },
  },
  en: {
    memory_comment: { title: "New comment", body: "Someone commented on a shared memory." }, memory_reaction: { title: "New reaction", body: "A shared memory received a new reaction." },
    growth_book_comment: { title: "New growth book comment", body: "A new comment was added to the growth book." }, growth_book_rolling_paper: { title: "New growth book message", body: "A new message was added to the growth book." },
    family_joined: { title: "Sharing request accepted", body: "The invited person joined the shared space." }, invite_request: { title: "New sharing request", body: "A new family or friend sharing request arrived." },
    invite_declined: { title: "Sharing request not accepted", body: "You can send a new request if needed." }, new_shared_log: { title: "New shared log", body: "A caregiver added a new care log." },
    new_diary: { title: "New diary entry", body: "A family member added a new diary entry." }, daily_summary: { title: "Today's summary", body: "Review today's care log summary." },
    weekly_summary: { title: "This week's summary", body: "Review this week's log summary." }, diary_reminder: { title: "Diary reminder", body: "Save a moment from today in the diary." },
    reminder: { title: "Log reminder", body: "It may be time to review the recent log." }, event: { title: "Upcoming event", body: "Review the upcoming event." },
    test: { title: "Darin notification test", body: "Notifications are connected correctly." },
  },
  ja: {
    memory_comment: { title: "新しいコメント", body: "共有した思い出にコメントが届きました。" }, memory_reaction: { title: "新しいリアクション", body: "共有した思い出にリアクションが届きました。" },
    growth_book_comment: { title: "成長ブックの新しいコメント", body: "成長ブックにコメントが届きました。" }, growth_book_rolling_paper: { title: "成長ブックの新しいメッセージ", body: "成長ブックにメッセージが届きました。" },
    family_joined: { title: "共有リクエストが承認されました", body: "招待したユーザーが共有に参加しました。" }, invite_request: { title: "新しい共有リクエスト", body: "家族または友だちから共有リクエストが届きました。" },
    invite_declined: { title: "共有リクエストは承認されませんでした", body: "必要に応じて新しいリクエストを送れます。" }, new_shared_log: { title: "新しい共有記録", body: "家族が新しいケア記録を追加しました。" },
    new_diary: { title: "新しい日記", body: "家族が新しい日記を追加しました。" }, daily_summary: { title: "今日のまとめ", body: "今日のケア記録を確認しましょう。" },
    weekly_summary: { title: "今週のまとめ", body: "今週の記録を確認しましょう。" }, diary_reminder: { title: "日記リマインダー", body: "今日の思い出を日記に残しましょう。" },
    reminder: { title: "記録リマインダー", body: "最近の記録を確認する時間です。" }, event: { title: "今後の予定", body: "予定を確認してください。" },
    test: { title: "Darin通知テスト", body: "通知は正常に接続されています。" },
  },
  es: {
    memory_comment: { title: "Nuevo comentario", body: "Hay un comentario nuevo en un recuerdo compartido." }, memory_reaction: { title: "Nueva reacción", body: "Un recuerdo compartido recibió una reacción." },
    growth_book_comment: { title: "Nuevo comentario en el libro de crecimiento", body: "Se añadió un comentario al libro de crecimiento." }, growth_book_rolling_paper: { title: "Nuevo mensaje en el libro de crecimiento", body: "Se añadió un mensaje al libro de crecimiento." },
    family_joined: { title: "Solicitud compartida aceptada", body: "La persona invitada se unió al espacio compartido." }, invite_request: { title: "Nueva solicitud para compartir", body: "Llegó una solicitud de un familiar o amigo." },
    invite_declined: { title: "Solicitud no aceptada", body: "Puedes enviar otra solicitud si lo necesitas." }, new_shared_log: { title: "Nuevo registro compartido", body: "Un familiar añadió un registro de cuidados." },
    new_diary: { title: "Nueva entrada del diario", body: "Un familiar añadió una entrada del diario." }, daily_summary: { title: "Resumen de hoy", body: "Consulta el resumen de cuidados de hoy." },
    weekly_summary: { title: "Resumen semanal", body: "Consulta el resumen de registros de esta semana." }, diary_reminder: { title: "Recordatorio del diario", body: "Guarda un momento de hoy en el diario." },
    reminder: { title: "Recordatorio de registro", body: "Puede ser un buen momento para revisar el registro reciente." }, event: { title: "Próximo evento", body: "Consulta el próximo evento." },
    test: { title: "Prueba de notificaciones de Darin", body: "Las notificaciones están conectadas correctamente." },
  },
  "zh-CN": {
    memory_comment: { title: "新评论", body: "共享回忆收到了新评论。" }, memory_reaction: { title: "新互动", body: "共享回忆收到了新互动。" },
    growth_book_comment: { title: "成长册新评论", body: "成长册收到了新评论。" }, growth_book_rolling_paper: { title: "成长册新留言", body: "成长册收到了新留言。" },
    family_joined: { title: "共享请求已接受", body: "受邀用户已加入共享空间。" }, invite_request: { title: "新的共享请求", body: "收到了家人或朋友的共享请求。" },
    invite_declined: { title: "共享请求未被接受", body: "如有需要，可以重新发送请求。" }, new_shared_log: { title: "新共享记录", body: "家人添加了一条新的照护记录。" },
    new_diary: { title: "新日记", body: "家人添加了一篇新日记。" }, daily_summary: { title: "今日摘要", body: "请查看今天的照护记录摘要。" },
    weekly_summary: { title: "本周摘要", body: "请查看本周记录摘要。" }, diary_reminder: { title: "日记提醒", body: "把今天的瞬间记录在日记中吧。" },
    reminder: { title: "记录提醒", body: "可以查看一下最近的记录。" }, event: { title: "即将到来的日程", body: "请查看即将到来的日程。" },
    test: { title: "Darin通知测试", body: "通知已正常连接。" },
  },
};

const PRIVATE_BODY: Record<SupportedLocale, string> = {
  ko: "새로운 알림이 있습니다.",
  en: "You have a new notification.",
  ja: "新しい通知があります。",
  es: "Tienes una notificación nueva.",
  "zh-CN": "你有一条新通知。",
};

function json(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

async function activeMembers(service: ServiceClient, babyId: string): Promise<Array<{ user_id: string; permission_role: string }>> {
  const { data, error } = await service.from("baby_members").select("user_id,permission_role")
    .eq("baby_id", babyId).eq("status", "active");
  if (error) throw error;
  return data ?? [];
}

async function resolveMemoryRecipients(
  service: ServiceClient,
  post: { id: string; baby_id: string; author_id: string; privacy_type: string; status: string; deleted_at: string | null },
  actorId: string,
): Promise<string[] | null> {
  if (post.status !== "published" || post.deleted_at) return null;
  const [members, friendsResult] = await Promise.all([
    activeMembers(service, post.baby_id),
    service.from("memory_friends").select("user_id").eq("baby_id", post.baby_id).eq("status", "active"),
  ]);
  if (friendsResult.error) throw friendsResult.error;
  const memberIds = members.map((row) => row.user_id);
  const editorIds = members.filter((row) => row.permission_role === "admin" || row.permission_role === "editor").map((row) => row.user_id);
  const friendIds = (friendsResult.data ?? []).map((row) => row.user_id);
  const [tagged, selected] = await Promise.all([
    service.from("memory_tags").select("tagged_user_id").eq("memory_post_id", post.id)
      .eq("tag_type", "family_member").eq("status", "approved"),
    service.from("memory_selected_people").select("user_id").eq("memory_post_id", post.id),
  ]);
  if (tagged.error || selected.error) throw tagged.error ?? selected.error;
  const audience = {
    privacyType: post.privacy_type,
    postAuthorId: post.author_id,
    memberIds,
    editorIds,
    friendIds,
    taggedIds: (tagged.data ?? []).map((row) => row.tagged_user_id),
    selectedIds: (selected.data ?? []).map((row) => row.user_id),
  };
  if (!canActorInteractWithMemory(audience, actorId)) return null;
  return deriveMemoryRecipients(audience, actorId);
}

async function resolveClientDispatch(
  service: ServiceClient,
  actorId: string,
  body: RequestBody,
): Promise<DispatchSpec | null> {
  if (!isClientEventType(body.eventType) || !isUuid(body.babyId) || !isUuid(body.targetId)) return null;
  const eventType = body.eventType;
  if (eventType === "test") {
    if (body.action !== "sendToUser" || body.recipientId !== actorId) return null;
    const members = await activeMembers(service, body.babyId);
    if (!members.some((row) => row.user_id === actorId)) return null;
    return {
      eventType, babyId: body.babyId, targetId: body.targetId, actorId,
      recipientIds: [actorId], routeData: safeRouteData(eventType, { babyId: body.babyId, targetId: body.targetId }),
      createdAt: new Date().toISOString(),
    };
  }
  if (body.action !== "sendToBabyMembers") return null;

  if (eventType === "new_shared_log") {
    const { data } = await service.from("care_logs").select("id,baby_id,created_by,created_at")
      .eq("id", body.targetId).eq("baby_id", body.babyId).maybeSingle();
    const members = await activeMembers(service, body.babyId);
    if (!data || data.created_by !== actorId || !members.some((row) => row.user_id === actorId && ["admin", "editor"].includes(row.permission_role))) return null;
    return { eventType, babyId: data.baby_id, targetId: data.id, actorId,
      recipientIds: dedupeRecipients(members.map((row) => row.user_id), actorId),
      routeData: safeRouteData(eventType, { babyId: data.baby_id, targetId: data.id }), createdAt: data.created_at };
  }
  if (eventType === "new_diary") {
    const { data } = await service.from("diary_entries").select("id,baby_id,author_id,created_at,deleted_at")
      .eq("id", body.targetId).eq("baby_id", body.babyId).is("deleted_at", null).maybeSingle();
    const members = await activeMembers(service, body.babyId);
    if (!data || data.author_id !== actorId || !members.some((row) => row.user_id === actorId && ["admin", "editor"].includes(row.permission_role))) return null;
    return { eventType, babyId: data.baby_id, targetId: data.id, actorId,
      recipientIds: dedupeRecipients(members.map((row) => row.user_id), actorId),
      routeData: safeRouteData(eventType, { babyId: data.baby_id, targetId: data.id }), createdAt: data.created_at };
  }
  if (eventType === "growth_book_comment" || eventType === "growth_book_rolling_paper") {
    const { data } = await service.from("growth_book_comments")
      .select("id,growth_book_id,page_id,baby_id,author_id,comment_type,created_at,deleted_at")
      .eq("id", body.targetId).eq("baby_id", body.babyId).is("deleted_at", null).maybeSingle();
    const members = await activeMembers(service, body.babyId);
    const typeMatches = data && (eventType === "growth_book_rolling_paper"
      ? data.comment_type === "rolling_paper"
      : data.comment_type === "page_comment" || data.comment_type === "letter");
    if (!data || data.author_id !== actorId || !typeMatches || !members.some((row) => row.user_id === actorId)) return null;
    const { data: book } = await service.from("growth_books").select("id").eq("id", data.growth_book_id)
      .eq("baby_id", data.baby_id).is("deleted_at", null).maybeSingle();
    if (!book) return null;
    return { eventType, babyId: data.baby_id, targetId: data.id, actorId,
      recipientIds: dedupeRecipients(members.map((row) => row.user_id), actorId),
      routeData: safeRouteData(eventType, { babyId: data.baby_id, targetId: data.id, growthBookId: data.growth_book_id, pageId: data.page_id }),
      createdAt: data.created_at };
  }

  const table = eventType === "memory_comment" ? "memory_comments" : "memory_reactions";
  let query = service.from(table).select("id,memory_post_id,author_id,created_at")
    .eq("id", body.targetId).eq("author_id", actorId);
  if (eventType === "memory_comment") query = query.is("deleted_at", null);
  const { data: child } = await query.maybeSingle();
  if (!child) return null;
  const { data: post } = await service.from("memory_posts")
    .select("id,baby_id,author_id,privacy_type,status,deleted_at")
    .eq("id", child.memory_post_id).eq("baby_id", body.babyId).maybeSingle();
  if (!post) return null;
  const recipients = await resolveMemoryRecipients(service, post, actorId);
  if (!recipients) return null;
  return { eventType, babyId: post.baby_id, targetId: child.id, actorId, recipientIds: recipients,
    routeData: safeRouteData(eventType, { babyId: post.baby_id, targetId: child.id, memoryPostId: post.id }),
    createdAt: child.created_at };
}

async function claimEvent(service: ServiceClient, eventId: string, recipientId: string): Promise<boolean> {
  const { data, error } = await service.rpc("claim_notification_event_dispatch", { p_event_id: eventId });
  if (error) throw error;
  return Array.isArray(data) && data.some((row) => row.event_id === eventId && row.recipient_id === recipientId);
}

async function sendExistingInviteResponse(
  service: ReturnType<typeof createClient>,
  actorId: string,
  requestId: string,
) {
  const { data: invite, error: inviteError } = await service.from("darin_invite_requests")
    .select("id,baby_id,sender_id,receiver_id,request_type,status")
    .eq("id", requestId).maybeSingle();
  if (inviteError) return json(500, { error: inviteError.message });
  if (!invite || invite.receiver_id !== actorId || !["accepted", "declined"].includes(invite.status)) {
    return json(403, { error: "Invite response unavailable" });
  }

  const eventType: EventType = invite.status === "accepted" ? "family_joined" : "invite_declined";
  const dedupeKey = `darin-invite-response:${invite.id}`;
  const { data: event, error: eventError } = await service.from("notification_events")
    .select("id,title,body,data,status,created_at")
    .eq("recipient_id", invite.sender_id).eq("dedupe_key", dedupeKey).maybeSingle();
  if (eventError) return json(500, { error: eventError.message });
  if (!event) return json(409, { error: "Invite response event missing" });
  if (event.status !== "pending") return json(200, { ok: true, results: [{ recipientId: invite.sender_id, status: "deduplicated" }] });

  const [settingsResult, profileResult] = await Promise.all([
    service.from("notification_settings").select(NOTIFICATION_SETTINGS_COLUMNS)
      .eq("user_id", invite.sender_id).eq("baby_id", invite.baby_id).maybeSingle(),
    service.from("profiles").select("preferred_language").eq("id", invite.sender_id).maybeSingle(),
  ]);
  if (settingsResult.error || profileResult.error) {
    await service.from("notification_events").update({
      status: "failed",
      error_message: "recipient_preferences_unavailable",
    }).eq("id", event.id);
    return json(500, { error: "Recipient preferences unavailable" });
  }
  const settings = settingsResult.data;
  const recipientProfile = profileResult.data;
  const localizedCopy = COPY[localeFor(recipientProfile?.preferred_language)][eventType];
  const enabled = settings?.invite_activity_enabled !== false;
  const quiet = settings?.quiet_hours_enabled === true && inQuietHours(
    new Date(), settings.timezone, settings.quiet_hours_start, settings.quiet_hours_end,
  );
  if (!enabled || quiet) {
    const reason = enabled ? "quiet_hours" : "invite_activity_disabled";
    await service.from("notification_events").update({ status: "skipped", error_message: reason }).eq("id", event.id);
    return json(200, { ok: true, results: [{ recipientId: invite.sender_id, status: "skipped", reason }] });
  }

  const { data: tokens, error: tokenError } = await service.from("push_tokens")
    .select("id,expo_push_token").eq("user_id", invite.sender_id).is("disabled_at", null);
  if (tokenError) return json(500, { error: tokenError.message });
  const validTokens = (tokens ?? []).filter((token) => isExpoPushToken(token.expo_push_token));
  if (!validTokens.length) {
    await service.from("notification_events").update({ status: "skipped", error_message: "no_active_token" }).eq("id", event.id);
    return json(200, { ok: true, results: [{ recipientId: invite.sender_id, status: "skipped", reason: "no_active_token" }] });
  }

  if (!isFreshResource(event.created_at, Date.now(), 24 * 60 * 60 * 1000)) {
    await service.from("notification_events").update({ status: "skipped", suppression_reason: "event_expired" }).eq("id", event.id).eq("status", "pending");
    return json(200, { ok: true, results: [{ recipientId: invite.sender_id, status: "skipped", reason: "event_expired" }] });
  }
  if (!await claimEvent(service, event.id, invite.sender_id)) {
    return json(200, { ok: true, results: [{ recipientId: invite.sender_id, status: "deduplicated" }] });
  }
  const body = settings?.show_preview === false
    ? PRIVATE_BODY[localeFor(recipientProfile?.preferred_language)]
    : localizedCopy.body;
  try {
    const pushResult = await sendExpoPush(validTokens.map((token) => ({
        to: token.expo_push_token, sound: "default", title: localizedCopy.title, body,
        data: { ...(event.data ?? {}), eventId: event.id, eventType },
    })));
    for (const index of pushResult.deviceNotRegisteredIndexes) {
      if (validTokens[index]) {
        await service.from("push_tokens").update({ disabled_at: new Date().toISOString() }).eq("id", validTokens[index].id);
      }
    }
    const ok = pushResult.successCount > 0;
    await service.from("notification_events").update(ok
      ? { status: "sent", sent_at: new Date().toISOString(), error_message: null }
      : { status: "failed", error_message: "expo_push_rejected" }).eq("id", event.id);
    return json(200, { ok: true, results: [{ recipientId: invite.sender_id, status: ok ? "sent" : "failed" }] });
  } catch (error) {
    await service.from("notification_events").update({ status: "failed", error_message: providerFailureCode() }).eq("id", event.id);
    return json(200, { ok: true, results: [{ recipientId: invite.sender_id, status: "failed" }] });
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
  if (body.action === "sendInviteResponse") {
    if (!body.targetId) return json(400, { error: "targetId required" });
    const service = createClient(url, serviceKey);
    return sendExistingInviteResponse(service, auth.user.id, body.targetId);
  }
  const service = createClient(url, serviceKey);
  let spec: DispatchSpec | null;
  try {
    spec = await resolveClientDispatch(service, auth.user.id, body);
  } catch {
    return json(500, { error: "Notification authorization unavailable" });
  }
  if (!spec || !isFreshResource(spec.createdAt)) {
    return json(403, { error: "Notification resource unavailable" });
  }

  const results: Array<{ recipientId: string; status: string }> = [];
  for (const recipientId of spec.recipientIds) {
    const [settingsResult, profileResult] = await Promise.all([
      service.from("notification_settings").select(NOTIFICATION_SETTINGS_COLUMNS)
        .eq("user_id", recipientId).eq("baby_id", spec.babyId).maybeSingle(),
      service.from("profiles").select("preferred_language").eq("id", recipientId).maybeSingle(),
    ]);
    if (settingsResult.error || profileResult.error) {
      results.push({ recipientId, status: "failed" });
      continue;
    }
    const settings = settingsResult.data;
    const recipientProfile = profileResult.data;
    const locale = localeFor(recipientProfile?.preferred_language);
    const copy = COPY[locale][spec.eventType];
    const enabled = settings?.family_activity_enabled !== false;
    const quiet = settings?.quiet_hours_enabled === true && inQuietHours(
      new Date(), settings.timezone, settings.quiet_hours_start, settings.quiet_hours_end,
    );
    const dedupeKey = `${spec.eventType}:${spec.targetId}:${auth.user.id}`;
    const eventBody = settings?.show_preview === false ? PRIVATE_BODY[locale] : copy.body;
    const { data: event, error: eventError } = await service.from("notification_events").insert({
      recipient_id: recipientId, actor_id: spec.actorId, baby_id: spec.babyId,
      event_type: spec.eventType, title: copy.title, body: eventBody,
      data: spec.routeData, dedupe_key: dedupeKey,
      status: enabled && !quiet ? "pending" : "skipped",
      suppression_reason: !enabled ? "recipient_disabled" : quiet ? "quiet_hours" : null,
    }).select("id,status").single();
    if (eventError) {
      if (eventError.code === "23505") results.push({ recipientId, status: "deduplicated" });
      else results.push({ recipientId, status: "failed" });
      continue;
    }
    if (!enabled || quiet) { results.push({ recipientId, status: "skipped" }); continue; }

    // Re-resolve actor, resource and recipients immediately before claiming the
    // provider attempt. A removed member, deleted item or visibility downgrade
    // suppresses this event instead of relying on the earlier snapshot.
    let current: DispatchSpec | null = null;
    try { current = await resolveClientDispatch(service, auth.user.id, body); } catch { /* fail closed below */ }
    if (!current || !isFreshResource(current.createdAt) || !current.recipientIds.includes(recipientId)) {
      await service.from("notification_events").update({
        status: "skipped", suppression_reason: "recipient_or_resource_stale", error_message: null,
      }).eq("id", event.id).eq("status", "pending");
      results.push({ recipientId, status: "skipped" });
      continue;
    }

    const { data: tokens, error: tokenError } = await service.from("push_tokens").select("id,expo_push_token")
      .eq("user_id", recipientId).is("disabled_at", null);
    if (tokenError) {
      await service.from("notification_events").update({
        status: "failed",
        error_message: "push_token_lookup_failed",
      }).eq("id", event.id);
      results.push({ recipientId, status: "failed" });
      continue;
    }
    if (!tokens?.length) {
      await service.from("notification_events").update({ status: "skipped", suppression_reason: "no_active_token", error_message: null }).eq("id", event.id);
      results.push({ recipientId, status: "skipped" });
      continue;
    }

    const validTokens = tokens.filter((token) => isExpoPushToken(token.expo_push_token));
    if (!validTokens.length) {
      await service.from("notification_events").update({
        status: "skipped", suppression_reason: "no_active_token", error_message: null,
      }).eq("id", event.id);
      results.push({ recipientId, status: "skipped" });
      continue;
    }
    if (!await claimEvent(service, event.id, recipientId)) {
      results.push({ recipientId, status: "deduplicated" });
      continue;
    }
    const messages = validTokens.map((token) => ({
      to: token.expo_push_token, sound: "default", title: copy.title, body: eventBody,
      data: { ...spec.routeData, eventId: event.id, eventType: spec.eventType },
    }));
    try {
      const pushResult = await sendExpoPush(messages);
      for (const index of pushResult.deviceNotRegisteredIndexes) {
        if (validTokens[index]) {
          await service.from("push_tokens").update({ disabled_at: new Date().toISOString() }).eq("id", validTokens[index].id);
        }
      }
      const ok = pushResult.successCount > 0;
      await service.from("notification_events").update(ok
        ? { status: "sent", sent_at: new Date().toISOString(), error_message: null }
        : { status: "failed", error_message: "expo_push_rejected" }).eq("id", event.id);
      results.push({ recipientId, status: ok ? "sent" : "failed" });
    } catch {
      await service.from("notification_events").update({ status: "failed", error_message: providerFailureCode() }).eq("id", event.id);
      results.push({ recipientId, status: "failed" });
    }
  }
  return json(200, { ok: true, results });
});
