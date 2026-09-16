import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";

assertQaProjectEnvironment();
const accounts = await createQaAccounts([
  "B04aAdminA", "B04aEditorB", "B04aViewerC", "B04aAdminD", "B04aOutsiderE",
  "B04aFormerAdminF", "B04aRemovedReceiver", "B04aDemotedReceiver",
  "B04aRaceReceiver", "B04aValidReceiver",
]);
const [a, b, c, d, e, f, removedReceiver, demotedReceiver, raceReceiver, validReceiver] = accounts;
const fixtureAdmin = createAdminClient();
const createdBabyIds = [];
const uploadedObjects = [];
const observedErrors = [];

function assertSafeError(error, label) {
  if (!error) throw new Error(`${label}: expected an error`);
  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  if (/qa-b04a|@darin\.invalid|DARIN-[A-Z0-9]+|Bearer\s|eyJ[A-Za-z0-9_-]+\./i.test(text)) {
    throw new Error(`${label}: error exposed synthetic credentials or invite material`);
  }
  observedErrors.push(text);
}

function expectDenied(result, label) {
  if (!result.error) throw new Error(`${label}: unexpectedly succeeded`);
  assertSafeError(result.error, label);
}

function expectNoRows(result, label) {
  if (result.error) throw new Error(`${label}: unexpected query error: ${result.error.message}`);
  if ((result.data ?? []).length !== 0) throw new Error(`${label}: unauthorized rows returned`);
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

async function membership(userId, babyId) {
  const { data, error } = await fixtureAdmin.from("baby_members")
    .select("permission_role,status").eq("baby_id", babyId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function makeInvite(actor, babyId, role = "editor") {
  const result = await actor.sb.rpc("create_invite_code", {
    p_baby_id: babyId,
    p_invite_type: "family",
    p_role: role,
    p_relation: "가족",
    p_max_uses: 1,
  });
  if (result.error || !result.data?.code) throw result.error ?? new Error("invite creation returned no code");
  return result.data.code;
}

async function acceptInvite(actor, code) {
  return actor.sb.rpc("accept_invite_code", {
    p_code: code,
    p_display_name: "Synthetic QA",
    p_nickname: null,
    p_relation: "가족",
  });
}

function mediaPath(babyId, postId) {
  return `${babyId}/${postId}/${crypto.randomUUID()}.jpg`;
}

async function insertMedia(actor, babyId, postId, path = mediaPath(babyId, postId)) {
  if (!arguments[3]) {
    const pixel = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    const uploaded = await actor.sb.storage.from("memories").upload(path, pixel, { contentType: "image/png", upsert: false });
    if (uploaded.error) return { data: null, error: uploaded.error };
    uploadedObjects.push({ bucket: "memories", path });
  }
  return actor.sb.from("memory_media").insert({
    baby_id: babyId,
    memory_post_id: postId,
    storage_path: path,
    media_type: "image",
    upload_status: "ready",
  }).select("id,baby_id,memory_post_id,storage_path,width,height").single();
}

try {
  const legacyBefore = await fixtureAdmin.from("invite_codes")
    .select("id", { count: "exact", head: true })
    .eq("invite_type", "darin_friend").gt("used_count", 0).is("used_by", null);
  if (legacyBefore.error) throw legacyBefore.error;

  for (const actor of [a, d]) {
    const { data, error } = await actor.sb.rpc("create_baby_with_owner", {
      p_name: `B04a synthetic ${crypto.randomUUID()}`,
      p_child_status: "newborn",
      p_relationship_label: "보호자",
    });
    if (error || !data?.id) throw error ?? new Error("baby fixture creation failed");
    createdBabyIds.push(data.id);
  }
  const [babyA, babyB] = createdBabyIds;
  await addMember(a, babyA, b.user.id, "editor");
  await addMember(a, babyA, c.user.id, "viewer");
  await addMember(a, babyA, f.user.id, "admin");

  const initialInviteCount = await fixtureAdmin.from("invite_codes")
    .select("id", { count: "exact", head: true }).eq("baby_id", babyA);
  if (initialInviteCount.error) throw initialInviteCount.error;

  for (const [actor, label] of [[e, "non-member"], [c, "viewer"], [b, "editor"]]) {
    expectDenied(await actor.sb.rpc("create_invite_code", {
      p_baby_id: babyA, p_invite_type: "family", p_role: "admin", p_relation: "가족", p_max_uses: 1,
    }), `${label} create invite`);
    expectDenied(await actor.sb.rpc("list_baby_memory_friends", { p_baby_id: babyA }), `${label} list friends`);
    expectDenied(await actor.sb.rpc("add_darin_friend_to_baby", {
      p_baby_id: babyA, p_friend_user_id: validReceiver.user.id,
    }), `${label} add friend`);
  }
  const afterDeniedInviteCount = await fixtureAdmin.from("invite_codes")
    .select("id", { count: "exact", head: true }).eq("baby_id", babyA);
  if (afterDeniedInviteCount.error || afterDeniedInviteCount.count !== initialInviteCount.count) {
    throw new Error("denied actors changed invite state");
  }
  console.log("PASS NULL/non-member, viewer, and editor admin-only RPC attacks rejected");

  const removedCode = await makeInvite(f, babyA, "admin");
  const removeF = await a.sb.from("baby_members").delete().eq("baby_id", babyA).eq("user_id", f.user.id);
  if (removeF.error) throw removeF.error;
  expectDenied(await f.sb.rpc("create_invite_code", {
    p_baby_id: babyA, p_invite_type: "family", p_role: "admin", p_relation: "가족", p_max_uses: 1,
  }), "removed admin create invite");
  expectDenied(await acceptInvite(removedReceiver, removedCode), "removed issuer invite acceptance");
  if (await membership(removedReceiver.user.id, babyA)) throw new Error("removed issuer granted membership");
  console.log("PASS removed former admin and outstanding invite rejected");

  await addMember(a, babyA, f.user.id, "admin");
  const demotedCode = await makeInvite(f, babyA, "admin");
  const demoteF = await a.sb.from("baby_members").update({ permission_role: "editor" })
    .eq("baby_id", babyA).eq("user_id", f.user.id).select("id");
  if (demoteF.error || demoteF.data?.length !== 1) throw demoteF.error ?? new Error("demotion fixture failed");
  expectDenied(await acceptInvite(demotedReceiver, demotedCode), "demoted issuer invite acceptance");
  if (await membership(demotedReceiver.user.id, babyA)) throw new Error("demoted issuer granted membership");
  console.log("PASS demoted issuer invite rejected");

  const restoreF = await a.sb.from("baby_members").update({ permission_role: "admin" })
    .eq("baby_id", babyA).eq("user_id", f.user.id).select("id");
  if (restoreF.error || restoreF.data?.length !== 1) throw restoreF.error ?? new Error("race fixture restore failed");
  const raceCode = await makeInvite(f, babyA, "admin");
  const [raceAccept, raceDemote] = await Promise.all([
    acceptInvite(raceReceiver, raceCode),
    a.sb.from("baby_members").update({ permission_role: "editor" })
      .eq("baby_id", babyA).eq("user_id", f.user.id).select("id"),
  ]);
  if (raceDemote.error || raceDemote.data?.length !== 1) throw raceDemote.error ?? new Error("concurrent demotion failed");
  const racedMembership = await membership(raceReceiver.user.id, babyA);
  if (raceAccept.error) {
    assertSafeError(raceAccept.error, "concurrent acceptance safe rejection");
    if (racedMembership) throw new Error("rejected concurrent acceptance granted membership");
  } else if (!racedMembership || racedMembership.permission_role !== "admin" || racedMembership.status !== "active") {
    throw new Error("successful pre-demotion acceptance has an invalid final grant");
  }
  console.log(`PASS concurrent demotion race: ${raceAccept.error ? "safe rejection" : "valid lock-ordered acceptance"}`);

  const validCode = await makeInvite(a, babyA, "editor");
  const validAccept = await acceptInvite(validReceiver, validCode);
  if (validAccept.error) throw validAccept.error;
  const validMembership = await membership(validReceiver.user.id, babyA);
  if (!validMembership || validMembership.permission_role !== "editor" || validMembership.status !== "active") {
    throw new Error("valid current-admin invite returned an incorrect role");
  }
  console.log("PASS valid active-admin invite positive control");

  const posts = [];
  for (const [actor, babyId, label] of [[a, babyA, "A"], [d, babyB, "B"]]) {
    const postId = crypto.randomUUID();
    const { error } = await actor.sb.from("memory_posts").insert({
      id: postId,
      baby_id: babyId,
      author_id: actor.user.id,
      caption: `B04a synthetic ${label}`,
      privacy_type: "family_circle",
      status: "published",
    });
    if (error) throw error;
    posts.push(postId);
  }
  const [postA, postB] = posts;
  const mediaAResult = await insertMedia(a, babyA, postA);
  const mediaBResult = await insertMedia(d, babyB, postB);
  if (mediaAResult.error || mediaBResult.error) throw mediaAResult.error ?? mediaBResult.error;
  const mediaA = mediaAResult.data;
  const mediaB = mediaBResult.data;

  const tempPathB = `${babyB}/temp/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  const pixel = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const upload = await d.sb.storage.from("memories").upload(tempPathB, pixel, { contentType: "image/png", upsert: false });
  if (upload.error) throw upload.error;
  uploadedObjects.push({ bucket: "memories", path: tempPathB });

  expectDenied(await insertMedia(a, babyB, postA, tempPathB), "cross-baby temp media attach");
  const tempStillOwned = await fixtureAdmin.storage.from("memories").download(tempPathB);
  if (tempStillOwned.error) throw new Error("blocked attach changed the original temp object");

  expectNoRows(await a.sb.from("memory_media").select("id").eq("id", mediaB.id), "cross-baby select");
  expectDenied(await insertMedia(a, babyB, postA), "cross-baby insert");
  const crossUpdate = await a.sb.from("memory_media").update({
    baby_id: babyB, memory_post_id: postB, storage_path: mediaPath(babyB, postB),
  }).eq("id", mediaA.id).select("id");
  if (!crossUpdate.error && crossUpdate.data?.length) throw new Error("cross-baby update succeeded");
  if (crossUpdate.error) assertSafeError(crossUpdate.error, "cross-baby update");
  const unchangedMedia = await a.sb.from("memory_media")
    .select("baby_id,memory_post_id,storage_path").eq("id", mediaA.id).single();
  if (unchangedMedia.error
      || unchangedMedia.data.baby_id !== babyA
      || unchangedMedia.data.memory_post_id !== postA
      || unchangedMedia.data.storage_path !== mediaA.storage_path) {
    throw unchangedMedia.error ?? new Error("rejected cross-baby update changed the original row");
  }
  expectNoRows(await a.sb.from("memory_media").delete().eq("id", mediaB.id).select("id"), "cross-baby delete");

  expectNoRows(await e.sb.from("memory_media").select("id").eq("id", mediaA.id), "unrelated select");
  expectDenied(await insertMedia(e, babyA, postA), "unrelated insert");
  expectNoRows(await e.sb.from("memory_media").update({ width: 777 }).eq("id", mediaA.id).select("id"), "unrelated update");
  expectNoRows(await e.sb.from("memory_media").delete().eq("id", mediaA.id).select("id"), "unrelated delete");
  console.log("PASS cross-baby and unrelated memory_media attack matrix rejected");

  const sameBabyRead = await b.sb.from("memory_media").select("id").eq("id", mediaA.id);
  if (sameBabyRead.error || sameBabyRead.data?.length !== 1) throw new Error("same-baby editor could not read visible media");
  const extra = await insertMedia(a, babyA, postA);
  if (extra.error) throw extra.error;
  const updated = await a.sb.from("memory_media").update({ width: 10, height: 10 }).eq("id", extra.data.id).select("id,width,height");
  if (updated.error || updated.data?.length !== 1 || updated.data[0].width !== 10) throw updated.error ?? new Error("same-baby media update failed");
  const deleted = await a.sb.from("memory_media").delete().eq("id", extra.data.id).select("id");
  if (deleted.error || deleted.data?.length !== 1) throw deleted.error ?? new Error("same-baby media delete failed");
  console.log("PASS valid same-baby SELECT/INSERT/UPDATE/DELETE controls");

  const [mismatch, duplicate, unauthorized] = await Promise.all([
    fixtureAdmin.from("memory_media").select("id,memory_post_id,baby_id"),
    fixtureAdmin.from("baby_members").select("baby_id,user_id,status"),
    fixtureAdmin.from("baby_members").select("user_id").eq("baby_id", babyA)
      .in("user_id", [removedReceiver.user.id, demotedReceiver.user.id]),
  ]);
  if (mismatch.error || duplicate.error || unauthorized.error) throw mismatch.error ?? duplicate.error ?? unauthorized.error;
  const postScopes = await fixtureAdmin.from("memory_posts").select("id,baby_id")
    .in("id", (mismatch.data ?? []).map((row) => row.memory_post_id));
  if (postScopes.error) throw postScopes.error;
  const scopeByPost = new Map((postScopes.data ?? []).map((row) => [row.id, row.baby_id]));
  if ((mismatch.data ?? []).some((row) => scopeByPost.get(row.memory_post_id) !== row.baby_id)) {
    throw new Error("post-test cross-baby memory_media mismatch exists");
  }
  const activeKeys = new Set();
  for (const row of duplicate.data ?? []) {
    if (row.status !== "active") continue;
    const key = `${row.baby_id}:${row.user_id}`;
    if (activeKeys.has(key)) throw new Error("post-test duplicate active membership exists");
    activeKeys.add(key);
  }
  if (unauthorized.data?.length) throw new Error("rejected invite created an unauthorized membership");

  const legacyAfter = await fixtureAdmin.from("invite_codes")
    .select("id", { count: "exact", head: true })
    .eq("invite_type", "darin_friend").gt("used_count", 0).is("used_by", null);
  if (legacyAfter.error || legacyAfter.count !== legacyBefore.count) throw legacyAfter.error ?? new Error("legacy invite state changed");
  if (observedErrors.some((text) => /CONTEXT:|PL\/pgSQL function.*line|\bselect\s+.*\bfrom\b/i.test(text))) {
    throw new Error("an API error exposed SQL or stack context");
  }
  console.log("PASS post-test integrity, legacy invite preservation, and error privacy checks");
} finally {
  for (const object of uploadedObjects) {
    try {
      await fixtureAdmin.storage.from(object.bucket).remove([object.path]);
    } catch {
      // Account cleanup below must still run if best-effort object cleanup fails.
    }
  }
  try {
    if (createdBabyIds.length) {
      const cleanupBabies = await fixtureAdmin.from("babies").delete().in("id", createdBabyIds);
      if (cleanupBabies.error) throw cleanupBabies.error;
    }
  } finally {
    await cleanupQaAccounts(accounts);
  }
}

console.log("B0.4a P0 QA attack regression passed");
