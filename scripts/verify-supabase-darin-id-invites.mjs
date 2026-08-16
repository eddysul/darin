/** Build 13 Darin ID invitation/RLS regression QA. Uses disposable confirmed-email accounts. */
import { cleanupQaAccounts, createQaAccounts } from "./lib/qa-auth.mjs";

const accounts = await createQaAccounts(["DarinIdQA-Owner", "DarinIdQA-Family", "DarinIdQA-Friend", "DarinIdQA-Outsider"]);
const [owner, family, friend, outsider] = accounts;
let babyId = null;
try {
  for (const [index, account] of accounts.entries()) {
    const { error } = await account.sb.from("profiles").upsert({ id: account.user.id, display_name: account.label, darin_id: `darin-qa-${index}#${1000 + index}`, preferred_language: "ko" });
    if (error) throw error;
  }
  const created = await owner.sb.rpc("create_baby_with_owner", { p_name: "Darin ID QA", p_child_status: "newborn", p_relationship_label: "엄마" });
  if (created.error || !created.data?.id) throw created.error ?? new Error("baby creation failed");
  babyId = created.data.id;
  const familyRequest = await owner.sb.rpc("send_darin_id_invite_request", { p_baby_id: babyId, p_darin_id: "darin-qa-1#1001", p_request_type: "family", p_role: "editor", p_relation: "가족" });
  if (familyRequest.error || !familyRequest.data?.[0]?.request_id) throw familyRequest.error ?? new Error("family request missing");
  const outsiderRead = await outsider.sb.from("darin_invite_requests").select("id").eq("baby_id", babyId);
  if (outsiderRead.error || outsiderRead.data?.length) throw new Error("outsider read invite request");
  const familyEvents = await family.sb.from("notification_events").select("id").eq("event_type", "invite_request");
  if (familyEvents.error || !familyEvents.data?.length) throw new Error("recipient did not receive invite event");
  const familyAccept = await family.sb.rpc("respond_darin_id_invite_request", { p_request_id: familyRequest.data[0].request_id, p_accept: true });
  if (familyAccept.error || familyAccept.data?.[0]?.permission_role !== "editor") throw familyAccept.error ?? new Error("family accept failed");
  const familyMember = await family.sb.from("baby_members").select("permission_role").eq("baby_id", babyId).maybeSingle();
  if (familyMember.error || familyMember.data?.permission_role !== "editor") throw new Error("family role not applied");
  const friendRequest = await owner.sb.rpc("send_darin_id_invite_request", { p_baby_id: babyId, p_darin_id: "darin-qa-2#1002", p_request_type: "friend", p_role: "viewer", p_relation: "친구" });
  if (friendRequest.error || !friendRequest.data?.[0]?.request_id) throw friendRequest.error ?? new Error("friend request missing");
  const friendAccept = await friend.sb.rpc("respond_darin_id_invite_request", { p_request_id: friendRequest.data[0].request_id, p_accept: true });
  if (friendAccept.error) throw friendAccept.error;
  const friendMembership = await friend.sb.from("baby_members").select("user_id").eq("baby_id", babyId);
  if (friendMembership.error || friendMembership.data?.length) throw new Error("friend was granted baby_members access");
  const friendCare = await friend.sb.from("care_logs").select("id").eq("baby_id", babyId);
  if (friendCare.error || friendCare.data?.length) throw new Error("friend can read care logs");
  console.log("PASS Darin ID request delivery, accept/decline authority, family role, friend RLS regression");
} finally {
  if (babyId) await owner.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts(accounts);
}
