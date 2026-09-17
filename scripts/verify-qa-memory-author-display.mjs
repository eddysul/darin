import assert from "node:assert/strict";
import { createAdminClient, createQaAccounts, cleanupQaAccounts } from "./lib/qa-auth.mjs";
import { assertQaProjectRef, QA_PROJECT_REF } from "./lib/qa-project-config.mjs";

assertQaProjectRef(process.env.EXPO_PUBLIC_SUPABASE_URL, "Supabase URL");
if (process.env.QA_MEMORY_AUTHOR_CONFIRM?.trim() !== `VERIFY_MEMORY_AUTHOR_${QA_PROJECT_REF}`) {
  throw new Error("QA memory author verification confirmation missing");
}

const admin = createAdminClient();
const accounts = await createQaAccounts(["memory-author-a", "memory-recipient-b", "memory-unrelated-c"]);
const [author, recipient, unrelated] = accounts;
let babyId;
let postId;

async function expectOk(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function visiblePost(client) {
  const data = await expectOk(
    client.from("memory_posts").select("id, author_id").eq("id", postId),
    "visible post query",
  );
  return data ?? [];
}

async function authorProjection(client, userId = author.user.id) {
  const data = await expectOk(
    client.rpc("list_memory_author_display", { p_user_ids: [userId] }),
    "author projection RPC",
  );
  return data ?? [];
}

try {
  await expectOk(
    admin.from("profiles").update({ display_name: "정문" }).eq("id", author.user.id),
    "author profile name",
  );
  await expectOk(
    admin.from("profiles").update({ display_name: "아윤" }).eq("id", recipient.user.id),
    "recipient profile name",
  );
  await expectOk(
    admin.from("profiles").update({ display_name: "관계없음" }).eq("id", unrelated.user.id),
    "unrelated profile name",
  );

  const baby = await expectOk(
    admin.from("babies").insert({ name: "작성자 표시 QA", created_by: author.user.id }).select("id").single(),
    "baby fixture",
  );
  babyId = baby.id;
  await expectOk(admin.from("baby_members").insert([
    {
      baby_id: babyId,
      user_id: author.user.id,
      permission_role: "admin",
      relationship_label: "아빠",
      status: "active",
    },
    {
      baby_id: babyId,
      user_id: recipient.user.id,
      permission_role: "admin",
      relationship_label: "가족",
      status: "active",
    },
  ]), "membership fixtures");

  const post = await expectOk(
    admin.from("memory_posts").insert({
      baby_id: babyId,
      author_id: author.user.id,
      caption: "synthetic memory author verification",
      privacy_type: "family_circle",
      status: "published",
    }).select("id").single(),
    "memory post fixture",
  );
  postId = post.id;
  await expectOk(admin.from("memory_comments").insert({
    memory_post_id: postId,
    author_id: author.user.id,
    body: "synthetic comment",
  }), "comment fixture");
  await expectOk(admin.from("memory_tags").insert({
    memory_post_id: postId,
    tag_type: "family_member",
    tagged_user_id: author.user.id,
    status: "approved",
    created_by: author.user.id,
  }), "tag fixture");

  // Normal shared-recipient flow.
  assert.equal((await visiblePost(recipient.sb)).length, 1);
  const normal = await authorProjection(recipient.sb);
  assert.equal(normal.length, 1);
  assert.equal(normal[0].user_id, author.user.id);
  assert.equal(normal[0].display_name, "정문");
  assert.deepEqual(
    Object.keys(normal[0]).sort(),
    ["avatar_storage_path", "display_name", "user_id"],
    "RPC must return only the safe display projection",
  );

  // Role changes never redefine the historical author identity.
  for (const role of ["editor", "viewer"]) {
    await expectOk(
      recipient.sb.from("baby_members").update({ permission_role: role }).eq("baby_id", babyId).eq("user_id", author.user.id),
      `author role ${role}`,
    );
    assert.equal((await authorProjection(recipient.sb))[0]?.display_name, "정문");
  }

  // The author can leave while the recipient retains lawful family access.
  await expectOk(
    recipient.sb.from("baby_members").update({ status: "inactive" }).eq("baby_id", babyId).eq("user_id", author.user.id),
    "remove author membership",
  );
  assert.equal((await visiblePost(recipient.sb)).length, 1);
  assert.equal((await authorProjection(recipient.sb))[0]?.display_name, "정문");

  // The same historical author is available through a lawful friend-circle share.
  await expectOk(
    recipient.sb.from("memory_posts").update({ privacy_type: "friend_circle" }).eq("id", postId),
    "friend-circle post",
  );
  await expectOk(
    recipient.sb.from("baby_members").update({ status: "inactive" }).eq("baby_id", babyId).eq("user_id", recipient.user.id),
    "remove recipient family membership",
  );
  await expectOk(admin.from("memory_friends").insert({
    baby_id: babyId,
    user_id: recipient.user.id,
    invited_by: author.user.id,
    status: "active",
  }), "friend fixture");
  assert.equal((await visiblePost(recipient.sb)).length, 1);
  assert.equal((await authorProjection(recipient.sb))[0]?.display_name, "정문");

  // Unknown/deleted profile identifiers resolve to no row and reveal no private shape.
  assert.deepEqual(
    await authorProjection(recipient.sb, crypto.randomUUID()),
    [],
    "missing profile must return no identity row",
  );

  // Unrelated users cannot see either the post or its author projection.
  assert.deepEqual(await visiblePost(unrelated.sb), []);
  assert.deepEqual(await authorProjection(unrelated.sb), []);
  assert.deepEqual(
    await authorProjection(recipient.sb, unrelated.user.id),
    [],
    "requesting an unrelated profile must not leak identity",
  );

  // Removed recipients do not regain access through the display RPC.
  await expectOk(
    admin.from("memory_friends").update({ status: "revoked" }).eq("baby_id", babyId).eq("user_id", recipient.user.id),
    "revoke friend",
  );
  assert.deepEqual(await visiblePost(recipient.sb), []);
  assert.deepEqual(await authorProjection(recipient.sb), []);

  console.log(JSON.stringify({
    projectRef: QA_PROJECT_REF,
    authenticatedActors: 3,
    normalSharedRecipient: "PASS",
    roleChanges: "PASS",
    removedAuthorMembership: "PASS",
    friendShare: "PASS",
    missingProfile: "PASS",
    unrelatedUserDenial: "PASS",
    removedRecipientDenial: "PASS",
    projectionColumns: ["user_id", "display_name", "avatar_storage_path"],
  }));
} finally {
  if (postId) {
    await admin.from("memory_reactions").delete().eq("memory_post_id", postId);
    await admin.from("memory_comments").delete().eq("memory_post_id", postId);
    await admin.from("memory_tags").delete().eq("memory_post_id", postId);
    await admin.from("memory_selected_people").delete().eq("memory_post_id", postId);
    await admin.from("memory_posts").delete().eq("id", postId);
  }
  if (babyId) {
    await admin.from("memory_friends").delete().eq("baby_id", babyId);
    await admin.from("baby_members").delete().eq("baby_id", babyId);
    await admin.from("babies").delete().eq("id", babyId);
  }
  await cleanupQaAccounts(accounts);
}
