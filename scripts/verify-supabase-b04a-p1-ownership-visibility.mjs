import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";

assertQaProjectEnvironment();
const labels = [
  "B04aOwner", "B04aCoAdmin", "B04aEditor", "B04aOtherEditor",
  "B04aViewer", "B04aRemoved", "B04aFriend", "B04aSelected",
  "B04aTagged", "B04aOutsider",
];
const accounts = await createQaAccounts(labels);
const [owner, coAdmin, editor, otherEditor, viewer, removed, friend, selected, tagged, outsider] = accounts;
const service = createAdminClient();
const babyIds = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeError(result) {
  return `${result.error?.message ?? ""} ${result.error?.details ?? ""} ${result.error?.hint ?? ""}`;
}

function assertNoCredentialLeak(result, label) {
  const output = safeError(result);
  if (/Bearer\s|eyJ[A-Za-z0-9_-]+\.|@darin\./i.test(output)) {
    throw new Error(`${label}: error exposed credential material`);
  }
}

function expectDeniedOrEmpty(result, label) {
  assertNoCredentialLeak(result, label);
  if (!result.error && (result.data?.length ?? 0) !== 0) {
    throw new Error(`${label}: unexpectedly affected ${result.data.length} row(s)`);
  }
  console.log(`PASS ${label}`);
}

function expectDenied(result, label) {
  assertNoCredentialLeak(result, label);
  if (!result.error) throw new Error(`${label}: unexpectedly succeeded`);
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

async function addMember(actor, babyId, account, role) {
  const result = await actor.sb.from("baby_members").insert({
    baby_id: babyId,
    user_id: account.user.id,
    permission_role: role,
    relationship_label: "가족",
    status: "active",
  });
  if (result.error) throw result.error;
}

async function promoteFullAdmin(actor, babyId, account) {
  const result = await actor.sb.rpc("promote_baby_full_admin", {
    p_baby_id: babyId,
    p_user_id: account.user.id,
  });
  if (result.error) throw result.error;
}

async function setMember(actor, babyId, account, values) {
  const result = await actor.sb.from("baby_members").update(values)
    .eq("baby_id", babyId).eq("user_id", account.user.id).select("id");
  if (result.error || result.data?.length !== 1) throw result.error ?? new Error("membership update failed");
}

async function removeMember(actor, babyId, account) {
  const result = await actor.sb.from("baby_members").delete()
    .eq("baby_id", babyId).eq("user_id", account.user.id).select("id");
  if (result.error || result.data?.length !== 1) throw result.error ?? new Error("membership removal failed");
}

async function insertCare(actor, babyId, category) {
  const id = crypto.randomUUID();
  const result = await actor.sb.from("care_logs").insert({
    id,
    baby_id: babyId,
    client_generated_id: crypto.randomUUID(),
    category,
    recorded_at: new Date().toISOString(),
    date_key: "2026-09-14",
    time_local: "12:00",
    payload: {},
    source: "manual",
    created_by: actor.user.id,
  }).select("id").single();
  if (result.error) throw result.error;
  return id;
}

async function insertGrowth(actor, babyId, weight) {
  const id = crypto.randomUUID();
  const result = await actor.sb.from("growth_records").insert({
    id,
    baby_id: babyId,
    client_generated_id: crypto.randomUUID(),
    measured_at: "2026-09-14",
    weight_kg: weight,
    source: "home",
    input_method: "manual",
    user_confirmed: true,
    created_by: actor.user.id,
  }).select("id").single();
  if (result.error) throw result.error;
  return id;
}

async function insertDiary(actor, babyId, body) {
  const id = crypto.randomUUID();
  const result = await actor.sb.from("diary_entries").insert({
    id,
    baby_id: babyId,
    author_id: actor.user.id,
    entry_date: "2026-09-14",
    body,
    client_generated_id: crypto.randomUUID(),
  }).select("id").single();
  if (result.error) throw result.error;
  return id;
}

async function insertMemory(actor, babyId, privacyType, status, caption) {
  const id = crypto.randomUUID();
  const result = await actor.sb.from("memory_posts").insert({
    id,
    baby_id: babyId,
    author_id: actor.user.id,
    privacy_type: privacyType,
    status,
    caption,
  });
  if (result.error) {
    throw new Error(`memory fixture insert failed (${privacyType}/${status}/${caption}): ${safeError(result)}`);
  }
  return id;
}

async function visibleCount(actor, postId) {
  const result = await actor.sb.from("memory_posts").select("id").eq("id", postId);
  if (result.error) throw result.error;
  return result.data.length;
}

async function cleanupBabyFixtures(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return;
  // Care DELETE triggers recompute reminder state, so it must run while the
  // parent baby still exists. Remaining fixture rows cascade from the baby.
  const careCleanup = await service.from("care_logs").delete().in("baby_id", uniqueIds);
  if (careCleanup.error) throw careCleanup.error;
  const babyCleanup = await service.from("babies").delete().in("id", uniqueIds);
  if (babyCleanup.error) throw babyCleanup.error;
}

async function cleanupStaleQaFixtures() {
  const [ownershipRows, identityRows] = await Promise.all([
    service.from("babies").select("id").ilike("name", "B04a ownership %"),
    service.from("babies").select("id").ilike("name", "B04a identity %"),
  ]);
  if (ownershipRows.error) throw ownershipRows.error;
  if (identityRows.error) throw identityRows.error;
  await cleanupBabyFixtures([
    ...(ownershipRows.data ?? []).map((row) => row.id),
    ...(identityRows.data ?? []).map((row) => row.id),
  ]);
}

let babyOne;
let babyTwo;
try {
  await cleanupStaleQaFixtures();
  babyOne = await createBaby(owner, `B04a ownership ${crypto.randomUUID()}`);
  babyTwo = await createBaby(owner, `B04a identity ${crypto.randomUUID()}`);
  for (const account of [coAdmin, editor, otherEditor, viewer, removed, selected, tagged]) {
    const role = account === viewer || account === selected || account === tagged ? "viewer" : "editor";
    await addMember(owner, babyOne, account, role);
  }
  await promoteFullAdmin(owner, babyOne, coAdmin);
  await addMember(owner, babyTwo, editor, "editor");
  const friendRow = await service.from("memory_friends").insert({
    baby_id: babyOne,
    user_id: friend.user.id,
    invited_by: owner.user.id,
    status: "active",
  });
  if (friendRow.error) throw friendRow.error;

  const careOwner = await insertCare(owner, babyOne, "feeding");
  const careEditor = await insertCare(editor, babyOne, "sleep");
  const growthOwner = await insertGrowth(owner, babyOne, 5.1);
  const growthEditor = await insertGrowth(editor, babyOne, 5.2);
  const diaryEditor = await insertDiary(editor, babyOne, "editor diary");
  const diaryViewer = await insertDiary(otherEditor, babyOne, "future viewer diary");
  const diaryRemoved = await insertDiary(removed, babyOne, "removed diary");

  const memoryFamily = await insertMemory(editor, babyOne, "family_circle", "published", "family");
  const memoryPosting = await insertMemory(editor, babyOne, "family_circle", "posting", "posting");
  const memoryFailed = await insertMemory(editor, babyOne, "family_circle", "failed", "failed");
  const memoryFriend = await insertMemory(editor, babyOne, "friend_circle", "published", "friend");
  const memoryOnly = await insertMemory(editor, babyOne, "only_me", "published", "only");
  const memoryRemoved = await insertMemory(removed, babyOne, "only_me", "published", "removed only");
  const memoryTagged = await insertMemory(editor, babyOne, "tagged_family", "published", "tagged");
  const memorySelected = await insertMemory(editor, babyOne, "selected_people", "published", "selected");

  const validTag = await editor.sb.from("memory_tags").insert({
    memory_post_id: memoryTagged,
    tag_type: "family_member",
    tagged_user_id: tagged.user.id,
    status: "approved",
    created_by: editor.user.id,
  });
  if (validTag.error) throw validTag.error;
  const validSelected = await editor.sb.from("memory_selected_people").insert({
    memory_post_id: memorySelected,
    user_id: selected.user.id,
  });
  if (validSelected.error) throw validSelected.error;

  const removedComment = await removed.sb.from("memory_comments").insert({
    memory_post_id: memoryFamily,
    author_id: removed.user.id,
    body: "removed comment",
    comment_type: "text",
  }).select("id").single();
  if (removedComment.error) throw removedComment.error;
  const removedReaction = await removed.sb.from("memory_reactions").insert({
    memory_post_id: memoryFamily,
    author_id: removed.user.id,
    reaction_type: "heart",
  }).select("id").single();
  if (removedReaction.error) throw removedReaction.error;

  await setMember(owner, babyOne, otherEditor, { permission_role: "viewer" });
  await removeMember(coAdmin, babyOne, removed);

  expectDeniedOrEmpty(await editor.sb.from("care_logs").update({ payload: { attack: true } })
    .eq("id", careOwner).select("id"), "editor cannot update another author's Care row");
  expectDeniedOrEmpty(await editor.sb.from("care_logs").delete().eq("id", careOwner).select("id"),
    "editor cannot delete another author's Care row");
  const ownCare = await editor.sb.from("care_logs").update({ payload: { own: true } })
    .eq("id", careEditor).select("id");
  assert(!ownCare.error && ownCare.data.length === 1, "editor own Care positive control failed");
  console.log("PASS editor own Care positive control");
  expectDeniedOrEmpty(await editor.sb.from("care_logs").update({ baby_id: babyTwo })
    .eq("id", careEditor).select("id"), "editor cannot move own Care row");
  const careIdentity = await service.from("care_logs").select("baby_id,created_by").eq("id", careEditor).single();
  assert(!careIdentity.error && careIdentity.data.baby_id === babyOne && careIdentity.data.created_by === editor.user.id,
    "Care identity changed after denied update");

  expectDeniedOrEmpty(await editor.sb.from("growth_records").update({ weight_kg: 9 })
    .eq("id", growthOwner).select("id"), "editor cannot update another author's Growth row");
  expectDeniedOrEmpty(await editor.sb.from("growth_records").delete().eq("id", growthOwner).select("id"),
    "editor cannot delete another author's Growth row");
  const ownGrowth = await editor.sb.from("growth_records").update({ weight_kg: 5.3 })
    .eq("id", growthEditor).select("id");
  assert(!ownGrowth.error && ownGrowth.data.length === 1, "editor own Growth positive control failed");
  console.log("PASS editor own Growth positive control");
  expectDeniedOrEmpty(await editor.sb.from("growth_records").update({ baby_id: babyTwo })
    .eq("id", growthEditor).select("id"), "editor cannot move own Growth row");

  expectDeniedOrEmpty(await otherEditor.sb.from("diary_entries").update({ body: "stale" })
    .eq("id", diaryViewer).select("id"), "viewer author cannot update Diary");
  expectDenied(await removed.sb.rpc("soft_delete_diary_entry", { p_diary_entry_id: diaryRemoved }),
    "removed author cannot soft-delete Diary");
  const ownDiary = await editor.sb.from("diary_entries").update({ body: "own edit" })
    .eq("id", diaryEditor).select("id");
  assert(!ownDiary.error && ownDiary.data.length === 1, "editor own Diary positive control failed");
  console.log("PASS editor own Diary positive control");

  expectDeniedOrEmpty(await otherEditor.sb.from("memory_posts").update({ caption: "stale" })
    .eq("id", memoryFamily).select("id"), "viewer cannot update another Memory");
  expectDenied(await removed.sb.rpc("soft_delete_memory_post", { p_memory_post_id: memoryRemoved }),
    "removed author cannot soft-delete Memory");
  const ownMemory = await editor.sb.from("memory_posts").update({ caption: "own edit" })
    .eq("id", memoryFamily).select("id");
  assert(!ownMemory.error && ownMemory.data.length === 1, "editor own Memory positive control failed");
  console.log("PASS editor own Memory positive control");

  assert(await visibleCount(viewer, memoryFamily) === 1, "family viewer cannot see published family_circle");
  assert(await visibleCount(viewer, memoryPosting) === 0, "viewer saw posting Memory");
  assert(await visibleCount(viewer, memoryFailed) === 0, "viewer saw failed Memory");
  assert(await visibleCount(editor, memoryPosting) === 1, "current author cannot see own posting Memory");
  assert(await visibleCount(editor, memoryFailed) === 1, "current author cannot see own failed Memory");
  assert(await visibleCount(friend, memoryFriend) === 1, "friend cannot see friend_circle");
  assert(await visibleCount(friend, memoryFamily) === 0, "friend saw family_circle");
  assert(await visibleCount(outsider, memoryFamily) === 0, "outsider saw family_circle");
  assert(await visibleCount(editor, memoryOnly) === 1, "author cannot see only_me");
  assert(await visibleCount(viewer, memoryOnly) === 0, "other family member saw only_me");
  assert(await visibleCount(removed, memoryRemoved) === 0, "removed author saw only_me");
  console.log("PASS five Memory visibility modes and unpublished boundary");

  assert(await visibleCount(tagged, memoryTagged) === 1, "active tagged family recipient cannot see post");
  expectDenied(await editor.sb.from("memory_tags").insert({
    memory_post_id: memoryTagged,
    tag_type: "family_member",
    tagged_user_id: outsider.user.id,
    status: "approved",
    created_by: editor.user.id,
  }), "external account cannot receive family tag");
  await setMember(owner, babyOne, tagged, { status: "inactive" });
  assert(await visibleCount(tagged, memoryTagged) === 0, "inactive tagged recipient retained access");
  console.log("PASS family-tag current-membership revocation");
  await setMember(owner, babyOne, tagged, { status: "active" });

  assert(await visibleCount(selected, memorySelected) === 1, "active selected member cannot see post");
  expectDenied(await editor.sb.from("memory_selected_people").insert({
    memory_post_id: memorySelected,
    user_id: outsider.user.id,
  }), "unrelated account cannot receive selected_people grant");
  await setMember(owner, babyOne, selected, { status: "inactive" });
  assert(await visibleCount(selected, memorySelected) === 0, "inactive selected recipient retained access");
  const selectFriend = await editor.sb.from("memory_selected_people").insert({
    memory_post_id: memorySelected,
    user_id: friend.user.id,
  });
  if (selectFriend.error) throw selectFriend.error;
  assert(await visibleCount(friend, memorySelected) === 1, "selected active Memory friend cannot see post");
  console.log("PASS selected_people eligibility and revocation");

  expectDenied(await viewer.sb.from("memory_comments").insert({
    memory_post_id: memoryFamily,
    author_id: viewer.user.id,
    body: "viewer attack",
    comment_type: "text",
  }), "viewer cannot comment");
  const dualRelation = await service.from("memory_friends").insert({
    baby_id: babyOne,
    user_id: viewer.user.id,
    invited_by: owner.user.id,
    status: "active",
  });
  if (dualRelation.error) throw dualRelation.error;
  const taggedDualRelation = await service.from("memory_friends").insert({
    baby_id: babyOne,
    user_id: tagged.user.id,
    invited_by: owner.user.id,
    status: "active",
  });
  if (taggedDualRelation.error) throw taggedDualRelation.error;
  const dualViewerComment = await viewer.sb.from("memory_comments").insert({
    memory_post_id: memoryFamily,
    author_id: viewer.user.id,
    body: "mixed authority",
    comment_type: "text",
  });
  if (dualViewerComment.error) throw dualViewerComment.error;
  assert(await visibleCount(tagged, memoryTagged) === 1,
    "tagged family plus Memory-friend lost legitimate tagged visibility");
  const taggedFriendComment = await tagged.sb.from("memory_comments").insert({
    memory_post_id: memoryTagged,
    author_id: tagged.user.id,
    body: "mixed tagged authority",
    comment_type: "text",
  });
  if (taggedFriendComment.error) throw taggedFriendComment.error;
  const dualViewerReaction = await viewer.sb.from("memory_reactions").insert({
    memory_post_id: memoryFamily,
    author_id: viewer.user.id,
    reaction_type: "heart",
  });
  if (dualViewerReaction.error) throw dualViewerReaction.error;
  console.log("PASS active Memory-friend social capabilities override the legacy viewer preset");
  const editorComment = await editor.sb.from("memory_comments").insert({
    memory_post_id: memoryFamily,
    author_id: editor.user.id,
    body: "editor comment",
    comment_type: "text",
  });
  if (editorComment.error) throw editorComment.error;
  const friendComment = await friend.sb.from("memory_comments").insert({
    memory_post_id: memoryFriend,
    author_id: friend.user.id,
    body: "friend comment",
    comment_type: "text",
  });
  if (friendComment.error) throw friendComment.error;
  expectDenied(await friend.sb.from("memory_comments").insert({
    memory_post_id: memoryFamily,
    author_id: friend.user.id,
    body: "cross-scope",
    comment_type: "text",
  }), "friend cannot comment across visibility boundary");
  expectDeniedOrEmpty(await removed.sb.from("memory_comments").update({ body: "stale" })
    .eq("id", removedComment.data.id).select("id"), "removed comment author cannot update");
  expectDeniedOrEmpty(await removed.sb.from("memory_comments").delete()
    .eq("id", removedComment.data.id).select("id"), "removed comment author cannot delete");
  const moderate = await owner.sb.from("memory_comments").delete()
    .eq("id", removedComment.data.id).select("id");
  assert(!moderate.error && moderate.data.length === 1, "admin comment moderation positive control failed");
  expectDeniedOrEmpty(await removed.sb.from("memory_reactions").update({ reaction_type: "wow" })
    .eq("id", removedReaction.data.id).select("id"), "removed reaction author cannot update");
  expectDeniedOrEmpty(await removed.sb.from("memory_reactions").delete()
    .eq("id", removedReaction.data.id).select("id"), "removed reaction author cannot delete");
  console.log("PASS comments/reactions current-authorization boundary");

  await setMember(owner, babyOne, editor, { permission_role: "editor" });
  const [raceWrite, raceDemotion] = await Promise.all([
    editor.sb.from("care_logs").update({ payload: { race: true } }).eq("id", careEditor).select("id"),
    owner.sb.from("baby_members").update({ permission_role: "viewer" })
      .eq("baby_id", babyOne).eq("user_id", editor.user.id).select("id"),
  ]);
  assert(!raceDemotion.error && raceDemotion.data.length === 1, "role-transition race demotion failed");
  if (!raceWrite.error && raceWrite.data.length > 0) {
    assert(raceWrite.data.length === 1, "role-transition race affected multiple rows");
  }
  expectDeniedOrEmpty(await editor.sb.from("care_logs").update({ payload: { stale: true } })
    .eq("id", careEditor).select("id"), "same JWT cannot write after committed demotion");
  expectDenied(await editor.sb.from("care_logs").insert({
    id: crypto.randomUUID(), baby_id: babyOne, client_generated_id: crypto.randomUUID(),
    category: "feeding", recorded_at: new Date().toISOString(), date_key: "2026-09-14",
    time_local: "16:00", payload: {}, source: "manual", created_by: editor.user.id,
  }), "same JWT cannot insert Care after committed demotion");
  expectDenied(await editor.sb.from("growth_records").insert({
    id: crypto.randomUUID(), baby_id: babyOne, client_generated_id: crypto.randomUUID(),
    measured_at: "2026-09-14", weight_kg: 5.4, source: "home", input_method: "manual",
    user_confirmed: true, created_by: editor.user.id,
  }), "same JWT cannot insert Growth after committed demotion");
  expectDenied(await editor.sb.from("diary_entries").insert({
    id: crypto.randomUUID(), baby_id: babyOne, author_id: editor.user.id,
    entry_date: "2026-09-14", body: "stale insert", client_generated_id: crypto.randomUUID(),
  }), "same JWT cannot insert Diary after committed demotion");
  expectDenied(await editor.sb.from("memory_posts").insert({
    id: crypto.randomUUID(), baby_id: babyOne, author_id: editor.user.id,
    privacy_type: "family_circle", status: "published", caption: "stale insert",
  }), "same JWT cannot insert Memory after committed demotion");
  console.log(`PASS QA role-transition race (${raceWrite.error || raceWrite.data.length === 0 ? "demotion-first reject" : "write-first commit"})`);

  console.log("B0.4a-2/B0.4a-3 QA integrated attack regression passed");
} finally {
  try {
    await cleanupBabyFixtures(babyIds);
  } finally {
    await cleanupQaAccounts(accounts);
  }
}
