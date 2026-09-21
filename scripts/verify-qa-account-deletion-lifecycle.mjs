import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { resolvePsqlBinary } from "./lib/qa-project-config.mjs";

assertQaProjectEnvironment();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const service = createClient(url, secret, { auth: { persistSession: false } });
const runId = crypto.randomUUID().slice(0, 8);
const password = `DeleteQa-${crypto.randomUUID()}!`;
const users = [];
const babies = [];
const objects = [];
const expectReminderFailure = process.argv.includes("--expect-reminder-failure");
function dbScalar(sql, readOnly = true) {
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    env: { ...process.env, PGHOST: process.env.SUPABASE_DB_HOST,
      PGPORT: process.env.SUPABASE_DB_PORT || "5432", PGUSER: process.env.SUPABASE_DB_USER,
      PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
      PGDATABASE: process.env.SUPABASE_DB_NAME || "postgres", PGSSLMODE: "require",
      PGOPTIONS: readOnly ? "-c default_transaction_read_only=on -c statement_timeout=30000"
        : "-c statement_timeout=30000" },
  });
  if (result.status !== 0) throw new Error(`QA DB read failed: ${result.stderr.slice(0, 500)}`);
  return result.stdout.trim().split("\n")[0] ?? "";
}

function check(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code || "unknown"} ${result.error.message}`);
  return result.data;
}
async function count(table, column, value) {
  if (table === "media_temp_claims") {
    assert.match(value, /^[0-9a-f-]{36}$/i);
    return Number(dbScalar(`select count(*) from public.media_temp_claims where baby_id='${value}'`));
  }
  const result = await service.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  check(result, `${table} count`);
  return result.count ?? 0;
}
async function createUser(label) {
  const email = `delete-${runId}-${label}-${crypto.randomUUID().slice(0, 6)}@darin.test`;
  const created = check(await service.auth.admin.createUser({ email, password, email_confirm: true }), `${label} create`);
  const client = createClient(url, publicKey, { auth: { persistSession: false } });
  check(await client.auth.signInWithPassword({ email, password }), `${label} login`);
  const user = { id: created.user.id, client, label };
  users.push(user);
  return user;
}
async function createBaby(owner, label) {
  const result = check(await owner.client.rpc("create_baby_with_owner", {
    p_name: `DeleteQA-${runId}-${label}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  }), `${label} baby create`);
  assert.ok(result?.id, `${label} baby id`);
  babies.push(result.id);
  return result.id;
}
async function addMember(babyId, user, role) {
  check(await service.from("baby_members").insert({
    baby_id: babyId, user_id: user.id, permission_role: role,
    relationship_label: "가족", status: "active",
  }), "add member");
}
async function addFriend(babyId, user, inviter) {
  check(await service.from("memory_friends").insert({
    baby_id: babyId, user_id: user.id, invited_by: inviter.id, status: "active",
  }), "add friend");
}
async function addContent(babyId, author, label, withCaution = false) {
  const postId = crypto.randomUUID();
  const diaryId = crypto.randomUUID();
  const careId = crypto.randomUUID();
  const growthId = crypto.randomUUID();
  check(await service.from("memory_posts").insert({ id: postId, baby_id: babyId,
    author_id: author.id, caption: label, privacy_type: "family_circle" }), "memory insert");
  check(await service.from("diary_entries").insert({ id: diaryId, baby_id: babyId,
    author_id: author.id, entry_date: "2026-09-17", body: label }), "diary insert");
  check(await service.from("care_logs").insert({ id: careId, baby_id: babyId,
    client_generated_id: careId, category: "memo", recorded_at: new Date().toISOString(),
    date_key: "2026-09-17", time_local: "12:00", payload: { note: label },
    source: "manual", created_by: author.id }), "care insert");
  // Real accounts contain feeding/sleep logs. Memo-only fixtures bypassed the
  // reminder DELETE trigger and missed the parent-cascade FK failure.
  for (const category of ["breast", "formula", "storedMilk", "sleep"]) {
    const id = crypto.randomUUID();
    check(await service.from("care_logs").insert({ id, baby_id: babyId,
      client_generated_id: id, category, recorded_at: new Date().toISOString(),
      date_key: "2026-09-18", time_local: "12:00", payload: { duration: "10" },
      source: "manual", created_by: author.id }), `${category} insert`);
  }
  check(await service.from("growth_records").insert({ id: growthId, baby_id: babyId,
    client_generated_id: growthId, measured_at: "2026-09-17", weight_kg: 8.5,
    source: "hospital", input_method: "manual", user_confirmed: true,
    created_by: author.id }), "growth insert");
  const commentId = crypto.randomUUID();
  check(await service.from("memory_comments").insert({ id: commentId,
    memory_post_id: postId, author_id: author.id, body: label }), "comment insert");
  check(await service.from("memory_reactions").insert({ memory_post_id: postId,
    author_id: author.id, reaction_type: "heart" }), "reaction insert");
  check(await service.from("memory_tags").insert({ memory_post_id: postId,
    tag_type: "baby", baby_id: babyId, created_by: author.id }), "tag insert");
  check(await service.from("memory_saves").insert({ memory_post_id: postId,
    baby_id: babyId, user_id: author.id }), "save insert");
  check(await service.from("memory_selected_people").insert({ memory_post_id: postId,
    user_id: author.id }), "recipient insert");
  check(await service.from("notification_events").insert({ recipient_id: author.id,
    baby_id: babyId, event_type: "test", title: label, body: label }), "notification insert");
  let cautionId = null;
  if (withCaution) {
    cautionId = crypto.randomUUID();
    check(await service.from("baby_caution_foods").insert({ id: cautionId, baby_id: babyId,
      food_name: `QA ${runId}`, normalized_food_name: `qa-${runId}-${label}`,
      created_by: author.id }), "caution insert");
  }
  return { postId, diaryId, careId, growthId, commentId, cautionId };
}
async function addMedia(babyId, postId, author) {
  const path = `${babyId}/${postId}/${crypto.randomUUID()}.jpg`;
  check(await author.client.storage.from("memories").upload(path, new Blob(["qa"], { type: "image/jpeg" }),
    { contentType: "image/jpeg", upsert: false }), "attached media upload");
  objects.push({ bucket: "memories", path });
  check(await author.client.from("memory_media").insert({ baby_id: babyId, memory_post_id: postId,
    storage_path: path, media_type: "image", upload_status: "ready" }), "media row insert");
  return path;
}
async function isAuthDeleted(user) {
  const lookup = await service.auth.admin.getUserById(user.id);
  assert.ok(lookup.error || !lookup.data?.user, `${user.label} Auth remains`);
  assert.equal(await count("profiles", "id", user.id), 0, `${user.label} profile remains`);
  assert.equal(await count("push_tokens", "user_id", user.id), 0);
  assert.equal(await count("notification_events", "recipient_id", user.id), 0);
}
async function authExists(user) {
  const lookup = await service.auth.admin.getUserById(user.id);
  assert.ifError(lookup.error);
  assert.ok(lookup.data.user, `${user.label} Auth missing`);
}
async function preserved(babyId, admins, members) {
  assert.equal(await count("babies", "id", babyId), 1, "baby was deleted");
  assert.equal(await count("baby_members", "baby_id", babyId), members, "member count");
  const result = await service.from("baby_members").select("id", { count: "exact", head: true })
    .eq("baby_id", babyId).eq("permission_role", "admin").eq("status", "active");
  check(result, "admin count");
  assert.equal(result.count, admins, "active admin count");
}
async function deletedBaby(babyId, content) {
  for (const table of ["babies", "baby_members", "memory_friends", "care_logs", "growth_records",
    "diary_entries", "memory_posts", "memory_media", "diary_media", "memory_saves", "memory_tags",
    "baby_caution_foods", "baby_stickers", "growth_books", "growth_book_pages", "growth_book_media",
    "growth_book_comments", "invite_codes", "notification_events", "notification_settings",
    "media_temp_claims", "care_reminder_settings", "care_reminder_state",
    "care_reminder_member_preferences"]) {
    assert.equal(await count(table, table === "babies" ? "id" : "baby_id", babyId), 0, `${table} survived baby deletion`);
  }
  if (content) {
    assert.equal(await count("memory_comments", "memory_post_id", content.postId), 0);
    assert.equal(await count("memory_reactions", "memory_post_id", content.postId), 0);
    assert.equal(await count("memory_selected_people", "memory_post_id", content.postId), 0);
  }
}
async function deleteAccount(user) {
  const result = await user.client.functions.invoke("delete-account", {
    method: "POST", body: { confirmationText: "삭제" },
  });
  if (result.error) {
    const body = await result.error.context?.json?.().catch(() => null);
    throw new Error(`${user.label} Edge delete HTTP ${result.error.context?.status ?? "unknown"} ${body?.code ?? "unknown"}`);
  }
  assert.deepEqual(result.data, { deleted: true, mediaCleanupPending: true });
  await isAuthDeleted(user);
}
function pass(label) { console.log(`PASS ${label}`); }

try {
  if (expectReminderFailure) {
    // Run before applying the fix. Only this run's disposable QA fixtures are
    // touched; assert both the real RPC error and the client's HTTP contract.
    for (const category of ["formula", "sleep"]) {
      const owner = await createUser(`regression-${category}`);
      const babyId = await createBaby(owner, `regression-${category}`);
      const id = crypto.randomUUID();
      check(await service.from("care_logs").insert({ id, baby_id: babyId,
        client_generated_id: id, category, recorded_at: new Date().toISOString(),
        date_key: "2026-09-18", time_local: "12:00", payload: {},
        source: "manual", created_by: owner.id }), "regression log");
      const rpc = await owner.client.rpc("prepare_account_deletion");
      assert.equal(rpc.error?.code, "23503");
      assert.match(rpc.error.message, /care_reminder_state_baby_id_fkey/);
      const edge = await owner.client.functions.invoke("delete-account", {
        method: "POST", body: { confirmationText: "삭제" },
      });
      assert.equal(edge.error?.context?.status, 503);
      assert.equal((await edge.error.context.json()).code, "ACCOUNT_DELETION_TEMPORARY_FAILURE");
      await preserved(babyId, 1, 1); await authExists(owner);
      assert.equal(await count("care_logs", "id", id), 1, "failed RPC partially committed");
      pass(`reproduced ${category}: RPC 23503 / Edge 503; transaction rolled back`);
    }
  } else {
  // A: account without any baby or family.
  const a = await createUser("A");
  const invalid = await a.client.functions.invoke("delete-account", { method: "POST", body: { confirmationText: "wrong" } });
  assert.equal(invalid.error?.context?.status, 400);
  assert.equal((await invalid.error.context.json()).code, "INVALID_CONFIRMATION");
  await deleteAccount(a); pass("A no baby; confirmation contract");

  // B: ordinary family member leaves a healthy baby untouched.
  const bOwner = await createUser("B-owner"); const b = await createUser("B-member");
  const bBaby = await createBaby(bOwner, "B"); await addMember(bBaby, b, "viewer");
  const bContent = await addContent(bBaby, bOwner, "B");
  await deleteAccount(b); await preserved(bBaby, 1, 1);
  assert.equal(await count("memory_posts", "id", bContent.postId), 1); pass("B ordinary member");

  // C: a Memories-only friend is not an administrator or family member.
  const cOwner = await createUser("C-owner"); const c = await createUser("C-friend");
  const cBaby = await createBaby(cOwner, "C"); await addFriend(cBaby, c, cOwner);
  await deleteAccount(c); await preserved(cBaby, 1, 1);
  assert.equal(await count("memory_friends", "user_id", c.id), 0); pass("C friend only");

  // D: another admin preserves all baby content.
  const d = await createUser("D-admin"); const dOther = await createUser("D-other-admin");
  const dBaby = await createBaby(d, "D"); await addMember(dBaby, dOther, "admin");
  const dContent = await addContent(dBaby, d, "D");
  await deleteAccount(d); await preserved(dBaby, 1, 1); await authExists(dOther);
  assert.equal(await count("care_logs", "id", dContent.careId), 1);
  assert.equal(await count("diary_entries", "id", dContent.diaryId), 1);
  assert.equal(await count("memory_posts", "id", dContent.postId), 1); pass("D other admin present");

  // E: viewer/editor remain as accounts, while the last admin's space disappears.
  const e = await createUser("E-admin"); const eViewer = await createUser("E-viewer");
  const eEditor = await createUser("E-editor"); const eBaby = await createBaby(e, "E");
  await addMember(eBaby, eViewer, "viewer"); await addMember(eBaby, eEditor, "editor");
  const eContent = await addContent(eBaby, e, "E");
  const eMediaPath = await addMedia(eBaby, eContent.postId, e);
  assert.equal(await count("memory_media", "baby_id", eBaby), 1);
  await deleteAccount(e); await deletedBaby(eBaby, eContent);
  assert.ok(dbScalar(`select count(*) from public.media_cleanup_queue where bucket_id='memories'
    and storage_path='${eMediaPath}'`) !== "0", "attached media was not queued");
  await authExists(eViewer); await authExists(eEditor);
  const eLink = await eViewer.client.from("babies").select("id").eq("id", eBaby);
  check(eLink, "E old link"); assert.equal(eLink.data.length, 0); pass("E last admin with viewer/editor");

  // F: friend account survives but its old baby share disappears.
  const f = await createUser("F-admin"); const fFriend = await createUser("F-friend");
  const fBaby = await createBaby(f, "F"); await addFriend(fBaby, fFriend, f);
  const fContent = await addContent(fBaby, f, "F");
  await deleteAccount(f); await deletedBaby(fBaby, fContent); await authExists(fFriend);
  const fLink = await fFriend.client.from("memory_posts").select("id").eq("baby_id", fBaby);
  check(fLink, "F old link"); assert.equal(fLink.data.length, 0); pass("F last admin with friend");

  // G: sole member deletes the whole space.
  const g = await createUser("G-admin"); const gBaby = await createBaby(g, "G");
  const gContent = await addContent(gBaby, g, "G");
  await deleteAccount(g); await deletedBaby(gBaby, gContent); pass("G sole admin/member");

  // H: FK SET NULL is trusted, but direct identity mutation is still denied.
  const h = await createUser("H-admin"); const hOther = await createUser("H-other-admin");
  const hBaby = await createBaby(h, "H"); await addMember(hBaby, hOther, "admin");
  const hContent = await addContent(hBaby, h, "H", true);
  const mutation = await h.client.from("baby_caution_foods").update({ created_by: null }).eq("id", hContent.cautionId);
  assert.equal(mutation.error?.code, "42501", "direct caution identity update allowed");
  await deleteAccount(h); await preserved(hBaby, 1, 1);
  const caution = check(await service.from("baby_caution_foods").select("created_by,food_name").eq("id", hContent.cautionId).single(), "H caution");
  assert.equal(caution.created_by, null); assert.ok(caution.food_name); pass("H caution FK and guard");

  // I: simulate Auth Admin failure by committing preparation, then retry.
  const i = await createUser("I-admin"); const iViewer = await createUser("I-viewer");
  const iBaby = await createBaby(i, "I"); await addMember(iBaby, iViewer, "viewer");
  const iContent = await addContent(iBaby, i, "I");
  check(await i.client.rpc("prepare_account_deletion"), "I first preparation");
  await authExists(i); await deletedBaby(iBaby, iContent); await authExists(iViewer);
  check(await i.client.rpc("prepare_account_deletion"), "I retry preparation");
  await deleteAccount(i); await deletedBaby(iBaby, iContent); pass("I Auth failure simulation and retry");

  // The previous deployed RPC could remove a creator's last-admin membership
  // before Auth failed. A subsequent request must recover that exact state.
  const legacy = await createUser("I-legacy-admin"); const legacyViewer = await createUser("I-legacy-viewer");
  const legacyBaby = await createBaby(legacy, "I-legacy"); await addMember(legacyBaby, legacyViewer, "viewer");
  const legacyContent = await addContent(legacyBaby, legacy, "I-legacy");
  check(await service.from("baby_members").delete().eq("baby_id", legacyBaby).eq("user_id", legacy.id), "legacy partial setup");
  await authExists(legacy);
  await deleteAccount(legacy); await deletedBaby(legacyBaby, legacyContent); await authExists(legacyViewer);
  pass("I legacy partial-deletion retry");

  // J: leave a synthetic private object for the worker. HTTP deletion succeeds
  // while its durable queue intent remains pending.
  const j = await createUser("J-admin"); const jBaby = await createBaby(j, "J");
  const jPath = `${jBaby}/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`;
  check(await service.storage.from("memories").upload(jPath, new Blob(["qa"], { type: "image/jpeg" }),
    { contentType: "image/jpeg", upsert: false }), "J private upload");
  objects.push({ bucket: "memories", path: jPath });
  await deleteAccount(j); await deletedBaby(jBaby);
  const queued = dbScalar(`select state from public.media_cleanup_queue where bucket_id='memories' and storage_path='${jPath}'`);
  assert.equal(queued, "pending", "Storage was deleted synchronously");
  // Inject a worker remove failure as an expired lease on this synthetic key.
  const failedLease = dbScalar(`update public.media_cleanup_queue set state='leased',
    lease_id=gen_random_uuid(), lease_until=now()-interval '1 minute'
    where bucket_id='memories' and storage_path='${jPath}' returning state`, false);
  assert.equal(failedLease, "leased");
  assert.equal(dbScalar(`select (lease_until<now())::text from public.media_cleanup_queue
    where bucket_id='memories' and storage_path='${jPath}'`), "true");
  pass("J async Storage queue and expired-failure retry");

  // K: a stale token cannot delete twice or affect another user.
  const repeat = await j.client.functions.invoke("delete-account", {
    method: "POST", body: { confirmationText: "삭제" },
  });
  assert.ok(repeat.error, "repeated deleted-user request unexpectedly succeeded");
  assert.equal(repeat.error.context?.status, 401);
  await authExists(eViewer); await authExists(fFriend); pass("K repeated request safe");

  // L: parent deletion with both enabled and disabled reminder settings.
  for (const enabled of [true, false]) {
    const owner = await createUser(`L-${enabled}`);
    const babyId = await createBaby(owner, `L-${enabled}`);
    const content = await addContent(babyId, owner, `L-${enabled}`);
    for (const reminderType of ["feeding", "sleep"]) {
      check(await owner.client.from("care_reminder_settings").insert({
        baby_id: babyId, reminder_type: reminderType, enabled,
        interval_minutes: 180, updated_by: owner.id,
      }), "reminder setting");
    }
    const states = check(await service.from("care_reminder_state")
      .select("send_status").eq("baby_id", babyId), "reminder states");
    assert.equal(states.length, 2);
    assert.ok(states.every((state) => state.send_status === (enabled ? "scheduled" : "disabled")));
    await deleteAccount(owner); await deletedBaby(babyId, content);
    pass(`L reminder settings ${enabled ? "enabled" : "disabled"}; Edge 200 and all reminder rows removed`);
  }
  }
} finally {
  // Every ID here was created by this run. Never touch existing QA accounts.
  if (expectReminderFailure) {
    // The unfixed server cannot cascade these fixture logs. Change their
    // category while the parent still exists, then delete the fixtures normally.
    for (const babyId of babies) check(await service.from("care_logs")
      .update({ category: "memo" }).eq("baby_id", babyId), "regression fixture cleanup");
  }
  for (const babyId of babies) await service.from("babies").delete().eq("id", babyId);
  for (const user of users) await service.auth.admin.deleteUser(user.id).catch(() => undefined);
  for (const object of objects) await service.storage.from(object.bucket).remove([object.path]);
}
