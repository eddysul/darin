import { cleanupQaAccounts, createQaAccounts } from "./lib/qa-auth.mjs";

const accounts = await createQaAccounts(["FriendUiOwner", "FriendUiFriend", "FriendUiOther", "FriendUiInactive"]);
const [owner, friend, outsider, inactive] = accounts;
let babyId = null;
let babyAvatarPath = null;
let ownerAvatarPath = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const { data: baby, error: babyError } = await owner.sb.rpc("create_baby_with_owner", {
    p_name: `친구UIQA-${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw babyError ?? new Error("baby creation failed");
  babyId = baby.id;
  babyAvatarPath = `babies/${babyId}/avatar.png`;
  ownerAvatarPath = `users/${owner.user.id}/avatar.png`;
  const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const path of [babyAvatarPath, ownerAvatarPath]) {
    const { error } = await owner.sb.storage.from("profile-media").upload(path, imageBytes, { contentType: "image/png", upsert: true });
    if (error) throw error;
  }
  const { error: babyAvatarError } = await owner.sb.from("babies").update({ avatar_storage_path: babyAvatarPath }).eq("id", babyId);
  if (babyAvatarError) throw babyAvatarError;
  const { error: ownerAvatarError } = await owner.sb.from("profiles").update({ avatar_storage_path: ownerAvatarPath }).eq("id", owner.user.id);
  if (ownerAvatarError) throw ownerAvatarError;

  for (const [account, status] of [[friend, "active"], [inactive, "revoked"]]) {
    const { error } = await owner.sb.from("memory_friends").insert({
      baby_id: babyId, user_id: account.user.id, invited_by: owner.user.id, status,
    });
    if (error) throw error;
  }

  const before = await friend.sb.rpc("list_my_friend_memory_contexts");
  if (before.error) throw before.error;
  assert(before.data.length === 1 && before.data[0].baby_id === babyId, "active friend did not receive an empty Memories context");
  assert(before.data[0].avatar_storage_path === null && before.data[0].latest_post_at === null, "media metadata exposed before a friend_circle post existed");
  const blockedBabyAvatar = await friend.sb.storage.from("profile-media").createSignedUrl(babyAvatarPath, 60);
  const blockedOwnerAvatar = await friend.sb.storage.from("profile-media").createSignedUrl(ownerAvatarPath, 60);
  assert(Boolean(blockedBabyAvatar.error) && Boolean(blockedOwnerAvatar.error), "profile media opened before a visible friend post existed");

  const posts = {};
  for (const privacy of ["friend_circle", "family_circle", "only_me"]) {
    const { data, error } = await owner.sb.from("memory_posts").insert({
      baby_id: babyId, author_id: owner.user.id, caption: `${privacy} QA`, privacy_type: privacy, status: "published",
    }).select("id").single();
    if (error) throw error;
    posts[privacy] = data.id;
  }
  const { error: tagsError } = await owner.sb.from("memory_tags").insert([
    { memory_post_id: posts.friend_circle, tag_type: "baby", baby_id: babyId, status: "approved", created_by: owner.user.id },
    { memory_post_id: posts.friend_circle, tag_type: "family_member", tagged_user_id: owner.user.id, status: "approved", created_by: owner.user.id },
    { memory_post_id: posts.friend_circle, tag_type: "manual_guest", manual_label: "비공개 손님", status: "approved", created_by: owner.user.id },
  ]);
  if (tagsError) throw tagsError;

  const contexts = await friend.sb.rpc("list_my_friend_memory_contexts");
  if (contexts.error) throw contexts.error;
  assert(contexts.data.length === 1 && contexts.data[0].baby_id === babyId, "minimal friend context missing");
  assert(Object.keys(contexts.data[0]).sort().join(",") === "avatar_storage_path,baby_id,baby_name,latest_post_at", "friend context returned extra baby fields");
  assert(contexts.data[0].avatar_storage_path === babyAvatarPath, "safe baby avatar path missing after friend post publication");
  const allowedBabyAvatar = await friend.sb.storage.from("profile-media").createSignedUrl(babyAvatarPath, 60);
  const allowedOwnerAvatar = await friend.sb.storage.from("profile-media").createSignedUrl(ownerAvatarPath, 60);
  assert(!allowedBabyAvatar.error && !allowedOwnerAvatar.error, "allowed friend UI signed URL was blocked");
  const outsiderBabyAvatar = await outsider.sb.storage.from("profile-media").createSignedUrl(babyAvatarPath, 60);
  assert(Boolean(outsiderBabyAvatar.error), "outsider minted baby avatar signed URL");

  const visible = await friend.sb.from("memory_posts").select("id,privacy_type").eq("baby_id", babyId);
  if (visible.error) throw visible.error;
  assert(visible.data.length === 1 && visible.data[0].id === posts.friend_circle, "friend saw non-friend_circle post");
  const friendTags = await friend.sb.from("memory_tags").select("tag_type,tagged_user_id,manual_label").eq("memory_post_id", posts.friend_circle);
  if (friendTags.error) throw friendTags.error;
  assert(friendTags.data.length === 1 && friendTags.data[0].tag_type === "baby", "friend received family/manual memory tags");
  const familyVisible = await owner.sb.from("memory_posts").select("id").eq("id", posts.friend_circle);
  assert(!familyVisible.error && familyVisible.data.length === 1, "family member could not see friend_circle post");
  for (const table of ["babies", "care_logs", "diary_entries", "growth_records", "baby_members"]) {
    const column = table === "babies" ? "id" : "baby_id";
    const result = await friend.sb.from(table).select("*").eq(column, babyId);
    assert(!result.error && result.data.length === 0, `friend accessed ${table}`);
  }

  const profileRead = await friend.sb.from("profiles").select("id,display_name,avatar_storage_path").eq("id", owner.user.id);
  if (profileRead.error) throw profileRead.error;
  assert(profileRead.data.length === 1, "friend could not read visible post author summary");
  const unrelatedProfile = await friend.sb.from("profiles").select("id").eq("id", outsider.user.id);
  assert(!unrelatedProfile.error && unrelatedProfile.data.length === 0, "friend read an unrelated profile");

  const { data: comment, error: commentError } = await friend.sb.from("memory_comments").insert({
    memory_post_id: posts.friend_circle, author_id: friend.user.id, body: "friend comment", comment_type: "text",
  }).select("id").single();
  if (commentError) throw commentError;
  const { error: reactionError } = await friend.sb.from("memory_reactions").insert({
    memory_post_id: posts.friend_circle, author_id: friend.user.id, reaction_type: "heart",
  });
  if (reactionError) throw reactionError;

  const commentPush = await friend.sb.functions.invoke("send-push-notification", { body: {
    action: "sendToBabyMembers", eventType: "memory_comment", babyId, targetId: comment.id,
    routeData: { route: "memory", memoryPostId: posts.friend_circle, babyId },
  }});
  if (commentPush.error) throw commentPush.error;
  const reactionPush = await friend.sb.functions.invoke("send-push-notification", { body: {
    action: "sendToBabyMembers", eventType: "memory_reaction", babyId,
    targetId: `${posts.friend_circle}:${friend.user.id}:heart`,
    routeData: { route: "memory", memoryPostId: posts.friend_circle, babyId },
  }});
  if (reactionPush.error) throw reactionPush.error;

  const ownerEvents = await owner.sb.from("notification_events").select("event_type,actor_id,recipient_id,data")
    .eq("baby_id", babyId).eq("actor_id", friend.user.id).eq("recipient_id", owner.user.id);
  if (ownerEvents.error) throw ownerEvents.error;
  assert(ownerEvents.data.some((item) => item.event_type === "memory_comment"), "friend comment notification missing");
  assert(ownerEvents.data.some((item) => item.event_type === "memory_reaction"), "friend reaction notification missing");
  const selfEvents = await friend.sb.from("notification_events").select("id").eq("baby_id", babyId).eq("recipient_id", friend.user.id);
  assert(!selfEvents.error && selfEvents.data.length === 0, "friend received own activity notification");

  const blockedFamilyPush = await friend.sb.functions.invoke("send-push-notification", { body: {
    action: "sendToBabyMembers", eventType: "memory_comment", babyId, targetId: comment.id,
    routeData: { route: "memory", memoryPostId: posts.family_circle, babyId },
  }});
  assert(Boolean(blockedFamilyPush.error), "friend notification crossed into family_circle");

  const inactiveContexts = await inactive.sb.rpc("list_my_friend_memory_contexts");
  assert(!inactiveContexts.error && inactiveContexts.data.length === 0, "inactive friend received context");
  const outsiderContexts = await outsider.sb.rpc("list_my_friend_memory_contexts");
  assert(!outsiderContexts.error && outsiderContexts.data.length === 0, "outsider received context");
  console.log("PASS friend UI context, negative access, comment/reaction notifications, actor exclusion");
} finally {
  if (babyAvatarPath || ownerAvatarPath) {
    await owner.sb.storage.from("profile-media").remove([babyAvatarPath, ownerAvatarPath].filter(Boolean));
  }
  if (babyId) await owner.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts(accounts);
}
