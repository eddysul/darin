import assert from "node:assert/strict";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";

const { ref } = assertQaProjectEnvironment();
const service = createAdminClient();
const runId = crypto.randomUUID().slice(0, 8);
const prefix = `G5 baby scoped ${runId}`;
const accounts = await createQaAccounts([
  "G5Owner", "G5CareReader", "G5CareWriter", "G5Friend", "G5NoMoments",
  "G5Outsider", "G5OtherOwner", "G5PromoteTarget", "G5ConcurrentOwner",
  "G5ConcurrentOther", "G5DeleteOwner", "G5DeleteAdmin", "G5LifecycleCreator",
  "G5LifecycleAdmin",
]);
const [
  owner, careReader, careWriter, friend, noMoments, outsider, otherOwner,
  promoteTarget, concurrentOwner, concurrentOther, deleteOwner, deleteAdmin,
  lifecycleCreator, lifecycleAdmin,
] = accounts;
const babyIds = new Set();
let checks = 0;

function pass(label) {
  checks += 1;
  console.log(`PASS ${label}`);
}

function errorText(result) {
  return `${result?.error?.message ?? ""} ${result?.error?.details ?? ""} ${result?.error?.hint ?? ""}`;
}

function assertPrivacySafe(result, label) {
  assert.doesNotMatch(errorText(result), /Bearer\s|eyJ[A-Za-z0-9_-]+\.|@darin\.invalid/i,
    `${label}: credential material leaked`);
}

function expectDenied(result, label) {
  assertPrivacySafe(result, label);
  assert.ok(result.error, `${label}: unexpectedly succeeded`);
  pass(label);
}

function expectDeniedOrEmpty(result, label) {
  assertPrivacySafe(result, label);
  assert.ok(result.error || (result.data?.length ?? 0) === 0,
    `${label}: unexpectedly returned or changed rows`);
  pass(label);
}

function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${errorText(result)}`);
  return result.data;
}

async function createBaby(actor, label) {
  const data = checked(await actor.sb.rpc("create_baby_with_owner", {
    p_name: `${prefix} ${label}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  }), `${label} baby create`);
  assert.ok(data?.id, `${label}: missing baby id`);
  babyIds.add(data.id);
  return data.id;
}

async function addMember(actor, babyId, account, role = "viewer") {
  checked(await actor.sb.from("baby_members").insert({
    baby_id: babyId,
    user_id: account.user.id,
    permission_role: role,
    relationship_label: "가족",
    status: "active",
  }), `add ${account.label}`);
}

async function addFriend(actor, babyId, account) {
  checked(await actor.sb.from("memory_friends").insert({
    baby_id: babyId,
    user_id: account.user.id,
    invited_by: actor.user.id,
    status: "active",
  }), `add friend ${account.label}`);
}

async function setAccess(actor, babyId, account, access) {
  return actor.sb.rpc("set_baby_access_permissions", {
    p_baby_id: babyId,
    p_user_id: account.user.id,
    p_care_read: access.careRead,
    p_care_write: access.careWrite,
    p_moments_read: access.momentsRead,
    p_moments_write: access.momentsWrite,
    p_social_comment: access.socialComment,
    p_social_react: access.socialReact,
  });
}

async function insertCare(actor, babyId, label) {
  const id = crypto.randomUUID();
  const result = await actor.sb.from("care_logs").insert({
    id,
    baby_id: babyId,
    client_generated_id: id,
    category: "memo",
    recorded_at: new Date().toISOString(),
    date_key: "2026-09-21",
    time_local: "12:00",
    payload: { fixture: label },
    source: "manual",
    created_by: actor.user.id,
  }).select("id").single();
  return { id, result };
}

async function insertMemory(actor, babyId, privacyType, caption) {
  const id = crypto.randomUUID();
  const result = await actor.sb.from("memory_posts").insert({
    id,
    baby_id: babyId,
    author_id: actor.user.id,
    privacy_type: privacyType,
    status: "published",
    caption,
  });
  return { id, result };
}

async function cleanupBabies(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  const care = await service.from("care_logs").delete().in("baby_id", unique);
  if (care.error) throw new Error(`care cleanup: ${errorText(care)}`);
  const babies = await service.from("babies").delete().in("id", unique);
  if (babies.error) throw new Error(`baby cleanup: ${errorText(babies)}`);
}

async function cleanupStaleFixtures() {
  const stale = await service.from("babies").select("id").ilike("name", "G5 baby scoped %");
  checked(stale, "stale fixture lookup");
  await cleanupBabies((stale.data ?? []).map(({ id }) => id));
}

let babyOne;
let babyTwo;
let concurrentBaby;
let deleteBaby;
let lifecycleBaby;

try {
  await cleanupStaleFixtures();
  babyOne = await createBaby(owner, "primary");
  babyTwo = await createBaby(otherOwner, "cross-scope");

  await addMember(owner, babyOne, careReader, "viewer");
  await addMember(owner, babyOne, careWriter, "viewer");
  await addMember(owner, babyOne, noMoments, "viewer");
  await addMember(owner, babyOne, promoteTarget, "viewer");
  await addFriend(owner, babyOne, friend);

  checked(await setAccess(owner, babyOne, careReader, {
    careRead: true, careWrite: false, momentsRead: false, momentsWrite: false,
    socialComment: false, socialReact: false,
  }), "care reader access");
  checked(await setAccess(owner, babyOne, careWriter, {
    careRead: true, careWrite: true, momentsRead: false, momentsWrite: false,
    socialComment: false, socialReact: false,
  }), "care writer access");
  checked(await setAccess(owner, babyOne, noMoments, {
    careRead: true, careWrite: false, momentsRead: false, momentsWrite: false,
    socialComment: false, socialReact: false,
  }), "no moments access");

  const ownerAccess = checked(await owner.sb.from("baby_access_permissions")
    .select("care_read,care_write,moments_read,moments_write,social_comment,social_react")
    .eq("baby_id", babyOne).eq("user_id", owner.user.id).single(), "owner access row");
  assert.deepEqual(ownerAccess, {
    care_read: true, care_write: true, moments_read: true, moments_write: true,
    social_comment: true, social_react: true,
  });
  pass("owner Full Admin capability backfill");

  const ownerCare = await insertCare(owner, babyOne, "owner");
  checked(ownerCare.result, "owner care insert");
  const readerView = checked(await careReader.sb.from("care_logs").select("id")
    .eq("id", ownerCare.id), "care reader view");
  assert.equal(readerView.length, 1);
  pass("independent care.read positive control");

  const readerWrite = await insertCare(careReader, babyOne, "reader denied");
  expectDenied(readerWrite.result, "care.read without care.write cannot create");
  const writerCare = await insertCare(careWriter, babyOne, "writer allowed");
  checked(writerCare.result, "care writer insert");
  pass("independent care.write positive control");

  const crossRead = checked(await careWriter.sb.from("care_logs").select("id")
    .eq("baby_id", babyTwo), "cross-baby care read");
  assert.equal(crossRead.length, 0);
  pass("cross-baby care read denied");
  const crossWrite = await insertCare(careWriter, babyTwo, "cross scope denied");
  expectDenied(crossWrite.result, "cross-baby care write denied");

  const friendPost = await insertMemory(owner, babyOne, "friend_circle", "synthetic G5 friend moment");
  checked(friendPost.result, "friend post insert");
  const familyPost = await insertMemory(owner, babyOne, "family_circle", "synthetic G5 family moment");
  checked(familyPost.result, "family post insert");
  const friendView = checked(await friend.sb.from("memory_posts").select("id").eq("id", friendPost.id),
    "friend moment read");
  assert.equal(friendView.length, 1);
  pass("friend moments.read without care access");
  const friendCare = checked(await friend.sb.from("care_logs").select("id").eq("baby_id", babyOne),
    "friend care boundary");
  assert.equal(friendCare.length, 0);
  pass("friend cannot read care data");
  const hiddenMoment = checked(await noMoments.sb.from("memory_posts").select("id").eq("id", familyPost.id),
    "no moments boundary");
  assert.equal(hiddenMoment.length, 0);
  pass("family member without moments.read cannot view moment");

  const comment = await friend.sb.from("memory_comments").insert({
    memory_post_id: friendPost.id,
    author_id: friend.user.id,
    body: "synthetic G5 comment",
  }).select("id").single();
  checked(comment, "friend comment");
  pass("social.comment positive control");
  const reaction = await friend.sb.from("memory_reactions").insert({
    memory_post_id: friendPost.id,
    author_id: friend.user.id,
    reaction_type: "heart",
  }).select("id").single();
  checked(reaction, "friend reaction");
  pass("social.react positive control");

  checked(await setAccess(owner, babyOne, friend, {
    careRead: false, careWrite: false, momentsRead: false, momentsWrite: false,
    socialComment: false, socialReact: false,
  }), "friend revoke");
  const friendAfter = checked(await friend.sb.from("memory_posts").select("id").eq("id", friendPost.id),
    "post-revocation read");
  assert.equal(friendAfter.length, 0);
  pass("permission revocation blocks new moment reads");
  expectDenied(await friend.sb.from("memory_comments").insert({
    memory_post_id: friendPost.id,
    author_id: friend.user.id,
    body: "revoked synthetic comment",
  }), "revoked friend cannot comment");

  for (const [name, args] of [
    ["is_current_baby_link", { p_baby_id: babyOne, p_user_id: owner.user.id }],
    ["is_baby_full_admin", { p_baby_id: babyOne, p_user_id: owner.user.id }],
    ["user_has_baby_access", {
      p_baby_id: babyOne, p_user_id: owner.user.id, p_permission: "care.write",
    }],
  ]) {
    expectDenied(await outsider.sb.rpc(name, args), `arbitrary-user helper ${name} denied`);
  }

  expectDenied(await owner.sb.from("baby_members").update({ permission_role: "admin" })
    .eq("baby_id", babyOne).eq("user_id", promoteTarget.user.id).select("id"),
  "direct Full Admin role grant denied");
  const promoted = checked(await owner.sb.rpc("promote_baby_full_admin", {
    p_baby_id: babyOne, p_user_id: promoteTarget.user.id,
  }), "dedicated admin promotion");
  assert.equal(promoted, true);
  const promotedAccess = checked(await promoteTarget.sb.rpc("has_baby_access", {
    p_baby_id: babyOne, p_permission: "moments.write",
  }), "promoted access");
  assert.equal(promotedAccess, true);
  pass("dedicated current-admin promotion grants Full Admin");

  const inviteNeedle = `g5${runId}`;
  const inviteDarinId = `${inviteNeedle}#${String(Date.now()).slice(-4)}`;
  checked(await service.from("profiles").update({
    darin_id: inviteDarinId,
    display_name: "G5 Synthetic Invite Target",
  }).eq("id", outsider.user.id), "invite profile fixture");
  const search = checked(await owner.sb.rpc("search_invite_profiles", {
    p_baby_id: babyOne, p_query: inviteNeedle,
  }), "admin invite search");
  assert.ok(search.some(({ user_id: userId }) => userId === outsider.user.id));
  assert.ok(search.every((row) => Object.keys(row).sort().join(",") ===
    "avatar_storage_path,darin_id,display_name,user_id"));
  pass("current Full Admin invite search positive control and safe projection");
  expectDenied(await careReader.sb.rpc("search_invite_profiles", {
    p_baby_id: babyOne, p_query: inviteNeedle,
  }), "non-admin invite search denied");

  checked(await owner.sb.from("baby_members").delete()
    .eq("baby_id", babyOne).eq("user_id", careReader.user.id), "remove care reader");
  const removedAccess = checked(await careReader.sb.rpc("has_baby_access", {
    p_baby_id: babyOne, p_permission: "care.read",
  }), "removed access check");
  assert.equal(removedAccess, false);
  const removedRows = checked(await careReader.sb.from("care_logs").select("id")
    .eq("baby_id", babyOne), "removed care read");
  assert.equal(removedRows.length, 0);
  const permissionRow = checked(await service.from("baby_access_permissions").select("user_id")
    .eq("baby_id", babyOne).eq("user_id", careReader.user.id), "removed permission row");
  assert.equal(permissionRow.length, 0);
  pass("removed member immediately loses row and data access");

  concurrentBaby = await createBaby(concurrentOwner, "concurrent last admin");
  await addMember(concurrentOwner, concurrentBaby, concurrentOther, "editor");
  checked(await concurrentOwner.sb.rpc("promote_baby_full_admin", {
    p_baby_id: concurrentBaby, p_user_id: concurrentOther.user.id,
  }), "concurrent admin promotion");
  const departures = await Promise.all([
    concurrentOwner.sb.from("baby_members").delete()
      .eq("baby_id", concurrentBaby).eq("user_id", concurrentOwner.user.id).select("id"),
    concurrentOther.sb.from("baby_members").delete()
      .eq("baby_id", concurrentBaby).eq("user_id", concurrentOther.user.id).select("id"),
  ]);
  departures.forEach((result, index) => assertPrivacySafe(result, `concurrent departure ${index + 1}`));
  const removedCount = departures.reduce((sum, result) => sum + (result.data?.length ?? 0), 0);
  assert.equal(removedCount, 1, "concurrent departures did not remove exactly one admin");
  const remainingAdmins = checked(await service.from("baby_members").select("id")
    .eq("baby_id", concurrentBaby).eq("status", "active").eq("permission_role", "admin"),
  "remaining concurrent admins");
  assert.equal(remainingAdmins.length, 1);
  pass("concurrent departures retain exactly one active Full Admin");

  deleteBaby = await createBaby(deleteOwner, "creator deletion");
  await addMember(deleteOwner, deleteBaby, deleteAdmin, "editor");
  checked(await deleteOwner.sb.rpc("promote_baby_full_admin", {
    p_baby_id: deleteBaby, p_user_id: deleteAdmin.user.id,
  }), "delete admin promotion");
  expectDenied(await deleteAdmin.sb.rpc("delete_created_baby", { p_baby_id: deleteBaby }),
    "invited Full Admin cannot delete baby profile");
  const creatorDeleted = checked(await deleteOwner.sb.rpc("delete_created_baby", {
    p_baby_id: deleteBaby,
  }), "creator deletion");
  assert.equal(creatorDeleted, true);
  const deletedLookup = checked(await service.from("babies").select("id").eq("id", deleteBaby),
    "creator deletion lookup");
  assert.equal(deletedLookup.length, 0);
  babyIds.delete(deleteBaby);
  pass("creator-only baby deletion positive control");

  lifecycleBaby = await createBaby(lifecycleCreator, "last noncreator lifecycle");
  await addMember(lifecycleCreator, lifecycleBaby, lifecycleAdmin, "editor");
  checked(await lifecycleCreator.sb.rpc("promote_baby_full_admin", {
    p_baby_id: lifecycleBaby, p_user_id: lifecycleAdmin.user.id,
  }), "lifecycle admin promotion");
  checked(await lifecycleCreator.sb.from("baby_members").delete()
    .eq("baby_id", lifecycleBaby).eq("user_id", lifecycleCreator.user.id),
  "creator departure with another admin");
  checked(await lifecycleAdmin.sb.rpc("prepare_account_deletion"), "last noncreator lifecycle preparation");
  const lifecycleLookup = checked(await service.from("babies").select("id").eq("id", lifecycleBaby),
    "lifecycle deletion lookup");
  assert.equal(lifecycleLookup.length, 0);
  babyIds.delete(lifecycleBaby);
  pass("last noncreator Full Admin account lifecycle safely deletes orphaned space");

  const otherBabyVisible = checked(await owner.sb.from("babies").select("id").eq("id", babyTwo),
    "other baby isolation");
  assert.equal(otherBabyVisible.length, 0);
  pass("account and baby scope isolation remains fail-closed");

  console.log(`G5 QA baby-scoped API regression: ${checks} PASS / 0 skipped (${ref})`);
} finally {
  await cleanupBabies([...babyIds]);
  await cleanupQaAccounts(accounts);
  const stale = await service.from("babies").select("id").ilike("name", `${prefix}%`);
  if (!stale.error && (stale.data?.length ?? 0) !== 0) {
    throw new Error(`G5 cleanup left ${stale.data.length} baby fixture(s)`);
  }
}
