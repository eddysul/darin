/**
 * Phase 2E — Memories permission hardening + signed URL + N+1 timing QA.
 *
 * Accounts:
 *   A = baby owner/admin
 *   B = invited viewer
 *   E = invited editor (must NOT edit/delete A's posts)
 *   C = non-member
 *   F = explicitly invited Memories-only friend (not a baby_member)
 *
 * Usage: node --env-file=.env scripts/verify-supabase-memories.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) throw new Error("Missing Supabase public client environment variables.");

/** Must match MEMORY_SIGNED_URL_TTL_SECONDS in MemoriesRepository. */
const SIGNED_URL_TTL_SECONDS = 180;

const lines = [];
const notes = [];
const pass = (message) => lines.push(`PASS  ${message}`);
const fail = (message) => lines.push(`FAIL  ${message}`);
const info = (message) => notes.push(`NOTE  ${message}`);

const client = () => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function anonymous(label) {
  const sb = client();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`${label} auth: ${error?.message ?? "no user"}`);
  return { sb, user: data.user, label };
}

function expectOne(rows, label) {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`${label}: expected one row, got ${rows?.length ?? "null"}`);
  }
}

function expectNone(rows, label) {
  if (!Array.isArray(rows) || rows.length !== 0) {
    throw new Error(`${label}: expected no rows, got ${rows?.length ?? "null"}`);
  }
}

async function expectBlockedSignedUrl(sb, storagePath, label) {
  const { data, error } = await sb.storage.from("memories").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (!error || data?.signedUrl) throw new Error(`${label}: signed URL unexpectedly allowed`);
}

async function expectAllowedSignedUrl(sb, storagePath, label) {
  const { data, error } = await sb.storage.from("memories").createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(`${label}: ${error?.message ?? "missing URL"}`);
  return data.signedUrl;
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
const accountF = await anonymous("QA-F-memory-friend");

let babyId = null;
const storagePaths = [];
const stickerStoragePaths = [];

try {
  const { error: tableError } = await accountA.sb.from("memory_posts").select("id").limit(1);
  if (tableError) throw new Error(`memories migration not applied: ${tableError.message}`);
  pass("Memories tables reachable");

  // Detect whether Phase 2E manage hardening SQL is live by probing editor update later.
  const migrationPath = resolve("supabase/migrations/202608060001_memories_v2b.sql");
  info(`Expected SQL migration present: ${migrationPath.split("/").pop()}`);
  info(`Signed URL TTL policy: ${SIGNED_URL_TTL_SECONDS}s (MVP; old URLs remain valid until expiry)`);

  const qaBabyName = `QA-Memories-Phase2E-${Date.now()}`;
  const { data: baby, error: babyError } = await accountA.sb.rpc("create_baby_with_owner", {
    p_name: qaBabyName,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error(`baby create: ${babyError?.message ?? "no baby"}`);
  babyId = baby.id;
  info(`QA baby: ${qaBabyName} (${babyId})`);
  info(`A=${accountA.user.id} B(viewer)=${accountB.user.id} E(editor)=${accountE.user.id} C=${accountC.user.id} F(friend)=${accountF.user.id}`);

  const { error: membersError } = await accountA.sb.from("baby_members").insert([
    {
      baby_id: babyId,
      user_id: accountB.user.id,
      permission_role: "viewer",
      relationship_label: "가족",
      status: "active",
    },
    {
      baby_id: babyId,
      user_id: accountE.user.id,
      permission_role: "editor",
      relationship_label: "가족",
      status: "active",
    },
  ]);
  if (membersError) throw new Error(`member setup: ${membersError.message}`);
  pass("QA memberships prepared (A admin, B viewer, E editor, C outsider)");

  const { error: friendSetupError } = await accountA.sb.from("memory_friends").insert({
    baby_id: babyId,
    user_id: accountF.user.id,
    invited_by: accountA.user.id,
    status: "active",
  });
  if (friendSetupError) throw new Error(`Memories friend setup: ${friendSetupError.message}`);
  const { data: friendBabyMemberships, error: friendMembershipError } = await accountF.sb
    .from("baby_members")
    .select("baby_id")
    .eq("baby_id", babyId);
  if (friendMembershipError) throw friendMembershipError;
  expectNone(friendBabyMemberships, "F baby membership isolation");
  pass("F is Memories-only friend and receives no baby_members access");

  const { data: authorPermission, error: permissionError } = await accountA.sb.rpc("baby_permission", {
    p_baby_id: babyId,
  });
  if (permissionError || authorPermission !== "admin") {
    throw new Error(`author permission: ${permissionError?.message ?? String(authorPermission)}`);
  }
  pass("A resolves as admin");

  const createPost = async (privacyType, caption) => {
    const id = crypto.randomUUID();
    const { data, error } = await accountA.sb
      .from("memory_posts")
      .insert({
        id,
        baby_id: babyId,
        author_id: accountA.user.id,
        caption: `QA ${caption}`,
        privacy_type: privacyType,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(`${privacyType} create: ${error?.message ?? "no row"}`);
    return data;
  };

  const attachMedia = async (postId, label) => {
    const mediaId = crypto.randomUUID();
    const storagePath = `${babyId}/${postId}/${mediaId}.png`;
    const { error: uploadError } = await accountA.sb.storage
      .from("memories")
      .upload(storagePath, ONE_PIXEL_PNG, { contentType: "image/png", upsert: false });
    if (uploadError) throw new Error(`${label} upload: ${uploadError.message}`);
    storagePaths.push(storagePath);
    const { error: mediaError } = await accountA.sb.from("memory_media").insert({
      id: mediaId,
      memory_post_id: postId,
      baby_id: babyId,
      storage_path: storagePath,
      media_type: "image",
      width: 1,
      height: 1,
    });
    if (mediaError) throw new Error(`${label} media: ${mediaError.message}`);
    return storagePath;
  };

  const readById = async (sb, postId) => {
    const { data, error } = await sb.from("memory_posts").select("id,privacy_type,caption").eq("id", postId);
    if (error) throw error;
    return data ?? [];
  };

  const familyPost = await createPost("family_circle", "family_circle");
  const familyPath = await attachMedia(familyPost.id, "family_circle");
  expectOne(await readById(accountA.sb, familyPost.id), "A family getById");
  expectOne(await readById(accountB.sb, familyPost.id), "B family getById");
  expectOne(await readById(accountE.sb, familyPost.id), "E family getById");
  expectNone(await readById(accountC.sb, familyPost.id), "C family getById");
  await expectAllowedSignedUrl(accountB.sb, familyPath, "B family signed URL");
  await expectBlockedSignedUrl(accountC.sb, familyPath, "C family signed URL");
  pass("family_circle visibility A/B/E yes, C no");

  // ---------- Memories V2B: friend_circle ----------
  const friendPost = await createPost("friend_circle", "friend_circle");
  const friendPath = await attachMedia(friendPost.id, "friend_circle");
  expectOne(await readById(accountA.sb, friendPost.id), "A friend post");
  expectOne(await readById(accountF.sb, friendPost.id), "F invited friend post");
  expectNone(await readById(accountB.sb, friendPost.id), "B family-only account on friend post");
  expectNone(await readById(accountC.sb, friendPost.id), "C non-member friend post");
  await expectAllowedSignedUrl(accountF.sb, friendPath, "F friend post signed URL");
  await expectBlockedSignedUrl(accountC.sb, friendPath, "C friend post signed URL");
  pass("friend_circle visible only to author + explicit Memories friend; not public/non-member");

  // ---------- Memories V2B: private saves ----------
  const saveRow = async (account, post) => account.sb.from("memory_saves").insert({
    memory_post_id: post.id,
    baby_id: babyId,
    user_id: account.user.id,
  });
  const { error: ownSaveError } = await saveRow(accountA, familyPost);
  if (ownSaveError) throw new Error(`A own save: ${ownSaveError.message}`);
  const { error: visibleSaveError } = await saveRow(accountB, familyPost);
  if (visibleSaveError) throw new Error(`B visible save: ${visibleSaveError.message}`);
  const { error: outsiderSaveError } = await saveRow(accountC, familyPost);
  if (!outsiderSaveError) throw new Error("C outsider save unexpectedly allowed");
  const { data: aSaves, error: aSavesError } = await accountA.sb.from("memory_saves").select("user_id,memory_post_id").eq("baby_id", babyId);
  if (aSavesError) throw aSavesError;
  if (aSaves?.length !== 1 || aSaves[0].user_id !== accountA.user.id) throw new Error("A can inspect another user's save");
  const { data: bSaves, error: bSavesError } = await accountB.sb.from("memory_saves").select("user_id,memory_post_id").eq("baby_id", babyId);
  if (bSavesError) throw bSavesError;
  if (bSaves?.length !== 1 || bSaves[0].user_id !== accountB.user.id) throw new Error("B own save list mismatch");
  pass("save own/visible allowed; outsider denied; save lists isolated per user");

  // ---------- Memories V2B: private baby stickers + sticker comments ----------
  const stickerId = crypto.randomUUID();
  const stickerPath = `${babyId}/${stickerId}.png`;
  const { error: stickerUploadError } = await accountA.sb.storage
    .from("baby-stickers")
    .upload(stickerPath, ONE_PIXEL_PNG, { contentType: "image/png", upsert: false });
  if (stickerUploadError) throw new Error(`sticker upload: ${stickerUploadError.message}`);
  stickerStoragePaths.push(stickerPath);
  const { error: stickerInsertError } = await accountA.sb.from("baby_stickers").insert({
    id: stickerId,
    baby_id: babyId,
    created_by: accountA.user.id,
    label: "QA 아기 스티커",
    storage_path: stickerPath,
    source: "qa",
    metadata: { cutoutMode: "circular" },
  });
  if (stickerInsertError) throw new Error(`sticker insert: ${stickerInsertError.message}`);
  const { data: bStickerRows, error: bStickerReadError } = await accountB.sb.from("baby_stickers").select("id").eq("id", stickerId);
  if (bStickerReadError) throw bStickerReadError;
  expectOne(bStickerRows, "B member sticker read");
  const { data: cStickerRows, error: cStickerReadError } = await accountC.sb.from("baby_stickers").select("id").eq("id", stickerId);
  if (cStickerReadError) throw cStickerReadError;
  expectNone(cStickerRows, "C sticker read");
  const { data: fStickerRows, error: fStickerReadError } = await accountF.sb.from("baby_stickers").select("id").eq("id", stickerId);
  if (fStickerReadError) throw fStickerReadError;
  expectNone(fStickerRows, "F unused sticker browse");
  const { data: stickerComment, error: stickerCommentError } = await accountB.sb.from("memory_comments").insert({
    memory_post_id: familyPost.id,
    author_id: accountB.user.id,
    body: "QA 아기 스티커",
    comment_type: "sticker",
    sticker_id: stickerId,
    sticker_label: "QA 아기 스티커",
  }).select("id,comment_type,sticker_id").single();
  if (stickerCommentError || stickerComment?.sticker_id !== stickerId) throw new Error(`sticker comment create: ${stickerCommentError?.message ?? "mismatch"}`);
  const { data: aStickerComments, error: aStickerCommentsError } = await accountA.sb.from("memory_comments").select("id,comment_type,sticker_id").eq("id", stickerComment.id);
  if (aStickerCommentsError) throw aStickerCommentsError;
  expectOne(aStickerComments, "A sticker comment read");
  const { error: outsiderStickerCommentError } = await accountC.sb.from("memory_comments").insert({
    memory_post_id: familyPost.id,
    author_id: accountC.user.id,
    body: "blocked sticker",
    comment_type: "sticker",
    sticker_id: stickerId,
    sticker_label: "blocked sticker",
  });
  if (!outsiderStickerCommentError) throw new Error("C sticker comment unexpectedly allowed");
  const { data: memberStickerUrl, error: memberStickerUrlError } = await accountB.sb.storage.from("baby-stickers").createSignedUrl(stickerPath, SIGNED_URL_TTL_SECONDS);
  if (memberStickerUrlError || !memberStickerUrl?.signedUrl) throw new Error(`B sticker signed URL: ${memberStickerUrlError?.message ?? "missing URL"}`);
  const { data: outsiderStickerUrl, error: outsiderStickerUrlError } = await accountC.sb.storage.from("baby-stickers").createSignedUrl(stickerPath, SIGNED_URL_TTL_SECONDS);
  if (!outsiderStickerUrlError || outsiderStickerUrl?.signedUrl) throw new Error("C sticker signed URL unexpectedly allowed");
  pass("baby sticker member read + sticker comment pass; outsider table/storage/comment denied");

  // ---------- RLS hardening ----------
  const { data: aEdited, error: aEditError } = await accountA.sb
    .from("memory_posts")
    .update({ caption: "QA A edited" })
    .eq("id", familyPost.id)
    .select("caption")
    .single();
  if (aEditError || aEdited?.caption !== "QA A edited") {
    throw new Error(`A edit: ${aEditError?.message ?? "caption mismatch"}`);
  }
  pass("A admin/author can edit own post");

  const { error: viewerUpdateError } = await accountB.sb
    .from("memory_posts")
    .update({ caption: "blocked viewer" })
    .eq("id", familyPost.id)
    .select("id")
    .single();
  if (!viewerUpdateError) throw new Error("viewer update unexpectedly allowed");
  pass("B viewer cannot edit A post (direct API/RLS)");

  const { data: editorUpdated, error: editorUpdateError } = await accountE.sb
    .from("memory_posts")
    .update({ caption: "blocked editor" })
    .eq("id", familyPost.id)
    .select("id,caption")
    .maybeSingle();
  let editorHardeningLive = true;
  if (!editorUpdateError && editorUpdated?.caption === "blocked editor") {
    editorHardeningLive = false;
    fail(
      "Phase 2E migration not applied on remote: editor can still update another's memory_post. Apply supabase/migrations/202607310003_memories_manage_author_admin.sql in SQL Editor",
    );
    await accountA.sb.from("memory_posts").update({ caption: "QA A edited" }).eq("id", familyPost.id);
  } else if (!editorUpdateError && editorUpdated) {
    throw new Error("editor update returned unexpected row");
  } else {
    pass("E editor cannot edit A post (direct API/RLS)");
  }
  info(`editor hardening live=${editorHardeningLive}`);

  const { error: editorDeleteError } = await accountE.sb.rpc("soft_delete_memory_post", {
    p_memory_post_id: familyPost.id,
  });
  if (!editorDeleteError) throw new Error("editor soft delete unexpectedly allowed");
  const { error: viewerDeleteError } = await accountB.sb.rpc("soft_delete_memory_post", {
    p_memory_post_id: familyPost.id,
  });
  if (!viewerDeleteError) throw new Error("viewer soft delete unexpectedly allowed");
  const { error: outsiderDeleteError } = await accountC.sb.rpc("soft_delete_memory_post", {
    p_memory_post_id: familyPost.id,
  });
  if (!outsiderDeleteError) throw new Error("outsider soft delete unexpectedly allowed");
  pass("B/E/C cannot soft-delete A post");

  const { data: eComment, error: eCommentError } = await accountE.sb
    .from("memory_comments")
    .insert({
      memory_post_id: familyPost.id,
      author_id: accountE.user.id,
      body: "QA editor comment",
    })
    .select("*")
    .single();
  if (eCommentError || !eComment) throw new Error(`editor comment: ${eCommentError?.message ?? "no row"}`);

  const { data: eReaction, error: eReactionError } = await accountE.sb
    .from("memory_reactions")
    .upsert({
      memory_post_id: familyPost.id,
      author_id: accountE.user.id,
      reaction_type: "heart",
    }, { onConflict: "memory_post_id,author_id" })
    .select("*")
    .single();
  if (eReactionError || !eReaction) throw new Error(`editor reaction: ${eReactionError?.message ?? "no row"}`);
  pass("E editor can comment/react on visible family_circle post");

  const { error: cCommentError } = await accountC.sb.from("memory_comments").insert({
    memory_post_id: familyPost.id,
    author_id: accountC.user.id,
    body: "blocked",
  });
  if (!cCommentError) throw new Error("C comment unexpectedly allowed");
  pass("C non-member blocked from comment");

  // ---------- selected_people + signed URL policy ----------
  const selectedPost = await createPost("selected_people", "selected");
  const selectedPath = await attachMedia(selectedPost.id, "selected");
  const { error: selectedInsertError } = await accountA.sb.from("memory_selected_people").insert({
    memory_post_id: selectedPost.id,
    user_id: accountB.user.id,
  });
  if (selectedInsertError) throw new Error(`selected setup: ${selectedInsertError.message}`);
  const staleUrl = await expectAllowedSignedUrl(accountB.sb, selectedPath, "B selected signed URL");
  const { error: selectedRemoveError } = await accountA.sb
    .from("memory_selected_people")
    .delete()
    .eq("memory_post_id", selectedPost.id)
    .eq("user_id", accountB.user.id);
  if (selectedRemoveError) throw new Error(`selected remove: ${selectedRemoveError.message}`);
  expectNone(await readById(accountB.sb, selectedPost.id), "B after selected removal");
  await expectBlockedSignedUrl(accountB.sb, selectedPath, "B new signed URL after removal");
  let staleOk = false;
  try {
    staleOk = (await fetch(staleUrl)).ok;
  } catch {
    staleOk = false;
  }
  info(
    staleOk
      ? `KNOWN LIMITATION P2: stale signed URL still downloads for up to ~${SIGNED_URL_TTL_SECONDS}s after revocation`
      : `stale signed URL already rejected (TTL/cache variance); policy still assumes up to ${SIGNED_URL_TTL_SECONDS}s residual access`,
  );
  pass("selected_people removal blocks new signed URL minting");

  // ---------- only_me / soft delete ----------
  const onlyMe = await createPost("only_me", "only_me");
  const onlyMePath = await attachMedia(onlyMe.id, "only_me");
  expectNone(await readById(accountB.sb, onlyMe.id), "B only_me");
  expectNone(await readById(accountE.sb, onlyMe.id), "E only_me");
  await expectBlockedSignedUrl(accountB.sb, onlyMePath, "B only_me signed URL");
  pass("only_me hidden from B/E including signed URL");

  const { error: softDeleteError } = await accountA.sb.rpc("soft_delete_memory_post", {
    p_memory_post_id: onlyMe.id,
  });
  if (softDeleteError) throw new Error(`A soft delete: ${softDeleteError.message}`);
  expectNone(await readById(accountA.sb, onlyMe.id), "deleted getById");
  await expectBlockedSignedUrl(accountA.sb, onlyMePath, "signed URL after soft delete");
  pass("A soft delete + deleted media signed URL blocked");

  const publicResponse = await fetch(`${url}/storage/v1/object/public/memories/${familyPath}`, {
    headers: { apikey: key },
  });
  if (publicResponse.ok) throw new Error("memories object was publicly downloadable");
  pass("memories bucket is not public");

  // ---------- N+1 timing (measure only) ----------
  const measureList = async (countLabel, targetCount) => {
    while (true) {
      const { data: existing } = await accountA.sb
        .from("memory_posts")
        .select("id")
        .eq("baby_id", babyId)
        .is("deleted_at", null);
      const have = existing?.length ?? 0;
      if (have >= targetCount) break;
      const post = await createPost("family_circle", `perf-${have}`);
      await attachMedia(post.id, `perf-${have}`);
    }
    const t0 = Date.now();
    const { data: list, error } = await accountB.sb
      .from("memory_posts")
      .select("id")
      .eq("baby_id", babyId)
      .is("deleted_at", null);
    if (error) throw error;
    const listMs = Date.now() - t0;

    // Approximate client listCards fan-out: 4 queries + 1 signed URL per post (cover).
    const sample = (list ?? []).slice(0, Math.min(targetCount, list?.length ?? 0));
    let signedCalls = 0;
    const t1 = Date.now();
    await Promise.all(sample.map(async (row) => {
      const { data: media } = await accountB.sb
        .from("memory_media")
        .select("storage_path")
        .eq("memory_post_id", row.id)
        .limit(1);
      await Promise.all([
        accountB.sb.from("memory_tags").select("id").eq("memory_post_id", row.id),
        accountB.sb.from("memory_comments").select("id").eq("memory_post_id", row.id),
        accountB.sb.from("memory_reactions").select("id").eq("memory_post_id", row.id),
      ]);
      const path = media?.[0]?.storage_path;
      if (path) {
        signedCalls += 1;
        await accountB.sb.storage.from("memories").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      }
    }));
    const cardsMs = Date.now() - t1;
    info(
      `PERF ${countLabel}: listByBabyId=${listMs}ms visible=${list?.length ?? 0}; ` +
        `approx listCards fan-out on ${sample.length} posts=${cardsMs}ms signedUrlCalls=${signedCalls}`,
    );
    return { listMs, cardsMs, signedCalls, count: sample.length };
  };

  await measureList("1-post", 1);
  await measureList("5-posts", 5);
  await measureList("20-posts", 20);
  await measureList("50-posts", 50);
  info("P2 recommendation: pagination + batched media/tags/counts query or memory_cards RPC; lazy signed URLs");
  pass("N+1 timing measured for 1/5/20/50 posts");

  // Ensure migration file is in workspace for operators
  readFileSync(migrationPath, "utf8");
  pass("Phase 2E SQL migration file present in repo");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (storagePaths.length) {
    await accountA.sb.storage.from("memories").remove(storagePaths);
  }
  if (stickerStoragePaths.length) {
    await accountA.sb.storage.from("baby-stickers").remove(stickerStoragePaths);
  }
  if (babyId) {
    const { error: cleanupError } = await accountA.sb.from("babies").delete().eq("id", babyId);
    notes.push(
      cleanupError
        ? `NOTE  QA baby cleanup failed: ${babyId} — ${cleanupError.message}`
        : `NOTE  QA baby deleted: ${babyId}`,
    );
  }
  await Promise.all([
    accountA.sb.auth.signOut(),
    accountB.sb.auth.signOut(),
    accountE.sb.auth.signOut(),
    accountC.sb.auth.signOut(),
    accountF.sb.auth.signOut(),
  ]);
}

console.log([...lines, ...notes].join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
