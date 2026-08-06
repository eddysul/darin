/**
 * Profile Settings V1 — RLS / avatar / member display QA.
 *
 * Accounts:
 *   A = baby owner/admin
 *   B = invited viewer
 *   E = invited editor
 *   C = non-member
 *
 * Usage: node --env-file=.env scripts/verify-supabase-profile-settings.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) throw new Error("Missing Supabase public client environment variables.");

const SIGNED_URL_TTL_SECONDS = 180;
const lines = [];
const pass = (message) => lines.push(`PASS  ${message}`);
const fail = (message) => lines.push(`FAIL  ${message}`);

const client = () => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function anonymous(label) {
  const sb = client();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`${label} auth: ${error?.message ?? "no user"}`);
  return { sb, user: data.user, label };
}

const ONE_PIXEL_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240,
  31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69,
  78, 68, 174, 66, 96, 130,
]);

const accountA = await anonymous("QA-A-admin");
const accountB = await anonymous("QA-B-viewer");
const accountE = await anonymous("QA-E-editor");
const accountC = await anonymous("QA-C-outsider");

let babyId = null;
const storagePaths = [];

try {
  await accountA.sb.from("profiles").upsert({
    id: accountA.user.id,
    display_name: "ProfileQA-A",
    preferred_language: "ko",
  });
  await accountB.sb.from("profiles").upsert({
    id: accountB.user.id,
    display_name: "ProfileQA-B",
    preferred_language: "ko",
  });
  await accountE.sb.from("profiles").upsert({
    id: accountE.user.id,
    display_name: "ProfileQA-E",
    preferred_language: "ko",
  });

  const created = await accountA.sb.rpc("create_baby_with_owner", {
    p_name: `ProfileBaby-${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "엄마",
  });
  if (created.error || !created.data?.id) throw created.error ?? new Error("baby create failed");
  babyId = created.data.id;

  const viewerInsert = await accountA.sb.from("baby_members").insert({
    baby_id: babyId,
    user_id: accountB.user.id,
    permission_role: "viewer",
    relationship_label: "가족",
    status: "active",
  });
  if (viewerInsert.error) throw viewerInsert.error;

  const editorInsert = await accountA.sb.from("baby_members").insert({
    baby_id: babyId,
    user_id: accountE.user.id,
    permission_role: "editor",
    relationship_label: "아빠",
    status: "active",
  });
  if (editorInsert.error) throw editorInsert.error;

  // My profile update
  const myUpdate = await accountA.sb.from("profiles").update({
    display_name: "ProfileQA-A-Updated",
    nickname: "에이",
    default_relation: "엄마",
    updated_at: new Date().toISOString(),
  }).eq("id", accountA.user.id).select("display_name, nickname").maybeSingle();
  if (myUpdate.error || myUpdate.data?.display_name !== "ProfileQA-A-Updated") {
    fail(`내 profile update: ${myUpdate.error?.message ?? "missing row"}`);
  } else pass("내 profile update");

  // Other user profile update denied
  const otherUpdate = await accountB.sb.from("profiles").update({
    display_name: "Hacked",
  }).eq("id", accountA.user.id).select("id");
  if ((otherUpdate.data?.length ?? 0) > 0) fail("다른 user profile update denied");
  else pass("다른 user profile update denied");

  // Co-member can read display profile
  const coRead = await accountB.sb.from("profiles")
    .select("id, display_name, nickname, avatar_storage_path")
    .eq("id", accountA.user.id)
    .maybeSingle();
  if (coRead.error || !coRead.data) fail(`member profile display read: ${coRead.error?.message ?? "missing"}`);
  else pass("member profile display read");

  // Non-member cannot read profile
  const outsiderProfile = await accountC.sb.from("profiles")
    .select("id, display_name")
    .eq("id", accountA.user.id)
    .maybeSingle();
  if (outsiderProfile.data) fail("non-member profile read denied");
  else pass("non-member profile read denied");

  // Baby profile admin update
  const babyAdmin = await accountA.sb.from("babies").update({
    name: "프로필아기",
    nickname: "별명A",
    birth_date: "2025-01-15",
    updated_at: new Date().toISOString(),
  }).eq("id", babyId).select("name, nickname").maybeSingle();
  if (babyAdmin.error || babyAdmin.data?.name !== "프로필아기") {
    fail(`baby profile admin update: ${babyAdmin.error?.message ?? "missing"}`);
  } else pass("baby profile admin update");

  // Editor baby profile update
  const babyEditor = await accountE.sb.from("babies").update({
    nickname: "별명E",
    updated_at: new Date().toISOString(),
  }).eq("id", babyId).select("nickname").maybeSingle();
  if (babyEditor.error || babyEditor.data?.nickname !== "별명E") {
    fail(`baby profile editor update: ${babyEditor.error?.message ?? "missing"}`);
  } else pass("baby profile editor update");

  // Viewer baby profile update denied
  const babyViewer = await accountB.sb.from("babies").update({
    name: "해킹아기",
  }).eq("id", babyId).select("name");
  if ((babyViewer.data?.length ?? 0) > 0) fail("viewer baby profile update denied");
  else pass("viewer baby profile update denied");

  // Non-member baby read denied
  const outsiderBaby = await accountC.sb.from("babies").select("id, name").eq("id", babyId).maybeSingle();
  if (outsiderBaby.data) fail("non-member baby profile read denied");
  else pass("non-member baby profile read denied");

  // Avatar upload authorized (user)
  const userPath = `users/${accountA.user.id}/avatar.png`;
  storagePaths.push(userPath);
  const userUpload = await accountA.sb.storage.from("profile-media").upload(userPath, ONE_PIXEL_PNG, {
    contentType: "image/png",
    upsert: true,
  });
  if (userUpload.error) fail(`avatar upload authorized: ${userUpload.error.message}`);
  else {
    pass("avatar upload authorized");
    await accountA.sb.from("profiles").update({ avatar_storage_path: userPath }).eq("id", accountA.user.id);
  }

  // Baby avatar upload editor
  const babyPath = `babies/${babyId}/avatar.png`;
  storagePaths.push(babyPath);
  const babyUpload = await accountE.sb.storage.from("profile-media").upload(babyPath, ONE_PIXEL_PNG, {
    contentType: "image/png",
    upsert: true,
  });
  if (babyUpload.error) fail(`baby avatar editor upload: ${babyUpload.error.message}`);
  else {
    pass("baby avatar editor upload");
    await accountE.sb.from("babies").update({ avatar_storage_path: babyPath }).eq("id", babyId);
  }

  // Non-member avatar denied
  const outsiderUpload = await accountC.sb.storage.from("profile-media").upload(
    `users/${accountC.user.id}/avatar.png`,
    ONE_PIXEL_PNG,
    { contentType: "image/png", upsert: true },
  );
  // Own user path should succeed for C; deny reading A's avatar / baby's avatar
  if (outsiderUpload.error) {
    // Some projects may block anonymous storage until profile exists — treat as soft note.
    fail(`outsider own avatar upload unexpected: ${outsiderUpload.error.message}`);
  } else {
    storagePaths.push(`users/${accountC.user.id}/avatar.png`);
    pass("outsider own avatar upload (baseline)");
  }

  const outsiderReadA = await accountC.sb.storage.from("profile-media").createSignedUrl(userPath, SIGNED_URL_TTL_SECONDS);
  if (!outsiderReadA.error && outsiderReadA.data?.signedUrl) fail("avatar non-member denied");
  else pass("avatar non-member denied");

  const outsiderReadBaby = await accountC.sb.storage.from("profile-media").createSignedUrl(babyPath, SIGNED_URL_TTL_SECONDS);
  if (!outsiderReadBaby.error && outsiderReadBaby.data?.signedUrl) fail("baby avatar non-member denied");
  else pass("baby avatar non-member denied");

  const memberReadA = await accountB.sb.storage.from("profile-media").createSignedUrl(userPath, SIGNED_URL_TTL_SECONDS);
  if (memberReadA.error || !memberReadA.data?.signedUrl) fail(`member avatar signed URL: ${memberReadA.error?.message ?? "missing"}`);
  else pass("member avatar signed URL");

  // Member list read
  const members = await accountB.sb.from("baby_members").select("user_id, permission_role").eq("baby_id", babyId);
  if (members.error || (members.data?.length ?? 0) < 2) fail(`member list read: ${members.error?.message ?? "short"}`);
  else pass("member list read");

  const outsiderMembers = await accountC.sb.from("baby_members").select("user_id").eq("baby_id", babyId);
  if ((outsiderMembers.data?.length ?? 0) > 0) fail("non-member member list denied");
  else pass("non-member member list denied");

  // Family role update admin
  const roleAdmin = await accountA.sb.from("baby_members").update({
    permission_role: "editor",
    updated_at: new Date().toISOString(),
  }).eq("baby_id", babyId).eq("user_id", accountB.user.id).select("permission_role").maybeSingle();
  if (roleAdmin.error || roleAdmin.data?.permission_role !== "editor") {
    fail(`family role update admin: ${roleAdmin.error?.message ?? "missing"}`);
  } else pass("family role update admin");

  // Viewer role update denied (after demoting B back conceptually — B is now editor; use E? wait B is editor now)
  // Re-set B to viewer via service-less: A sets back to viewer first for the deny check using C? 
  // Spec: viewer role update denied — use account that is viewer. Set B to viewer again, then B tries to escalate E.
  await accountA.sb.from("baby_members").update({
    permission_role: "viewer",
    updated_at: new Date().toISOString(),
  }).eq("baby_id", babyId).eq("user_id", accountB.user.id);

  const roleViewer = await accountB.sb.from("baby_members").update({
    permission_role: "admin",
  }).eq("baby_id", babyId).eq("user_id", accountE.user.id).select("permission_role");
  if ((roleViewer.data?.length ?? 0) > 0) fail("viewer role update denied");
  else pass("viewer role update denied");

  // Self role escalation denied via trigger even if update allowed for self relation fields
  const selfEscalate = await accountB.sb.from("baby_members").update({
    permission_role: "admin",
  }).eq("baby_id", babyId).eq("user_id", accountB.user.id).select("permission_role");
  if ((selfEscalate.data?.length ?? 0) > 0 && selfEscalate.data[0].permission_role === "admin") {
    fail("self role escalate denied");
  } else pass("self role escalate denied");

} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  for (const path of storagePaths) {
    try { await accountA.sb.storage.from("profile-media").remove([path]); } catch { /* cleanup */ }
  }
  if (babyId) {
    try { await accountA.sb.from("baby_members").delete().eq("baby_id", babyId); } catch { /* cleanup */ }
    try { await accountA.sb.from("babies").delete().eq("id", babyId); } catch { /* cleanup */ }
  }
  await Promise.allSettled([
    accountA.sb.auth.signOut(),
    accountB.sb.auth.signOut(),
    accountE.sb.auth.signOut(),
    accountC.sb.auth.signOut(),
  ]);
}

console.log(lines.join("\n"));
const failed = lines.some((line) => line.startsWith("FAIL"));
process.exit(failed ? 1 : 0);
