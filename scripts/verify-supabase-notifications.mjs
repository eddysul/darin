/** Live Phase 4 Push Notifications tables, RLS, Edge Function and token-disable QA. */
import { cleanupQaAccounts, createQaAccounts } from "./lib/qa-auth.mjs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) throw new Error("Missing Supabase public client environment variables.");

const lines = [];
const pass = (message) => lines.push(`PASS  ${message}`);
const fail = (message) => lines.push(`FAIL  ${message}`);
const [actor, recipient, outsider] = await createQaAccounts([
  "notifications-actor", "notifications-recipient", "notifications-outsider",
]);
let babyId = null;

try {
  const { error: tableError } = await actor.sb.from("push_tokens").select("id").limit(1);
  if (tableError) throw new Error(`notifications migration not applied: ${tableError.message}`);
  pass("notification tables reachable");

  const { data: baby, error: babyError } = await actor.sb.rpc("create_baby_with_owner", {
    p_name: `알림QA-${Date.now()}`, p_child_status: "newborn", p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error(`baby create: ${babyError?.message ?? "no baby"}`);
  babyId = baby.id;
  const { error: memberError } = await actor.sb.from("baby_members").insert({
    baby_id: babyId, user_id: recipient.user.id, permission_role: "viewer", relationship_label: "가족", status: "active",
  });
  if (memberError) throw new Error(`member setup: ${memberError.message}`);

  const fakeToken = `ExponentPushToken[QA${crypto.randomUUID().replaceAll("-", "")}]`;
  const { data: token, error: tokenError } = await recipient.sb.from("push_tokens").insert({
    user_id: recipient.user.id, device_id: `qa-${crypto.randomUUID()}`, expo_push_token: fakeToken, platform: "ios",
  }).select("*").single();
  if (tokenError || !token) throw new Error(`own token insert: ${tokenError?.message ?? "no row"}`);
  const { data: actorTokenView, error: actorTokenError } = await actor.sb.from("push_tokens").select("id").eq("id", token.id);
  if (actorTokenError || actorTokenView?.length) throw new Error("another user read recipient token");
  pass("push token own CRUD allowed and cross-user read blocked");

  const { data: settings, error: settingsError } = await recipient.sb.from("notification_settings").insert({
    user_id: recipient.user.id, baby_id: babyId, diary_reminder_enabled: true,
    diary_reminder_time: "20:30:00", timezone: "America/Los_Angeles",
  }).select("*").single();
  if (settingsError || !settings) throw new Error(`settings insert: ${settingsError?.message ?? "no row"}`);
  const { error: outsiderSettingsError } = await outsider.sb.from("notification_settings").insert({
    user_id: outsider.user.id, baby_id: babyId,
  });
  if (!outsiderSettingsError) throw new Error("non-member settings insert unexpectedly allowed");
  const { data: actorSettings } = await actor.sb.from("notification_settings").select("id").eq("id", settings.id);
  if (actorSettings?.length) throw new Error("another user read recipient settings");
  const { data: updatedSettings, error: updateSettingsError } = await recipient.sb.from("notification_settings")
    .update({ family_activity_enabled: false, show_preview: false }).eq("id", settings.id).select("*").single();
  if (updateSettingsError || updatedSettings?.show_preview !== false) throw new Error("own settings update failed");
  pass("settings own read/update allowed; cross-user and non-member access blocked");

  const { error: clientEventError } = await recipient.sb.from("notification_events").insert({
    recipient_id: recipient.user.id, actor_id: actor.user.id, baby_id: babyId,
    event_type: "test", title: "blocked",
  });
  if (!clientEventError) throw new Error("client notification event insert unexpectedly allowed");
  pass("client event insert blocked");

  const disabledSettingTarget = `setting-off-${Date.now()}`;
  const { error: disabledSettingInvokeError } = await actor.sb.functions.invoke("send-push-notification", { body: {
    action: "sendToBabyMembers", eventType: "memory_comment", babyId,
    targetId: disabledSettingTarget, routeData: { route: "memory", memoryPostId: crypto.randomUUID(), babyId },
  }});
  if (disabledSettingInvokeError) throw new Error(`disabled setting invoke: ${disabledSettingInvokeError.message}`);
  const { data: disabledSettingEvent } = await recipient.sb.from("notification_events")
    .select("status,error_message").eq("baby_id", babyId).eq("event_type", "memory_comment").single();
  if (disabledSettingEvent?.status !== "skipped") throw new Error("family activity disabled did not skip delivery");
  pass("disabled family setting skips delivery");

  const { error: enableSettingsError } = await recipient.sb.from("notification_settings")
    .update({ family_activity_enabled: true }).eq("id", settings.id);
  if (enableSettingsError) throw new Error(`settings re-enable: ${enableSettingsError.message}`);
  const { error: reactionInvokeError } = await actor.sb.functions.invoke("send-push-notification", { body: {
    action: "sendToBabyMembers", eventType: "memory_reaction", babyId,
    targetId: `reaction-${Date.now()}`, routeData: { route: "memory", memoryPostId: crypto.randomUUID(), babyId },
  }});
  if (reactionInvokeError) throw new Error(`reaction invoke: ${reactionInvokeError.message}`);
  const { data: reactionEvent, error: eventReadError } = await recipient.sb.from("notification_events")
    .select("id,status,event_type,data").eq("baby_id", babyId).eq("event_type", "memory_reaction").single();
  if (eventReadError || !reactionEvent) throw new Error(`recipient event read: ${eventReadError?.message ?? "no event"}`);
  const { data: actorSelfEvents } = await actor.sb.from("notification_events").select("id").eq("baby_id", babyId)
    .eq("event_type", "memory_reaction");
  if (actorSelfEvents?.length) throw new Error("actor received self notification");
  pass("Edge Function event created; recipient read allowed and self notification skipped");

  const summaryTarget = `daily-summary-${Date.now()}`;
  const { error: summaryInvokeError } = await actor.sb.functions.invoke("send-push-notification", { body: {
    action: "sendToBabyMembers", eventType: "daily_summary", babyId,
    targetId: summaryTarget, routeData: { route: "report", babyId },
  }});
  if (summaryInvokeError) throw new Error(`daily summary invoke: ${summaryInvokeError.message}`);
  const { data: summaryEvent, error: summaryReadError } = await recipient.sb.from("notification_events")
    .select("id,event_type,data,read_at").eq("baby_id", babyId).eq("event_type", "daily_summary").single();
  if (summaryReadError || !summaryEvent || summaryEvent.data?.route !== "report") {
    throw new Error(`daily summary event contract failed: ${summaryReadError?.message ?? "invalid route data"}`);
  }
  const { error: markReadError } = await recipient.sb.rpc("mark_notification_event_read", { p_event_id: summaryEvent.id });
  if (markReadError) throw new Error(`mark notification read: ${markReadError.message}`);
  const { data: readSummary } = await recipient.sb.from("notification_events")
    .select("read_at").eq("id", summaryEvent.id).single();
  if (!readSummary?.read_at) throw new Error("recipient could not mark own notification read");
  pass("summary event route and recipient-only read state work");

  const { data: outsiderEvents, error: outsiderReadError } = await outsider.sb.from("notification_events").select("id").eq("baby_id", babyId);
  if (outsiderReadError || outsiderEvents?.length) throw new Error("outsider read recipient event");
  pass("non-recipient event read blocked");

  const { error: disableError } = await recipient.sb.from("push_tokens").update({ disabled_at: new Date().toISOString() }).eq("id", token.id);
  if (disableError) throw new Error(`token disable: ${disableError.message}`);
  const { error: disabledTokenInvokeError } = await actor.sb.functions.invoke("send-push-notification", { body: {
    action: "sendToBabyMembers", eventType: "growth_book_comment", babyId,
    targetId: `growth-${Date.now()}`, routeData: { route: "growth_book", growthBookId: crypto.randomUUID(), babyId },
  }});
  if (disabledTokenInvokeError) throw new Error(`disabled token invoke: ${disabledTokenInvokeError.message}`);
  const { data: disabledTokenEvent } = await recipient.sb.from("notification_events")
    .select("status,error_message").eq("baby_id", babyId).eq("event_type", "growth_book_comment").single();
  if (disabledTokenEvent?.status !== "skipped" || disabledTokenEvent.error_message !== "no_active_token") {
    throw new Error("disabled token was not excluded from delivery");
  }
  pass("invalid/logout token disable persists and disabled token is excluded");

  const { error: joinedInvokeError } = await recipient.sb.functions.invoke("send-push-notification", { body: {
    action: "sendToBabyMembers", eventType: "family_joined", babyId,
    targetId: recipient.user.id, routeData: { route: "family", babyId },
  }});
  if (joinedInvokeError) throw new Error(`family joined invoke: ${joinedInvokeError.message}`);
  const { data: joinedEvents } = await actor.sb.from("notification_events").select("id").eq("baby_id", babyId)
    .eq("event_type", "family_joined");
  if (joinedEvents?.length !== 1) throw new Error("family joined event did not reach admin");
  pass("family joined notification targets active admin");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (babyId) await actor.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts([actor, recipient, outsider]);
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
