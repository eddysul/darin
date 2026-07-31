/**
 * Live private Memories DB / Storage / RLS verification.
 * Usage: node --env-file=.env scripts/verify-supabase-memories.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) throw new Error("Missing Supabase public client environment variables.");

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
  return { sb, user: data.user };
}

function expectOne(rows, label) {
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`${label}: expected one row`);
}

function expectNone(rows, label) {
  if (!Array.isArray(rows) || rows.length !== 0) throw new Error(`${label}: expected no rows`);
}

const author = await anonymous("author");
const selectedViewer = await anonymous("selected viewer");
const nonSelectedViewer = await anonymous("non-selected viewer");
const outsider = await anonymous("outsider");
let babyId = null;
let storagePath = null;

try {
  const { error: tableError } = await author.sb.from("memory_posts").select("id").limit(1);
  if (tableError) {
    throw new Error(`memories migration not applied: ${tableError.message}`);
  }
  pass("Memories tables reachable");

  const { data: baby, error: babyError } = await author.sb.rpc("create_baby_with_owner", {
    p_name: `MemoriesQA-${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error(`baby create: ${babyError?.message ?? "no baby"}`);
  babyId = baby.id;

  const { error: membersError } = await author.sb.from("baby_members").insert([
    {
      baby_id: babyId,
      user_id: selectedViewer.user.id,
      permission_role: "viewer",
      relationship_label: "가족",
      status: "active",
    },
    {
      baby_id: babyId,
      user_id: nonSelectedViewer.user.id,
      permission_role: "viewer",
      relationship_label: "가족",
      status: "active",
    },
  ]);
  if (membersError) throw new Error(`member setup: ${membersError.message}`);
  pass("author and viewer memberships prepared");

  const { data: authorPermission, error: permissionError } = await author.sb.rpc("baby_permission", {
    p_baby_id: babyId,
  });
  if (permissionError || authorPermission !== "admin") {
    throw new Error(`author permission: ${permissionError?.message ?? String(authorPermission)}`);
  }
  pass("author admin permission resolved through RLS helper");

  const createPost = async (privacyType, caption) => {
    const id = crypto.randomUUID();
    const { data, error } = await author.sb
      .from("memory_posts")
      .insert({
        id,
        baby_id: babyId,
        author_id: author.user.id,
        caption,
        privacy_type: privacyType,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(`${privacyType} create: ${error?.message ?? "no row"}`);
    return data;
  };

  const onlyMe = await createPost("only_me", "author only");
  pass("author create post allowed");

  const { data: authorOnlyRows, error: authorOnlyError } = await author.sb
    .from("memory_posts").select("id").eq("id", onlyMe.id);
  if (authorOnlyError) throw new Error(`author only_me read: ${authorOnlyError.message}`);
  expectOne(authorOnlyRows, "author only_me read");
  pass("author can read own only_me post");

  const { data: outsiderOnlyRows, error: outsiderOnlyError } = await outsider.sb
    .from("memory_posts").select("id").eq("id", onlyMe.id);
  if (outsiderOnlyError) throw new Error(`outsider only_me read: ${outsiderOnlyError.message}`);
  expectNone(outsiderOnlyRows, "outsider only_me read");
  pass("non-member cannot read only_me post");

  const familyPost = await createPost("family_circle", "family post");
  const { data: familyRows, error: familyReadError } = await selectedViewer.sb
    .from("memory_posts").select("id").eq("id", familyPost.id);
  if (familyReadError) throw new Error(`family read: ${familyReadError.message}`);
  expectOne(familyRows, "family member read");
  pass("family member can read family_circle post");

  const { data: outsiderFamilyRows, error: outsiderFamilyError } = await outsider.sb
    .from("memory_posts").select("id").eq("id", familyPost.id);
  if (outsiderFamilyError) throw new Error(`outsider family read: ${outsiderFamilyError.message}`);
  expectNone(outsiderFamilyRows, "outsider family read");
  pass("non-member cannot read family_circle post");

  const selectedPost = await createPost("selected_people", "selected post");
  const { error: selectedInsertError } = await author.sb.from("memory_selected_people").insert({
    memory_post_id: selectedPost.id,
    user_id: selectedViewer.user.id,
  });
  if (selectedInsertError) throw new Error(`selected people setup: ${selectedInsertError.message}`);

  const { data: selectedRows, error: selectedReadError } = await selectedViewer.sb
    .from("memory_posts").select("id").eq("id", selectedPost.id);
  if (selectedReadError) throw new Error(`selected read: ${selectedReadError.message}`);
  expectOne(selectedRows, "selected person read");
  pass("selected person can read selected_people post");

  const { data: nonSelectedRows, error: nonSelectedReadError } = await nonSelectedViewer.sb
    .from("memory_posts").select("id").eq("id", selectedPost.id);
  if (nonSelectedReadError) throw new Error(`non-selected read: ${nonSelectedReadError.message}`);
  expectNone(nonSelectedRows, "non-selected member read");
  pass("non-selected member cannot read selected_people post");

  const taggedPost = await createPost("tagged_family", "tagged post");
  const { error: tagError } = await author.sb.from("memory_tags").insert({
    memory_post_id: taggedPost.id,
    tag_type: "family_member",
    tagged_user_id: selectedViewer.user.id,
    status: "approved",
    created_by: author.user.id,
  });
  if (tagError) throw new Error(`approved tag setup: ${tagError.message}`);
  const { data: taggedRows, error: taggedReadError } = await selectedViewer.sb
    .from("memory_posts").select("id").eq("id", taggedPost.id);
  if (taggedReadError) throw new Error(`tagged family read: ${taggedReadError.message}`);
  expectOne(taggedRows, "approved tagged family read");
  pass("approved tagged family member can read tagged_family post");

  const { data: comment, error: commentError } = await selectedViewer.sb
    .from("memory_comments")
    .insert({
      memory_post_id: familyPost.id,
      author_id: selectedViewer.user.id,
      body: "viewer QA comment",
    })
    .select("*")
    .single();
  if (commentError || !comment) throw new Error(`viewer comment: ${commentError?.message ?? "no row"}`);

  const { data: reaction, error: reactionError } = await selectedViewer.sb
    .from("memory_reactions")
    .upsert({
      memory_post_id: familyPost.id,
      author_id: selectedViewer.user.id,
      reaction_type: "heart",
    }, { onConflict: "memory_post_id,author_id" })
    .select("*")
    .single();
  if (reactionError || !reaction) throw new Error(`viewer reaction: ${reactionError?.message ?? "no row"}`);
  pass("viewer can comment and react to visible family post");

  const { error: viewerUpdateError } = await selectedViewer.sb
    .from("memory_posts")
    .update({ caption: "blocked viewer edit" })
    .eq("id", familyPost.id)
    .select("id")
    .single();
  if (!viewerUpdateError) throw new Error("viewer post update unexpectedly allowed");

  const { error: viewerDeleteError } = await selectedViewer.sb.rpc("soft_delete_memory_post", {
    p_memory_post_id: familyPost.id,
  });
  if (!viewerDeleteError) throw new Error("viewer post delete unexpectedly allowed");
  pass("viewer cannot edit or delete post");

  const { data: updatedPost, error: authorUpdateError } = await author.sb
    .from("memory_posts")
    .update({ caption: "author updated" })
    .eq("id", familyPost.id)
    .select("*")
    .single();
  if (authorUpdateError || updatedPost?.caption !== "author updated") {
    throw new Error(`author update: ${authorUpdateError?.message ?? "wrong caption"}`);
  }
  pass("author can edit post");

  const mediaId = crypto.randomUUID();
  storagePath = `${babyId}/${familyPost.id}/${mediaId}.png`;
  const onePixelPng = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
    0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240,
    31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69,
    78, 68, 174, 66, 96, 130,
  ]);
  const { error: uploadError } = await author.sb.storage
    .from("memories")
    .upload(storagePath, onePixelPng, { contentType: "image/png", upsert: false });
  if (uploadError) throw new Error(`private storage upload: ${uploadError.message}`);

  const { error: mediaError } = await author.sb.from("memory_media").insert({
    id: mediaId,
    memory_post_id: familyPost.id,
    baby_id: babyId,
    storage_path: storagePath,
    media_type: "image",
    width: 1,
    height: 1,
  });
  if (mediaError) throw new Error(`media metadata: ${mediaError.message}`);

  const { data: signed, error: signedError } = await selectedViewer.sb.storage
    .from("memories")
    .createSignedUrl(storagePath, 60);
  if (signedError || !signed?.signedUrl) throw new Error(`authorized signed URL: ${signedError?.message ?? "missing URL"}`);

  const { data: outsiderSigned, error: outsiderSignedError } = await outsider.sb.storage
    .from("memories")
    .createSignedUrl(storagePath, 60);
  if (!outsiderSignedError || outsiderSigned?.signedUrl) throw new Error("outsider signed URL unexpectedly allowed");
  pass("signed URL follows post RLS");

  const publicResponse = await fetch(`${url}/storage/v1/object/public/memories/${storagePath}`, {
    headers: { apikey: key },
  });
  if (publicResponse.ok) throw new Error("memories object was publicly downloadable");
  pass("memories storage bucket is not public");

  const { error: softDeleteError } = await author.sb.rpc("soft_delete_memory_post", {
    p_memory_post_id: onlyMe.id,
  });
  if (softDeleteError) throw new Error(`author soft delete: ${softDeleteError.message}`);
  const { data: deletedRows, error: deletedReadError } = await author.sb
    .from("memory_posts").select("id").eq("id", onlyMe.id);
  if (deletedReadError) throw new Error(`deleted post read: ${deletedReadError.message}`);
  expectNone(deletedRows, "deleted post list");
  pass("author soft delete succeeds and deleted post is excluded");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (storagePath) await author.sb.storage.from("memories").remove([storagePath]);
  if (babyId) await author.sb.from("babies").delete().eq("id", babyId);
  await Promise.all([
    author.sb.auth.signOut(),
    selectedViewer.sb.auth.signOut(),
    nonSelectedViewer.sb.auth.signOut(),
    outsider.sb.auth.signOut(),
  ]);
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
