/** Invite & Share V1 live QA using public/anonymous clients only. */
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
const account = async (label) => {
  const sb = client();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`${label} auth: ${error?.message ?? "no user"}`);
  await sb.from("profiles").upsert({
    id: data.user.id,
    display_name: label,
    preferred_language: "ko",
  });
  return { sb, user: data.user, label };
};

const owner = await account("InviteQA-Owner");
const family = await account("InviteQA-Family");
const babyFriend = await account("InviteQA-BabyFriend");
const darinFriend = await account("InviteQA-DarinFriend");
const outsider = await account("InviteQA-Outsider");
let babyId = null;

try {
  const created = await owner.sb.rpc("create_baby_with_owner", {
    p_name: `InviteQA-${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (created.error || !created.data?.id) throw created.error ?? new Error("QA baby create failed");
  babyId = created.data.id;

  const dateKey = new Date().toISOString().slice(0, 10);
  const careFixture = await owner.sb.from("care_logs").insert({
    baby_id: babyId,
    category: "memo",
    recorded_at: new Date().toISOString(),
    date_key: dateKey,
    time_local: "12:00",
    payload: { note: "invite access fixture" },
    created_by: owner.user.id,
  });
  if (careFixture.error) throw new Error(`care fixture: ${careFixture.error.message}`);
  const diaryFixture = await owner.sb.from("diary_entries").insert({
    baby_id: babyId,
    author_id: owner.user.id,
    entry_date: dateKey,
    title: "Invite access fixture",
    body: "private diary fixture",
  });
  if (diaryFixture.error) throw new Error(`diary fixture: ${diaryFixture.error.message}`);
  const growthBookFixture = await owner.sb.from("growth_books").insert({
    baby_id: babyId,
    title: "Invite access fixture",
    created_by: owner.user.id,
  });
  if (growthBookFixture.error) throw new Error(`growth book fixture: ${growthBookFixture.error.message}`);

  const familyInvite = await owner.sb.rpc("create_invite_code", {
    p_baby_id: babyId,
    p_invite_type: "family",
    p_role: "editor",
    p_relation: "가족",
    p_max_uses: 1,
  });
  if (familyInvite.error || !familyInvite.data?.code) throw new Error(`family invite create: ${familyInvite.error?.message ?? "missing"}`);
  const familyPreview = await family.sb.rpc("preview_invite_code", { p_code: familyInvite.data.code });
  if (familyPreview.error || familyPreview.data?.[0]?.invite_type !== "family" || !familyPreview.data[0].is_valid) {
    throw new Error(`family preview: ${familyPreview.error?.message ?? "invalid"}`);
  }
  const familyAccept = await family.sb.rpc("accept_invite_code", {
    p_code: familyInvite.data.code,
    p_display_name: "초대 가족",
    p_nickname: "가족닉네임",
    p_relation: "가족",
  });
  if (familyAccept.error || familyAccept.data?.[0]?.invite_type !== "family") throw new Error(`family accept: ${familyAccept.error?.message ?? "missing"}`);
  const familyMembership = await family.sb.from("baby_members").select("permission_role").eq("baby_id", babyId).eq("user_id", family.user.id).maybeSingle();
  if (familyMembership.error || familyMembership.data?.permission_role !== "editor") throw new Error("family baby_members connection missing");
  pass("family invite preview/accept creates editor baby_members row");

  const memoryInvite = await owner.sb.rpc("create_invite_code", {
    p_baby_id: babyId,
    p_invite_type: "baby_friend",
    p_role: "viewer",
    p_relation: "친구",
    p_max_uses: 1,
  });
  if (memoryInvite.error || !memoryInvite.data?.code) throw new Error(`baby friend create: ${memoryInvite.error?.message ?? "missing"}`);
  const memoryAccept = await babyFriend.sb.rpc("accept_invite_code", {
    p_code: memoryInvite.data.code,
    p_display_name: "아기 친구",
    p_relation: "친구",
  });
  if (memoryAccept.error || memoryAccept.data?.[0]?.invite_type !== "baby_friend") throw new Error(`baby friend accept: ${memoryAccept.error?.message ?? "missing"}`);
  const memoryConnection = await babyFriend.sb.from("memory_friends").select("status").eq("baby_id", babyId).eq("user_id", babyFriend.user.id).maybeSingle();
  if (memoryConnection.error || memoryConnection.data?.status !== "active") throw new Error("memory_friends connection missing");
  const forbiddenBabyMember = await babyFriend.sb.from("baby_members").select("user_id").eq("baby_id", babyId).eq("user_id", babyFriend.user.id);
  if (forbiddenBabyMember.error || forbiddenBabyMember.data?.length) throw new Error("baby friend leaked into baby_members");
  const forbiddenCare = await babyFriend.sb.from("care_logs").select("id").eq("baby_id", babyId);
  if (forbiddenCare.error || forbiddenCare.data?.length) throw new Error("baby friend can read care logs");
  const forbiddenDiary = await babyFriend.sb.from("diary_entries").select("id").eq("baby_id", babyId);
  if (forbiddenDiary.error || forbiddenDiary.data?.length) throw new Error("baby friend can read diary");
  const forbiddenGrowthBook = await babyFriend.sb.from("growth_books").select("id").eq("baby_id", babyId);
  if (forbiddenGrowthBook.error || forbiddenGrowthBook.data?.length) throw new Error("baby friend can read growth book");
  pass("baby friend creates memory_friends only");
  pass("baby friend cannot read care_logs, diary, or growth_book fixtures");

  const userInvite = await owner.sb.rpc("create_invite_code", {
    p_baby_id: null,
    p_invite_type: "darin_friend",
    p_role: "viewer",
    p_relation: "친구",
    p_max_uses: 1,
  });
  if (userInvite.error || !userInvite.data?.code || userInvite.data.baby_id !== null) throw new Error(`Darin friend create: ${userInvite.error?.message ?? "invalid"}`);
  const userPreview = await darinFriend.sb.rpc("preview_invite_code", { p_code: userInvite.data.code });
  if (userPreview.error || userPreview.data?.[0]?.invite_type !== "darin_friend" || userPreview.data[0].baby_id !== null) throw new Error(`Darin friend preview: ${userPreview.error?.message ?? "invalid"}`);
  const userAccept = await darinFriend.sb.rpc("accept_invite_code", {
    p_code: userInvite.data.code,
    p_display_name: "다린 친구",
    p_relation: "친구",
  });
  if (userAccept.error || userAccept.data?.[0]?.invite_type !== "darin_friend") throw new Error(`Darin friend accept: ${userAccept.error?.message ?? "missing"}`);
  const friendList = await owner.sb.rpc("list_my_darin_friends", {});
  if (friendList.error || !friendList.data?.some((row) => row.user_id === darinFriend.user.id)) throw new Error(`friend list: ${friendList.error?.message ?? "missing friend"}`);
  const noBabyAccess = await darinFriend.sb.from("babies").select("id").eq("id", babyId);
  if (noBabyAccess.error || noBabyAccess.data?.length) throw new Error("Darin friendship granted baby read");
  pass("Darin friendship list works and grants no baby access");

  const outsiderBaby = await outsider.sb.from("babies").select("id").eq("id", babyId);
  const outsiderCare = await outsider.sb.from("care_logs").select("id").eq("baby_id", babyId);
  const outsiderDiary = await outsider.sb.from("diary_entries").select("id").eq("baby_id", babyId);
  const outsiderGrowthBook = await outsider.sb.from("growth_books").select("id").eq("baby_id", babyId);
  if (
    outsiderBaby.error || outsiderBaby.data?.length ||
    outsiderCare.error || outsiderCare.data?.length ||
    outsiderDiary.error || outsiderDiary.data?.length ||
    outsiderGrowthBook.error || outsiderGrowthBook.data?.length
  ) throw new Error("non-member can read protected baby data");
  pass("non-member denied babies, care_logs, diary, and growth_book reads");

  const addToBaby = await owner.sb.rpc("add_darin_friend_to_baby", {
    p_baby_id: babyId,
    p_friend_user_id: darinFriend.user.id,
  });
  if (addToBaby.error || addToBaby.data?.status !== "active") throw new Error(`friend-to-baby: ${addToBaby.error?.message ?? "missing"}`);
  const stillNoMembership = await darinFriend.sb.from("baby_members").select("user_id").eq("baby_id", babyId).eq("user_id", darinFriend.user.id);
  if (stillNoMembership.error || stillNoMembership.data?.length) throw new Error("Darin friend-to-baby created baby_members access");
  pass("accepted Darin friend can be added to one baby's memory_friends only");

  const directFriendship = await babyFriend.sb.from("user_friendships").insert({
    requester_id: babyFriend.user.id,
    receiver_id: family.user.id,
    status: "accepted",
  });
  if (!directFriendship.error) throw new Error("direct user_friendships insert unexpectedly allowed");
  pass("direct friendship mutation denied; security-definer accept flow required");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (babyId) await owner.sb.from("babies").delete().eq("id", babyId);
  await Promise.all([owner, family, babyFriend, darinFriend, outsider].map(({ sb }) => sb.auth.signOut()));
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
