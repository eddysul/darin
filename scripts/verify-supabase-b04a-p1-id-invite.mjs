import { spawnSync } from "node:child_process";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";
import { resolvePsqlBinary } from "./lib/qa-project-config.mjs";

assertQaProjectEnvironment();
const labels = [
  "B04aP1Issuer", "B04aP1CoAdmin", "B04aP1Demoted", "B04aP1Viewer",
  "B04aP1Inactive", "B04aP1Removed", "B04aP1WrongScope", "B04aP1Valid",
  "B04aP1Friend", "B04aP1StaleFriend", "B04aP1Race", "B04aP1WrongActor",
];
const accounts = await createQaAccounts(labels);
const [issuer, coAdmin, demoted, viewer, inactive, removed, wrongScope, valid, friend, staleFriend, race, wrongActor] = accounts;
const admin = createAdminClient();
const babyIds = [];

function expectDenied(result, label) {
  if (!result.error) throw new Error(`${label}: unexpectedly succeeded`);
  const safe = `${result.error.message ?? ""} ${result.error.details ?? ""} ${result.error.hint ?? ""}`;
  if (/Bearer\s|eyJ[A-Za-z0-9_-]+\.|@darin\.invalid/i.test(safe)) {
    throw new Error(`${label}: error exposed credential material`);
  }
  console.log(`PASS ${label}`);
}

async function createBaby(actor, name) {
  const result = await actor.sb.rpc("create_baby_with_owner", {
    p_name: name,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (result.error || !result.data?.id) throw result.error ?? new Error("baby creation failed");
  babyIds.push(result.data.id);
  return result.data.id;
}

async function addMember(actor, babyId, userId, permissionRole) {
  const result = await actor.sb.from("baby_members").insert({
    baby_id: babyId,
    user_id: userId,
    permission_role: permissionRole,
    relationship_label: "가족",
    status: "active",
  });
  if (result.error) throw result.error;
}

async function promoteFullAdmin(actor, babyId, userId) {
  const result = await actor.sb.rpc("promote_baby_full_admin", {
    p_baby_id: babyId,
    p_user_id: userId,
  });
  if (result.error) throw result.error;
}

async function setIssuer(actor, babyId, values) {
  const result = await actor.sb.from("baby_members").update(values)
    .eq("baby_id", babyId).eq("user_id", issuer.user.id).select("id");
  if (result.error || result.data?.length !== 1) throw result.error ?? new Error("issuer state update failed");
}

async function restoreIssuer(actor, babyId) {
  const existing = await admin.from("baby_members").select("id")
    .eq("baby_id", babyId).eq("user_id", issuer.user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    await setIssuer(actor, babyId, { permission_role: "editor", status: "active" });
  } else {
    await addMember(actor, babyId, issuer.user.id, "editor");
  }
  await promoteFullAdmin(actor, babyId, issuer.user.id);
}

async function send(receiverAccount, babyId, requestType = "family", role = "editor") {
  const darinId = receiverAccount.darinId;
  const result = await issuer.sb.rpc("send_darin_id_invite_request", {
    p_baby_id: babyId,
    p_darin_id: darinId,
    p_request_type: requestType,
    p_role: requestType === "friend" ? "viewer" : role,
    p_relation: requestType === "friend" ? "친구" : "가족",
  });
  if (result.error || !result.data?.[0]?.request_id) {
    throw result.error ?? new Error("invite request creation returned no id");
  }
  return result.data[0].request_id;
}

async function respond(account, requestId, accept = true) {
  return account.sb.rpc("respond_darin_id_invite_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
}

async function membership(userId, babyId) {
  const result = await admin.from("baby_members").select("permission_role,status")
    .eq("baby_id", babyId).eq("user_id", userId).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

function insertHistoricalRequest({ id, babyId, receiverId }) {
  const pgEnv = {
    ...process.env,
    PGHOST: process.env.SUPABASE_DB_HOST,
    PGPORT: process.env.SUPABASE_DB_PORT || "5432",
    PGUSER: process.env.SUPABASE_DB_USER,
    PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
    PGDATABASE: process.env.SUPABASE_DB_NAME || "postgres",
    PGSSLMODE: "require",
    PGCONNECT_TIMEOUT: "15",
  };
  const sql = `insert into public.darin_invite_requests (id,baby_id,sender_id,receiver_id,request_type,permission_role,relationship_label,status,expires_at) values ('${id}','${babyId}','${issuer.user.id}','${receiverId}','family','admin','가족','pending',now()+interval '30 days')`;
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    cwd: process.cwd(), encoding: "utf8", env: pgEnv,
  });
  if (result.status !== 0) throw new Error(`historical request fixture failed: ${(result.stderr || result.stdout).slice(0, 1000)}`);
}

try {
  for (const [index, account] of accounts.entries()) {
    const darinId = `Q${crypto.randomUUID().slice(0, 7)}#${String(1000 + index).slice(-4)}`;
    account.darinId = darinId;
    const profile = await account.sb.from("profiles").upsert({
      id: account.user.id,
      display_name: account.label,
      darin_id: darinId,
      preferred_language: "ko",
    });
    if (profile.error) throw profile.error;
  }

  const baby = await createBaby(issuer, `B04a P1 ${crypto.randomUUID()}`);
  const otherBaby = await createBaby(coAdmin, `B04a P1 scope ${crypto.randomUUID()}`);
  await addMember(issuer, baby, coAdmin.user.id, "editor");
  await promoteFullAdmin(issuer, baby, coAdmin.user.id);

  const demotedRequest = await send(demoted, baby);
  await setIssuer(coAdmin, baby, { permission_role: "editor" });
  expectDenied(await respond(demoted, demotedRequest), "demoted editor issuer rejected");
  if (await membership(demoted.user.id, baby)) throw new Error("demoted issuer granted membership");
  await restoreIssuer(coAdmin, baby);

  const viewerRequest = await send(viewer, baby);
  await setIssuer(coAdmin, baby, { permission_role: "viewer" });
  expectDenied(await respond(viewer, viewerRequest), "viewer issuer rejected");
  if (await membership(viewer.user.id, baby)) throw new Error("viewer issuer granted membership");
  await restoreIssuer(coAdmin, baby);

  const inactiveRequest = await send(inactive, baby);
  await setIssuer(coAdmin, baby, { status: "inactive" });
  expectDenied(await respond(inactive, inactiveRequest), "inactive issuer rejected");
  if (await membership(inactive.user.id, baby)) throw new Error("inactive issuer granted membership");
  await restoreIssuer(coAdmin, baby);

  const removedRequest = await send(removed, baby);
  const remove = await coAdmin.sb.from("baby_members").delete()
    .eq("baby_id", baby).eq("user_id", issuer.user.id).select("id");
  if (remove.error || remove.data?.length !== 1) throw remove.error ?? new Error("issuer removal failed");
  expectDenied(await respond(removed, removedRequest), "removed issuer rejected");
  if (await membership(removed.user.id, baby)) throw new Error("removed issuer granted membership");
  const decline = await respond(removed, removedRequest, false);
  if (decline.error) throw decline.error;
  console.log("PASS decline remains available after issuer removal");
  await restoreIssuer(coAdmin, baby);

  const wrongScopeRequest = crypto.randomUUID();
  insertHistoricalRequest({ id: wrongScopeRequest, babyId: otherBaby, receiverId: wrongScope.user.id });
  expectDenied(await respond(wrongScope, wrongScopeRequest), "admin on another baby rejected");
  expectDenied(await respond(wrongActor, wrongScopeRequest), "recipient mismatch rejected");
  if (await membership(wrongScope.user.id, otherBaby)) throw new Error("wrong-scope issuer granted membership");

  const validRequest = await send(valid, baby, "family", "editor");
  const validResponse = await respond(valid, validRequest);
  if (validResponse.error || validResponse.data?.[0]?.permission_role !== "editor") {
    throw validResponse.error ?? new Error("valid admin response returned wrong role");
  }
  const validMembership = await membership(valid.user.id, baby);
  if (validMembership?.permission_role !== "editor" || validMembership?.status !== "active") {
    throw new Error("valid admin grant is incorrect");
  }
  expectDenied(await respond(valid, validRequest), "accepted request replay rejected");
  console.log("PASS valid family request positive control");

  const friendRequest = await send(friend, baby, "friend", "viewer");
  const friendResponse = await respond(friend, friendRequest);
  if (friendResponse.error) throw friendResponse.error;
  const friendRow = await admin.from("memory_friends").select("status")
    .eq("baby_id", baby).eq("user_id", friend.user.id).maybeSingle();
  if (friendRow.error || friendRow.data?.status !== "active") throw friendRow.error ?? new Error("friend grant missing");
  console.log("PASS valid friend request positive control");

  const staleFriendRequest = await send(staleFriend, baby, "friend", "viewer");
  await setIssuer(coAdmin, baby, { permission_role: "editor" });
  expectDenied(await respond(staleFriend, staleFriendRequest), "demoted friend-request issuer rejected");
  await restoreIssuer(coAdmin, baby);

  const raceRequest = await send(race, baby);
  const [raceResponse, raceDemotion] = await Promise.all([
    respond(race, raceRequest),
    coAdmin.sb.from("baby_members").update({ permission_role: "editor" })
      .eq("baby_id", baby).eq("user_id", issuer.user.id).select("id"),
  ]);
  if (raceDemotion.error || raceDemotion.data?.length !== 1) throw raceDemotion.error ?? new Error("race demotion failed");
  const racedMembership = await membership(race.user.id, baby);
  if (raceResponse.error) {
    if (racedMembership) throw new Error("rejected race response granted membership");
  } else if (racedMembership?.permission_role !== "editor" || racedMembership?.status !== "active") {
    throw new Error("successful lock-ordered race response has an invalid grant");
  }
  console.log(`PASS QA concurrent race: ${raceResponse.error ? "safe rejection" : "valid response-first grant"}`);

  console.log("B0.4a P1 ID-invite QA attack regression passed");
} finally {
  try {
    if (babyIds.length) {
      const cleanup = await admin.from("babies").delete().in("id", babyIds);
      if (cleanup.error) throw cleanup.error;
    }
  } finally {
    await cleanupQaAccounts(accounts);
  }
}
