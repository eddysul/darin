import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";
import { assertQaProjectRef } from "./lib/qa-project-config.mjs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !publicKey) throw new Error("QA Supabase client environment missing");
assertQaProjectRef(url, "notification QA URL");

const accounts = await createQaAccounts(["b04c-owner", "b04c-recipient", "b04c-outsider"]);
const [owner, recipient, outsider] = accounts;
const service = createAdminClient();
let babyId;
const marker = crypto.randomUUID();
const installationSecret = `${crypto.randomUUID()}${crypto.randomUUID()}`;
const attackerSecret = `${crypto.randomUUID()}${crypto.randomUUID()}`;
const token = `ExpoPushToken[QA${crypto.randomUUID().replaceAll("-", "")}]`;
const results = [];
const pass = (name) => results.push(`PASS ${name}`);

async function invoke(account, payload) {
  const { data } = await account.sb.auth.getSession();
  if (!data.session) throw new Error("QA session missing");
  const response = await fetch(`${url}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: { apikey: publicKey, Authorization: `Bearer ${data.session.access_token}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function createDiary(suffix) {
  const id = crypto.randomUUID();
  const { error } = await owner.sb.from("diary_entries").insert({
    id, baby_id: babyId, author_id: owner.user.id,
    entry_date: new Date().toISOString().slice(0, 10),
    body: `Synthetic B0.4c ${suffix}`, client_generated_id: id,
  });
  if (error) throw new Error(`QA diary fixture failed: ${error.code ?? "unknown"}`);
  return id;
}

try {
  const { data: baby, error: babyError } = await owner.sb.rpc("create_baby_with_owner", {
    p_name: `B0.4c QA ${marker.slice(0, 8)}`, p_child_status: "newborn", p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error("QA baby fixture failed");
  babyId = baby.id;
  const { error: memberError } = await owner.sb.from("baby_members").insert({
    baby_id: babyId, user_id: recipient.user.id, permission_role: "viewer", relationship_label: "가족", status: "active",
  });
  if (memberError) throw new Error("QA member fixture failed");

  const deniedEvents = [
    { action: "sendToBabyMembers", eventType: "family_joined", babyId, targetId: crypto.randomUUID() },
    { action: "sendToUser", eventType: "test", babyId, recipientId: outsider.user.id, targetId: crypto.randomUUID() },
    { action: "sendToBabyMembers", eventType: "new_diary", babyId, targetId: crypto.randomUUID(), actorId: outsider.user.id },
  ];
  for (const input of deniedEvents) {
    const result = await invoke(owner, input);
    if (result.status !== 403) throw new Error(`arbitrary notification accepted: HTTP ${result.status}`);
  }
  pass("server-like type, arbitrary recipient and missing resource rejected");

  const { error: directTokenError } = await recipient.sb.from("push_tokens").insert({
    user_id: recipient.user.id, device_id: `direct-${marker}`, expo_push_token: token, platform: "ios",
  });
  if (!directTokenError) throw new Error("direct authenticated token write succeeded");
  const register = (account, deviceId, secret, expoToken = token) => account.sb.rpc("register_current_push_token", {
    p_device_id: deviceId, p_installation_secret: secret,
    p_expo_push_token: expoToken, p_platform: "ios",
  });
  const deviceId = `qa-b04c-${marker}`;
  if ((await register(recipient, deviceId, installationSecret)).error) throw new Error("recipient token registration failed");
  if (!(await register(outsider, deviceId, attackerSecret)).error) throw new Error("known token/device takeover succeeded");
  if ((await register(outsider, deviceId, installationSecret)).error) throw new Error("same-installation account transfer failed");
  if ((await register(recipient, deviceId, installationSecret)).error) throw new Error("token return to recipient failed");
  pass("token RPC ownership, known-token attack and account switch");

  const { error: settingError } = await recipient.sb.from("notification_settings").insert({
    user_id: recipient.user.id, baby_id: babyId, family_activity_enabled: false,
  });
  if (settingError) throw new Error("notification setting fixture failed");
  const quietDiaryId = await createDiary("disabled");
  const disabled = await invoke(owner, { action: "sendToBabyMembers", eventType: "new_diary", babyId,
    targetId: quietDiaryId, actorId: outsider.user.id, recipientId: outsider.user.id,
    routeData: { route: "memory", memoryPostId: crypto.randomUUID(), secret: "must-not-pass" } });
  if (disabled.status !== 200) throw new Error(`disabled notification HTTP ${disabled.status}`);
  const { data: disabledEvent, error: disabledEventError } = await recipient.sb.from("notification_events")
    .select("actor_id,status,attempt_count,data,body").eq("dedupe_key", `new_diary:${quietDiaryId}:${owner.user.id}`).single();
  if (disabledEventError || disabledEvent?.status !== "skipped" || disabledEvent.attempt_count !== 0
      || disabledEvent.actor_id !== owner.user.id || disabledEvent.data?.route !== "diary"
      || JSON.stringify(disabledEvent).includes("must-not-pass")) throw new Error("server actor/payload or setting suppression mismatch");
  pass("actor and payload are server-owned; disabled setting suppresses provider dispatch");

  const { error: enableError } = await recipient.sb.from("notification_settings")
    .update({ family_activity_enabled: true }).eq("baby_id", babyId).eq("user_id", recipient.user.id);
  if (enableError) throw new Error("notification setting enable failed");
  const liveDiaryId = await createDiary("provider-fake-token");
  const livePayload = { action: "sendToBabyMembers", eventType: "new_diary", babyId, targetId: liveDiaryId };
  const first = await invoke(owner, livePayload);
  if (first.status !== 200) throw new Error(`synthetic provider path HTTP ${first.status}`);
  const { data: event, error: eventError } = await recipient.sb.from("notification_events")
    .select("id,status,attempt_count,body,data,error_message").eq("dedupe_key", `new_diary:${liveDiaryId}:${owner.user.id}`).single();
  if (eventError || event?.attempt_count !== 1 || !["sent", "failed"].includes(event.status)
      || event.body.includes("Synthetic B0.4c") || JSON.stringify(event.data).includes("Synthetic B0.4c")) {
    throw new Error("synthetic provider dispatch or privacy contract failed");
  }
  const repeat = await invoke(owner, livePayload);
  if (repeat.status !== 200 || repeat.body?.results?.[0]?.status !== "deduplicated") throw new Error("replay was not deduplicated");
  pass("synthetic Expo-token dispatch claimed once; replay deduplicated; no private text");

  const { error: revokeError } = await recipient.sb.rpc("unregister_current_push_token", { p_device_id: deviceId });
  if (revokeError) throw new Error("token revoke failed");
  const { data: revokedToken } = await recipient.sb.from("push_tokens")
    .select("disabled_at").eq("device_id", deviceId).single();
  if (!revokedToken?.disabled_at) throw new Error("revoked token stayed active");
  pass("authenticated per-device token revocation");

  const { data: post, error: postError } = await service.from("memory_posts").insert({
    baby_id: babyId, author_id: owner.user.id, caption: "Synthetic QA memory",
    privacy_type: "family_circle", status: "published",
  }).select("id").single();
  if (postError || !post) throw new Error(`QA Memory fixture failed: ${postError?.code ?? "empty"} ${postError?.message ?? ""}`);
  const { data: currentWriteRole, error: roleError } = await owner.sb.rpc("current_baby_write_permission", { p_baby_id: babyId });
  const { data: canViewPost, error: viewError } = await owner.sb.rpc("can_view_memory_post", { p_memory_post_id: post.id });
  if (roleError || viewError || currentWriteRole !== "admin" || canViewPost !== true) {
    throw new Error("QA owner lost current Memory write/view authority");
  }
  const { data: comment, error: commentError } = await service.from("memory_comments").insert({
    memory_post_id: post.id, author_id: owner.user.id, body: "Synthetic QA comment",
  }).select("id").single();
  if (commentError || !comment) throw new Error("QA comment fixture failed");
  const memory = await invoke(owner, { action: "sendToBabyMembers", eventType: "memory_comment", babyId, targetId: comment.id });
  if (memory.status !== 200) throw new Error(`valid Memory notification HTTP ${memory.status}`);
  const { data: memoryEvent } = await recipient.sb.from("notification_events").select("id")
    .eq("dedupe_key", `memory_comment:${comment.id}:${owner.user.id}`).single();
  if (!memoryEvent) throw new Error("valid Memory notification missing");
  const { error: privacyError } = await owner.sb.from("memory_posts").update({ privacy_type: "only_me" }).eq("id", post.id);
  if (privacyError) throw new Error(`QA Memory privacy downgrade failed: ${privacyError.code ?? "unknown"} ${privacyError.message ?? ""}`);
  const { data: staleEvents } = await recipient.sb.from("notification_events").select("id").eq("id", memoryEvent.id);
  if (staleEvents?.length) throw new Error("visibility-downgraded Memory notification remained in inbox");
  pass("Memory notification follows current visibility in inbox");

  const deletedDiaryId = await createDiary("deleted");
  const { error: deleteError } = await owner.sb.rpc("soft_delete_diary_entry", { p_diary_entry_id: deletedDiaryId });
  if (deleteError) throw new Error(`QA diary soft-delete failed: ${deleteError.code ?? "unknown"}`);
  if ((await invoke(owner, { action: "sendToBabyMembers", eventType: "new_diary", babyId, targetId: deletedDiaryId })).status !== 403) {
    throw new Error("deleted diary notification accepted");
  }
  pass("deleted resource notification rejected");

  const { error: removeError } = await owner.sb.from("baby_members")
    .delete().eq("baby_id", babyId).eq("user_id", recipient.user.id);
  if (removeError) throw new Error("QA member removal failed");
  const removedDiaryId = await createDiary("removed-member");
  const removed = await invoke(owner, { action: "sendToBabyMembers", eventType: "new_diary", babyId, targetId: removedDiaryId });
  if (removed.status !== 200 || removed.body?.results?.some((item) => item.recipientId === recipient.user.id)) {
    throw new Error("removed recipient included in dispatch");
  }
  const { data: removedInbox } = await recipient.sb.from("notification_events").select("id").eq("id", event.id);
  if (removedInbox?.length) throw new Error("removed member retained prior diary notification");
  pass("removed member excluded from dispatch and prior inbox");
} catch (error) {
  console.log(results.join("\n"));
  throw error;
} finally {
  if (babyId) await owner.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts(accounts);
}

console.log(results.join("\n"));
console.log(`B0.4c QA synthetic notification regression: ${results.length} PASS`);
