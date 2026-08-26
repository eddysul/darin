import { cleanupQaAccounts, createQaAccounts } from "./lib/qa-auth.mjs";

const accounts = await createQaAccounts([
  "SharingOwner", "SharingEditor", "SharingViewer", "SharingFriend", "SharingOutsider",
]);
const [owner, editor, viewer, friend, outsider] = accounts;
let babyId = null;

function expectBlockedRows(result, message) {
  if (result.error || result.data?.length) throw new Error(message);
}

try {
  const { data: baby, error: babyError } = await owner.sb.rpc("create_baby_with_owner", {
    p_name: `공유권한QA-${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw babyError ?? new Error("baby creation failed");
  babyId = baby.id;

  for (const [account, role] of [[editor, "editor"], [viewer, "viewer"]]) {
    const { error } = await owner.sb.from("baby_members").insert({
      baby_id: babyId,
      user_id: account.user.id,
      permission_role: role,
      relationship_label: "가족",
      status: "active",
    });
    if (error) throw error;
  }
  const { error: friendError } = await owner.sb.from("memory_friends").insert({
    baby_id: babyId,
    user_id: friend.user.id,
    invited_by: owner.user.id,
    status: "active",
  });
  if (friendError) throw friendError;

  const now = new Date();
  const { data: editorLog, error: editorLogError } = await editor.sb.from("care_logs").insert({
    baby_id: babyId,
    client_generated_id: `editor-log-${crypto.randomUUID()}`,
    category: "formula",
    recorded_at: now.toISOString(),
    date_key: now.toISOString().slice(0, 10),
    time_local: now.toISOString().slice(11, 16),
    payload: {},
    source: "manual",
    created_by: editor.user.id,
  }).select("id").single();
  if (editorLogError || !editorLog) throw editorLogError ?? new Error("editor care log insert failed");

  const { data: editorDiary, error: editorDiaryError } = await editor.sb.from("diary_entries").insert({
    baby_id: babyId,
    author_id: editor.user.id,
    entry_date: now.toISOString().slice(0, 10),
    title: "editor diary QA",
    body: "editor can create",
    metadata: {},
  }).select("id").single();
  if (editorDiaryError || !editorDiary) throw editorDiaryError ?? new Error("editor diary insert failed");

  const { data: editorGrowth, error: editorGrowthError } = await editor.sb.from("growth_records").insert({
    baby_id: babyId,
    measured_at: now.toISOString().slice(0, 10),
    height_cm: 60,
    weight_kg: 6,
    head_circumference_cm: 40,
    source: "home",
    input_method: "manual",
    created_by: editor.user.id,
  }).select("id").single();
  if (editorGrowthError || !editorGrowth) throw editorGrowthError ?? new Error("editor growth insert failed");
  console.log("PASS editor can create care logs, diary entries, and growth records");

  const viewerCareUpdate = await viewer.sb.from("care_logs").update({ payload: { blocked: true } })
    .eq("id", editorLog.id).select("id");
  const viewerGrowthUpdate = await viewer.sb.from("growth_records").update({ weight_kg: 9 })
    .eq("id", editorGrowth.id).select("id");
  const viewerDiaryInsert = await viewer.sb.from("diary_entries").insert({
    baby_id: babyId,
    author_id: viewer.user.id,
    entry_date: now.toISOString().slice(0, 10),
    body: "blocked viewer diary",
  }).select("id");
  expectBlockedRows(viewerCareUpdate, "viewer changed care log");
  expectBlockedRows(viewerGrowthUpdate, "viewer changed growth record");
  if (!viewerDiaryInsert.error) throw new Error("viewer created diary entry");
  console.log("PASS viewer cannot create diary entries or modify care/growth records");

  const posts = [];
  for (const privacy of ["family_circle", "friend_circle", "only_me"]) {
    const { data, error } = await owner.sb.from("memory_posts").insert({
      baby_id: babyId,
      author_id: owner.user.id,
      caption: `${privacy} QA`,
      privacy_type: privacy,
      status: "published",
    }).select("id,privacy_type").single();
    if (error || !data) throw error ?? new Error(`${privacy} post failed`);
    posts.push(data);
  }
  const familyPost = posts.find((post) => post.privacy_type === "family_circle");
  const friendPost = posts.find((post) => post.privacy_type === "friend_circle");

  const viewerFriendCircle = await viewer.sb.from("memory_posts").select("id").eq("id", friendPost.id);
  if (viewerFriendCircle.error || viewerFriendCircle.data?.length !== 1) {
    throw new Error("family viewer could not see friend_circle memory");
  }

  const { error: viewerCommentError } = await viewer.sb.from("memory_comments").insert({
    memory_post_id: familyPost.id,
    author_id: viewer.user.id,
    body: "viewer comment",
    comment_type: "text",
  });
  if (viewerCommentError) throw viewerCommentError;
  console.log("PASS viewer can comment on a visible family memory");

  const { data: friendVisiblePosts, error: friendVisibleError } = await friend.sb.from("memory_posts")
    .select("id,privacy_type").eq("baby_id", babyId);
  if (friendVisibleError || friendVisiblePosts?.length !== 1
      || friendVisiblePosts[0].id !== friendPost.id) {
    throw new Error("friend memory visibility exceeded friend_circle");
  }
  const { error: friendCommentError } = await friend.sb.from("memory_comments").insert({
    memory_post_id: friendPost.id,
    author_id: friend.user.id,
    body: "friend comment",
    comment_type: "text",
  });
  if (friendCommentError) throw friendCommentError;
  const blockedFriendComment = await friend.sb.from("memory_comments").insert({
    memory_post_id: familyPost.id,
    author_id: friend.user.id,
    body: "blocked friend comment",
    comment_type: "text",
  });
  if (!blockedFriendComment.error) throw new Error("friend commented outside friend_circle visibility");
  console.log("PASS friend can read/comment only on friend_circle memories");

  for (const table of ["care_logs", "diary_entries", "growth_records", "babies"]) {
    const result = await friend.sb.from(table).select("*").eq(table === "babies" ? "id" : "baby_id", babyId);
    if (result.error || result.data?.length) throw new Error(`friend accessed private ${table}`);
  }
  const outsiderMemories = await outsider.sb.from("memory_posts").select("id").eq("baby_id", babyId);
  if (outsiderMemories.error || outsiderMemories.data?.length) throw new Error("outsider accessed shared memories");
  console.log("PASS friend/outsider cannot access baby profile, care, diary, or growth data");

  const selfTarget = `self-comment-${crypto.randomUUID()}`;
  const { error: selfPushError } = await owner.sb.functions.invoke("send-push-notification", {
    body: {
      action: "sendToBabyMembers",
      eventType: "memory_comment",
      babyId,
      targetId: selfTarget,
      routeData: { route: "memory", memoryPostId: familyPost.id, babyId },
    },
  });
  if (selfPushError) throw selfPushError;
  const selfEvents = await owner.sb.from("notification_events").select("id")
    .eq("baby_id", babyId).eq("actor_id", owner.user.id).eq("recipient_id", owner.user.id)
    .eq("event_type", "memory_comment");
  if (selfEvents.error || selfEvents.data?.length) throw new Error("actor received own activity notification");
  console.log("PASS ordinary activity notifications exclude the actor");
} finally {
  if (babyId) await owner.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts(accounts);
}
