/** Build 13 Darin ID invitation/RLS regression QA. Uses disposable confirmed-email accounts. */
import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";

const accounts = await createQaAccounts(["DarinIdQA-Owner", "DarinIdQA-Family", "DarinIdQA-Friend", "DarinIdQA-Outsider"]);
const [owner, family, friend, outsider] = accounts;
const admin = createAdminClient();
let babyId = null;

function assertBlocked(result, message) {
  if (!result.error) throw new Error(message);
}

try {
  for (const [index, account] of accounts.entries()) {
    const { error } = await account.sb.from("profiles").upsert({
      id: account.user.id,
      display_name: account.label,
      darin_id: `darin-qa-${index}#${1000 + index}`,
      preferred_language: "ko",
    });
    if (error) throw error;
  }

  const invalidId = await outsider.sb.from("profiles").update({ darin_id: "invalid/id#1003" }).eq("id", outsider.user.id);
  assertBlocked(invalidId, "server accepted an invalid Darin ID format");

  const created = await owner.sb.rpc("create_baby_with_owner", {
    p_name: "Darin ID QA",
    p_child_status: "newborn",
    p_relationship_label: "엄마",
  });
  if (created.error || !created.data?.id) throw created.error ?? new Error("baby creation failed");
  babyId = created.data.id;

  const unauthorized = await outsider.sb.rpc("send_darin_id_invite_request", {
    p_baby_id: babyId, p_darin_id: "darin-qa-1#1001", p_request_type: "family", p_role: "editor", p_relation: "가족",
  });
  assertBlocked(unauthorized, "non-admin sent a Darin ID request");

  const selfInvite = await owner.sb.rpc("send_darin_id_invite_request", {
    p_baby_id: babyId, p_darin_id: "darin-qa-0#1000", p_request_type: "family", p_role: "editor", p_relation: "가족",
  });
  assertBlocked(selfInvite, "owner invited self");

  const familyRequest = await owner.sb.rpc("send_darin_id_invite_request", {
    p_baby_id: babyId, p_darin_id: "darin-qa-1#1001", p_request_type: "family", p_role: "editor", p_relation: "가족",
  });
  if (familyRequest.error || !familyRequest.data?.[0]?.request_id) throw familyRequest.error ?? new Error("family request missing");
  const familyRequestId = familyRequest.data[0].request_id;

  const duplicate = await owner.sb.rpc("send_darin_id_invite_request", {
    p_baby_id: babyId, p_darin_id: "darin-qa-1#1001", p_request_type: "family", p_role: "editor", p_relation: "가족",
  });
  assertBlocked(duplicate, "duplicate pending request was accepted");

  const senderRead = await owner.sb.from("darin_invite_requests").select("id,expires_at").eq("id", familyRequestId).maybeSingle();
  const recipientRead = await family.sb.from("darin_invite_requests").select("id").eq("id", familyRequestId).maybeSingle();
  const outsiderRead = await outsider.sb.from("darin_invite_requests").select("id").eq("id", familyRequestId);
  if (senderRead.error || !senderRead.data?.expires_at) throw new Error("requester cannot read request or expires_at");
  if (recipientRead.error || recipientRead.data?.id !== familyRequestId) throw new Error("recipient cannot read request");
  if (outsiderRead.error || outsiderRead.data?.length) throw new Error("outsider read invite request");

  const directInsert = await owner.sb.from("darin_invite_requests").insert({
    baby_id: babyId, sender_id: owner.user.id, receiver_id: outsider.user.id,
    request_type: "family", permission_role: "editor", relationship_label: "가족",
  });
  assertBlocked(directInsert, "authenticated user inserted request without RPC");

  const familyEvents = await family.sb.from("notification_events").select("id,data").eq("event_type", "invite_request");
  if (familyEvents.error || !familyEvents.data?.some((event) => event.data?.requestId === familyRequestId)) {
    throw new Error("recipient did not receive invite event");
  }

  const familyAccept = await family.sb.rpc("respond_darin_id_invite_request", { p_request_id: familyRequestId, p_accept: true });
  if (familyAccept.error || familyAccept.data?.[0]?.permission_role !== "editor") throw familyAccept.error ?? new Error("family accept failed");
  const familyMember = await family.sb.from("baby_members").select("permission_role")
    .eq("baby_id", babyId).eq("user_id", family.user.id).maybeSingle();
  if (familyMember.error || familyMember.data?.permission_role !== "editor") {
    throw familyMember.error ?? new Error("family role not applied as editor");
  }
  const acceptedEvent = await owner.sb.from("notification_events").select("id").eq("event_type", "family_joined").eq("data->>requestId", familyRequestId);
  if (acceptedEvent.error || !acceptedEvent.data?.length) throw new Error("requester did not receive accepted in-app event");

  const friendRequest = await owner.sb.rpc("send_darin_id_invite_request", {
    p_baby_id: babyId, p_darin_id: "darin-qa-2#1002", p_request_type: "friend", p_role: "viewer", p_relation: "친구",
  });
  if (friendRequest.error || !friendRequest.data?.[0]?.request_id) throw friendRequest.error ?? new Error("friend request missing");
  const friendAccept = await friend.sb.rpc("respond_darin_id_invite_request", { p_request_id: friendRequest.data[0].request_id, p_accept: true });
  if (friendAccept.error) throw friendAccept.error;
  const friendConnection = await friend.sb.from("memory_friends").select("status").eq("baby_id", babyId).maybeSingle();
  if (friendConnection.error || friendConnection.data?.status !== "active") throw new Error("friend memory_friends access missing");
  const friendMembership = await friend.sb.from("baby_members").select("user_id").eq("baby_id", babyId);
  if (friendMembership.error || friendMembership.data?.length) throw new Error("friend was granted baby_members access");

  for (const table of ["care_logs", "diary_entries", "growth_records", "growth_books", "baby_caution_foods"]) {
    const result = await friend.sb.from(table).select("id").eq("baby_id", babyId);
    if (result.error || result.data?.length) throw new Error(`friend can read ${table}`);
  }

  const expiringRequest = await owner.sb.rpc("send_darin_id_invite_request", {
    p_baby_id: babyId, p_darin_id: "darin-qa-3#1003", p_request_type: "family", p_role: "editor", p_relation: "가족",
  });
  if (expiringRequest.error || !expiringRequest.data?.[0]?.request_id) throw expiringRequest.error ?? new Error("expiration request missing");
  const expiringRequestId = expiringRequest.data[0].request_id;
  const expire = await admin.from("darin_invite_requests").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", expiringRequestId);
  if (expire.error) throw expire.error;
  const expiredResponse = await outsider.sb.rpc("respond_darin_id_invite_request", { p_request_id: expiringRequestId, p_accept: true });
  assertBlocked(expiredResponse, "expired request was accepted");

  const declineRequest = await owner.sb.rpc("send_darin_id_invite_request", {
    p_baby_id: babyId, p_darin_id: "darin-qa-3#1003", p_request_type: "friend", p_role: "viewer", p_relation: "친구",
  });
  if (declineRequest.error || !declineRequest.data?.[0]?.request_id) throw declineRequest.error ?? new Error("decline request missing");
  const declineRequestId = declineRequest.data[0].request_id;
  const declined = await outsider.sb.rpc("respond_darin_id_invite_request", { p_request_id: declineRequestId, p_accept: false });
  if (declined.error) throw declined.error;
  const declinedMembership = await outsider.sb.from("baby_members").select("id").eq("baby_id", babyId);
  if (declinedMembership.error || declinedMembership.data?.length) throw new Error("declined request granted baby access");
  const declinedEvent = await owner.sb.from("notification_events").select("id").eq("event_type", "invite_declined").eq("data->>requestId", declineRequestId);
  if (declinedEvent.error || !declinedEvent.data?.length) throw new Error("requester did not receive declined in-app event");

  console.log("PASS Darin ID validation, 30-day expiry, request RLS, accept/decline notifications, family role, and friend isolation");
} finally {
  if (babyId) await owner.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts(accounts);
}
