import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";

assertQaProjectEnvironment();

const accounts = await createQaAccounts([
  "B04aFinalAdmin", "B04aFinalEditor", "B04aFinalViewer", "B04aFinalRemoved",
  "B04aFinalFriend", "B04aFinalOutsider", "B04aFinalOtherAdmin", "B04aFinalDeletedActor",
]);
const [admin, editor, viewer, removed, friend, outsider, otherAdmin, deletedActor] = accounts;
const service = createAdminClient();
const babyIds = [];
let deletedActorRemoved = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function errorText(result) {
  return `${result.error?.message ?? ""} ${result.error?.details ?? ""} ${result.error?.hint ?? ""}`;
}

function assertSafeError(result, label) {
  if (/Bearer\s|eyJ[A-Za-z0-9_-]+\.|@darin\.invalid/i.test(errorText(result))) {
    throw new Error(`${label}: credential material leaked in error`);
  }
}

function expectDenied(result, label) {
  assertSafeError(result, label);
  if (!result.error) throw new Error(`${label}: unexpectedly succeeded`);
  console.log(`PASS ${label}`);
}

function expectDeniedOrEmpty(result, label) {
  assertSafeError(result, label);
  if (!result.error && (result.data?.length ?? 0) !== 0) {
    throw new Error(`${label}: unexpectedly affected ${result.data.length} row(s)`);
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

async function addMember(actor, babyId, account, role, status = "active") {
  const result = await actor.sb.from("baby_members").insert({
    baby_id: babyId,
    user_id: account.user.id,
    permission_role: role,
    relationship_label: "가족",
    status,
  });
  if (result.error) throw result.error;
}

async function setMember(actor, babyId, account, values) {
  const result = await actor.sb.from("baby_members").update(values)
    .eq("baby_id", babyId).eq("user_id", account.user.id).select("id");
  if (result.error || result.data?.length !== 1) throw result.error ?? new Error("membership update failed");
}

async function insertDiary(actor, babyId, body) {
  const id = crypto.randomUUID();
  const result = await actor.sb.from("diary_entries").insert({
    id,
    baby_id: babyId,
    author_id: actor.user.id,
    entry_date: "2026-09-15",
    body,
    client_generated_id: crypto.randomUUID(),
  });
  if (result.error) throw result.error;
  return id;
}

async function cleanupBabies(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return;
  const care = await service.from("care_logs").delete().in("baby_id", uniqueIds);
  if (care.error) throw care.error;
  const babies = await service.from("babies").delete().in("id", uniqueIds);
  if (babies.error) throw babies.error;
}

async function cleanupStaleFixtures() {
  const stale = await service.from("babies").select("id").ilike("name", "B04a final auth %");
  if (stale.error) throw stale.error;
  await cleanupBabies((stale.data ?? []).map(({ id }) => id));
}

let babyOne;
let babyTwo;
let cleanupBaby;
try {
  await cleanupStaleFixtures();
  babyOne = await createBaby(admin, `B04a final auth primary ${crypto.randomUUID()}`);
  babyTwo = await createBaby(otherAdmin, `B04a final auth secondary ${crypto.randomUUID()}`);
  cleanupBaby = await createBaby(admin, `B04a final auth cleanup ${crypto.randomUUID()}`);

  await addMember(admin, babyOne, editor, "editor");
  await addMember(admin, babyOne, viewer, "viewer");
  await addMember(admin, babyOne, removed, "viewer", "inactive");
  await addMember(otherAdmin, babyTwo, editor, "editor");
  await addMember(admin, cleanupBaby, deletedActor, "editor");

  const privateProfile = await service.from("profiles").update({
    display_name: "Final Editor",
    nickname: "Safe display",
    residence_country: "KR",
    guardian_birth_date: "1980-01-01",
  }).eq("id", editor.user.id);
  if (privateProfile.error) throw privateProfile.error;
  const friendLink = await service.from("memory_friends").insert({
    baby_id: babyOne,
    user_id: friend.user.id,
    invited_by: admin.user.id,
    status: "active",
  });
  if (friendLink.error) throw friendLink.error;
  const friendPost = await service.from("memory_posts").insert({
    id: crypto.randomUUID(),
    baby_id: babyOne,
    author_id: editor.user.id,
    privacy_type: "friend_circle",
    status: "published",
    caption: "synthetic friend projection fixture",
  });
  if (friendPost.error) throw friendPost.error;

  const directProfile = await friend.sb.from("profiles").select("*").eq("id", editor.user.id);
  assert(!directProfile.error && directProfile.data.length === 0, "friend read full profile row");
  console.log("PASS friend direct base-profile access denied");
  const visibleProfile = await friend.sb.rpc("list_visible_profile_display", { p_user_ids: [editor.user.id] });
  if (visibleProfile.error || visibleProfile.data?.length !== 1) throw visibleProfile.error ?? new Error("friend projection failed");
  const projectionKeys = Object.keys(visibleProfile.data[0]).sort();
  assert(JSON.stringify(projectionKeys) === JSON.stringify([
    "avatar_storage_path", "default_relation", "display_name", "nickname", "user_id",
  ]), `unsafe profile projection keys: ${projectionKeys.join(",")}`);
  console.log("PASS friend-safe profile projection returns only approved fields");
  const nonContributor = await friend.sb.rpc("list_visible_profile_display", { p_user_ids: [admin.user.id] });
  assert(!nonContributor.error && nonContributor.data.length === 0, "friend saw non-contributor profile");
  const unrelatedProfile = await outsider.sb.rpc("list_visible_profile_display", { p_user_ids: [editor.user.id] });
  assert(!unrelatedProfile.error && unrelatedProfile.data.length === 0, "unrelated user saw profile projection");
  const removedFriend = await service.from("memory_friends").update({ status: "revoked" })
    .eq("baby_id", babyOne).eq("user_id", friend.user.id);
  if (removedFriend.error) throw removedFriend.error;
  const removedProjection = await friend.sb.rpc("list_visible_profile_display", { p_user_ids: [editor.user.id] });
  assert(!removedProjection.error && removedProjection.data.length === 0, "removed friend retained profile projection");
  console.log("PASS unrelated/non-contributor/removed profile projection denied");

  const adminProtected = await admin.sb.from("babies").update({ birth_date: "2026-01-02" })
    .eq("id", babyOne).select("id");
  assert(!adminProtected.error && adminProtected.data.length === 1, "admin protected baby update failed");
  const editorPresentation = await editor.sb.from("babies").update({ name: "B04a final auth renamed" })
    .eq("id", babyOne).select("id");
  assert(!editorPresentation.error && editorPresentation.data.length === 1, "editor presentation update failed");
  expectDenied(await editor.sb.from("babies").update({ birth_date: "2027-01-01" }).eq("id", babyOne).select("id"),
    "editor protected baby field denied");
  for (const [actor, label] of [
    [viewer, "viewer"], [friend, "friend"], [outsider, "unrelated"], [removed, "removed member"],
    [otherAdmin, "wrong-baby admin"],
  ]) {
    expectDeniedOrEmpty(await actor.sb.from("babies").update({ name: `${label} attack` })
      .eq("id", babyOne).select("id"), `${label} baby update denied`);
  }
  expectDenied(await admin.sb.from("babies").update({ created_by: null }).eq("id", babyOne).select("id"),
    "direct baby creator anonymization denied");
  console.log("PASS baby profile role matrix positive controls");

  const cautionAdmin = crypto.randomUUID();
  const cautionEditor = crypto.randomUUID();
  const adminFood = await admin.sb.from("baby_caution_foods").insert({
    id: cautionAdmin, baby_id: babyOne, food_name: "milk", normalized_food_name: "milk", created_by: admin.user.id,
  });
  if (adminFood.error) throw adminFood.error;
  const editorFood = await editor.sb.from("baby_caution_foods").insert({
    id: cautionEditor, baby_id: babyOne, food_name: "egg", normalized_food_name: "egg", created_by: editor.user.id,
  });
  if (editorFood.error) throw editorFood.error;
  const viewerReadFood = await viewer.sb.from("baby_caution_foods").select("id").eq("id", cautionAdmin);
  assert(!viewerReadFood.error && viewerReadFood.data.length === 1, "viewer caution-food read failed");
  for (const [actor, label] of [[viewer, "viewer"], [friend, "friend"], [outsider, "unrelated"], [removed, "removed"]]) {
    expectDenied(await actor.sb.from("baby_caution_foods").insert({
      id: crypto.randomUUID(), baby_id: babyOne, food_name: `${label}-attack`,
      normalized_food_name: `${label}-${crypto.randomUUID()}`, created_by: actor.user.id,
    }), `${label} caution-food insert denied`);
  }
  const editorFoodUpdate = await editor.sb.from("baby_caution_foods").update({ food_name: "egg updated" })
    .eq("id", cautionEditor).select("id");
  assert(!editorFoodUpdate.error && editorFoodUpdate.data.length === 1, "editor caution-food update failed");
  expectDeniedOrEmpty(await viewer.sb.from("baby_caution_foods").update({ food_name: "viewer attack" })
    .eq("id", cautionAdmin).select("id"), "viewer caution-food update denied");
  expectDeniedOrEmpty(await editor.sb.from("baby_caution_foods").delete().eq("id", cautionAdmin).select("id"),
    "editor caution-food delete denied");
  const adminFoodDelete = await admin.sb.from("baby_caution_foods").delete().eq("id", cautionAdmin).select("id");
  assert(!adminFoodDelete.error && adminFoodDelete.data.length === 1, "admin caution-food delete failed");
  for (const [actor, label] of [[friend, "friend"], [outsider, "unrelated"], [removed, "removed"]]) {
    const read = await actor.sb.from("baby_caution_foods").select("id").eq("id", cautionEditor);
    assert(!read.error && read.data.length === 0, `${label} read caution food`);
  }
  console.log("PASS caution-food role matrix and positive controls");

  const diaryOne = await insertDiary(editor, babyOne, "same-baby diary");
  const diaryTwo = await insertDiary(editor, babyTwo, "other-baby diary");
  const bookOne = crypto.randomUUID();
  const bookTwo = crypto.randomUUID();
  const pageOne = crypto.randomUUID();
  const pageTwo = crypto.randomUUID();
  const hiddenPage = crypto.randomUUID();
  const mediaOne = crypto.randomUUID();
  const commentOne = crypto.randomUUID();
  const hiddenComment = crypto.randomUUID();
  const inserts = [
    await editor.sb.from("growth_books").insert({ id: bookOne, baby_id: babyOne, title: "Final book one", created_by: editor.user.id }),
    await otherAdmin.sb.from("growth_books").insert({ id: bookTwo, baby_id: babyTwo, title: "Final book two", created_by: otherAdmin.user.id }),
  ];
  for (const result of inserts) if (result.error) throw result.error;
  const pageInsertOne = await editor.sb.from("growth_book_pages").insert({
    id: pageOne, growth_book_id: bookOne, baby_id: babyOne, page_type: "custom", page_order: 0,
    content_json: { fixture: true }, created_by: editor.user.id,
  });
  const pageInsertTwo = await otherAdmin.sb.from("growth_book_pages").insert({
    id: pageTwo, growth_book_id: bookTwo, baby_id: babyTwo, page_type: "custom", page_order: 0,
    content_json: { fixture: true }, created_by: otherAdmin.user.id,
  });
  const hiddenPageInsert = await editor.sb.from("growth_book_pages").insert({
    id: hiddenPage, growth_book_id: bookOne, baby_id: babyOne, page_type: "custom", page_order: 1,
    content_json: { fixture: true }, created_by: editor.user.id,
  });
  for (const result of [pageInsertOne, pageInsertTwo, hiddenPageInsert]) if (result.error) throw result.error;
  const mediaInsert = await editor.sb.from("growth_book_media").insert({
    id: mediaOne, growth_book_id: bookOne, page_id: pageOne, baby_id: babyOne,
    storage_path: `${babyOne}/${bookOne}/${pageOne}/${mediaOne}.png`, media_type: "image", created_by: editor.user.id,
  });
  if (mediaInsert.error) throw mediaInsert.error;
  const commentInsert = await editor.sb.from("growth_book_comments").insert({
    id: commentOne, growth_book_id: bookOne, page_id: pageOne, baby_id: babyOne,
    author_id: editor.user.id, body: "valid comment", comment_type: "page_comment",
  });
  const hiddenCommentInsert = await editor.sb.from("growth_book_comments").insert({
    id: hiddenComment, growth_book_id: bookOne, page_id: hiddenPage, baby_id: babyOne,
    author_id: editor.user.id, body: "hidden parent comment", comment_type: "page_comment",
  });
  for (const result of [commentInsert, hiddenCommentInsert]) if (result.error) throw result.error;

  const viewerPage = await viewer.sb.from("growth_book_pages").select("id").eq("id", pageOne);
  assert(!viewerPage.error && viewerPage.data.length === 1, "same-baby page positive control failed");
  const viewerMedia = await viewer.sb.from("growth_book_media").select("id").eq("id", mediaOne);
  assert(!viewerMedia.error && viewerMedia.data.length === 1, "valid parent media positive control failed");
  const viewerComment = await viewer.sb.from("growth_book_comments").select("id").eq("id", commentOne);
  assert(!viewerComment.error && viewerComment.data.length === 1, "valid comment read positive control failed");
  expectDenied(await viewer.sb.from("growth_book_comments").insert({
    id: crypto.randomUUID(), growth_book_id: bookOne, page_id: pageOne, baby_id: babyOne,
    author_id: viewer.user.id, body: "viewer attack", comment_type: "page_comment",
  }), "viewer growthbook comment insert denied");
  expectDenied(await editor.sb.from("growth_book_media").insert({
    id: crypto.randomUUID(), growth_book_id: bookOne, page_id: pageTwo, baby_id: babyOne,
    storage_path: `${babyOne}/${bookOne}/${pageTwo}/bad.png`, media_type: "image", created_by: editor.user.id,
  }), "wrong-page media attach denied");
  expectDenied(await editor.sb.from("growth_book_pages").insert({
    id: crypto.randomUUID(), growth_book_id: bookOne, baby_id: babyOne, page_type: "diary", page_order: 3,
    diary_entry_id: diaryTwo, created_by: editor.user.id,
  }), "cross-baby diary page attach denied");
  expectDenied(await editor.sb.from("growth_book_comments").insert({
    id: crypto.randomUUID(), growth_book_id: bookOne, page_id: pageOne, diary_entry_id: diaryTwo,
    baby_id: babyOne, author_id: editor.user.id, body: "cross diary", comment_type: "page_comment",
  }), "cross-baby diary comment denied");
  expectDenied(await editor.sb.from("growth_book_pages").update({ growth_book_id: bookTwo, baby_id: babyTwo })
    .eq("id", pageOne).select("id"), "cross-book page reassignment denied");
  const pageIdentity = await service.from("growth_book_pages").select("growth_book_id,baby_id").eq("id", pageOne).single();
  assert(!pageIdentity.error && pageIdentity.data.growth_book_id === bookOne && pageIdentity.data.baby_id === babyOne,
    "page parent changed after denied reassignment");
  const crossBabyMedia = await viewer.sb.from("growth_book_media").select("id").eq("growth_book_id", bookTwo);
  assert(!crossBabyMedia.error && crossBabyMedia.data.length === 0, "cross-baby media visible by direct id scope");
  const outsiderComment = await outsider.sb.from("growth_book_comments").select("id").eq("id", commentOne);
  assert(!outsiderComment.error && outsiderComment.data.length === 0, "unrelated comment visible");
  const hidePage = await service.from("growth_book_pages").update({ deleted_at: new Date().toISOString() }).eq("id", hiddenPage);
  if (hidePage.error) throw hidePage.error;
  const hiddenCommentRead = await viewer.sb.from("growth_book_comments").select("id").eq("id", hiddenComment);
  assert(!hiddenCommentRead.error && hiddenCommentRead.data.length === 0, "comment under hidden parent remained visible");
  for (const [table, id, column] of [
    ["growth_books", bookOne, "created_by"], ["growth_book_pages", pageOne, "created_by"],
    ["growth_book_media", mediaOne, "created_by"], ["growth_book_comments", commentOne, "author_id"],
  ]) {
    expectDeniedOrEmpty(await editor.sb.from(table).update({ [column]: null }).eq("id", id).select("id"),
      `direct ${table} ownership anonymization denied`);
  }
  const ownershipRows = await Promise.all([
    service.from("growth_books").select("created_by").eq("id", bookOne).single(),
    service.from("growth_book_pages").select("created_by").eq("id", pageOne).single(),
    service.from("growth_book_media").select("created_by").eq("id", mediaOne).single(),
    service.from("growth_book_comments").select("author_id").eq("id", commentOne).single(),
  ]);
  assert(!ownershipRows[0].error && ownershipRows[0].data.created_by === editor.user.id,
    "growth book ownership changed after denied update");
  assert(!ownershipRows[1].error && ownershipRows[1].data.created_by === editor.user.id,
    "growth page ownership changed after denied update");
  assert(!ownershipRows[2].error && ownershipRows[2].data.created_by === editor.user.id,
    "growth media ownership changed after denied update");
  assert(!ownershipRows[3].error && ownershipRows[3].data.author_id === editor.user.id,
    "growth comment ownership changed after denied update");
  console.log("PASS Growthbook graph attacks blocked and positive controls preserved");

  await setMember(admin, babyOne, editor, { permission_role: "viewer" });
  expectDeniedOrEmpty(await editor.sb.from("growth_book_pages").update({ content_json: { stale: true } })
    .eq("id", pageOne).select("id"), "same-token editor-to-viewer privilege revoked");
  expectDenied(await editor.sb.from("baby_caution_foods").insert({
    id: crypto.randomUUID(), baby_id: babyOne, food_name: "stale viewer", normalized_food_name: crypto.randomUUID(),
    created_by: editor.user.id,
  }), "same-token caution-food privilege revoked after demotion");
  await setMember(admin, babyOne, editor, { permission_role: "editor" });
  await setMember(admin, babyOne, editor, { status: "inactive" });
  const staleRead = await editor.sb.from("growth_book_pages").select("id").eq("id", pageOne);
  assert(!staleRead.error && staleRead.data.length === 0, "same token retained read after membership removal");
  expectDeniedOrEmpty(await editor.sb.from("growth_book_pages").update({ content_json: { stale: true } })
    .eq("id", pageOne).select("id"), "same-token active-to-removed write revoked");
  console.log("PASS current membership overrides stale authenticated context");
  await setMember(admin, babyOne, editor, { status: "active" });

  const cleanupDiary = crypto.randomUUID();
  const cleanupDiaryResult = await service.from("diary_entries").insert({
    id: cleanupDiary,
    baby_id: cleanupBaby,
    author_id: deletedActor.user.id,
    entry_date: "2026-09-15",
    body: "soft-deleted cleanup diary",
    client_generated_id: crypto.randomUUID(),
  });
  if (cleanupDiaryResult.error) throw cleanupDiaryResult.error;
  const cleanupBook = crypto.randomUUID();
  const cleanupPage = crypto.randomUUID();
  const cleanupMedia = crypto.randomUUID();
  const cleanupComment = crypto.randomUUID();
  const cleanupRows = [
    await deletedActor.sb.from("growth_books").insert({
      id: cleanupBook, baby_id: cleanupBaby, title: "cleanup book", created_by: deletedActor.user.id,
    }),
  ];
  for (const result of cleanupRows) if (result.error) throw result.error;
  const cleanupPageResult = await deletedActor.sb.from("growth_book_pages").insert({
    id: cleanupPage, growth_book_id: cleanupBook, baby_id: cleanupBaby, page_type: "diary", page_order: 0,
    diary_entry_id: cleanupDiary, created_by: deletedActor.user.id,
  });
  if (cleanupPageResult.error) throw cleanupPageResult.error;
  const cleanupMediaResult = await deletedActor.sb.from("growth_book_media").insert({
    id: cleanupMedia, growth_book_id: cleanupBook, page_id: cleanupPage, baby_id: cleanupBaby,
    storage_path: `${cleanupBaby}/${cleanupBook}/${cleanupPage}/${cleanupMedia}.png`,
    media_type: "image", created_by: deletedActor.user.id,
  });
  if (cleanupMediaResult.error) throw cleanupMediaResult.error;
  const cleanupCommentResult = await deletedActor.sb.from("growth_book_comments").insert({
    id: cleanupComment, growth_book_id: cleanupBook, page_id: cleanupPage, diary_entry_id: cleanupDiary,
    baby_id: cleanupBaby, author_id: deletedActor.user.id, body: "cleanup comment", comment_type: "page_comment",
  });
  if (cleanupCommentResult.error) throw cleanupCommentResult.error;
  for (const [table, id] of [["growth_books", cleanupBook], ["growth_book_pages", cleanupPage]]) {
    const result = await service.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (result.error) throw result.error;
  }
  const softDeleteDiary = await admin.sb.rpc("soft_delete_diary_entry", { p_diary_entry_id: cleanupDiary });
  if (softDeleteDiary.error) throw softDeleteDiary.error;
  const deleted = await service.auth.admin.deleteUser(deletedActor.user.id);
  if (deleted.error) throw deleted.error;
  deletedActorRemoved = true;
  const [bookCleanup, pageCleanup, mediaCleanup, commentCleanup] = await Promise.all([
    service.from("growth_books").select("created_by").eq("id", cleanupBook).single(),
    service.from("growth_book_pages").select("created_by").eq("id", cleanupPage).single(),
    service.from("growth_book_media").select("created_by").eq("id", cleanupMedia).single(),
    service.from("growth_book_comments").select("author_id").eq("id", cleanupComment).single(),
  ]);
  assert(!bookCleanup.error && bookCleanup.data.created_by === null, "soft-deleted book creator cleanup failed");
  assert(!pageCleanup.error && pageCleanup.data.created_by === null, "soft-deleted page creator cleanup failed");
  assert(!mediaCleanup.error && mediaCleanup.data.created_by === null, "media creator cleanup failed");
  assert(!commentCleanup.error && commentCleanup.data.author_id === null, "comment author cleanup failed");
  console.log("PASS auth.users deletion performs FK-driven active/soft-deleted creator cleanup");

  console.log("B0.4a final authorization QA integrated attack regression passed");
} finally {
  await cleanupBabies(babyIds).catch((error) => {
    console.error(`QA fixture baby cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  await cleanupQaAccounts(deletedActorRemoved ? accounts.filter((account) => account !== deletedActor) : accounts);
  const residue = await service.from("babies").select("id").ilike("name", "B04a final auth %");
  if (residue.error || residue.data.length !== 0) {
    throw residue.error ?? new Error(`QA fixture cleanup residue: ${residue.data.length}`);
  }
  console.log("PASS QA synthetic fixture cleanup");
}
