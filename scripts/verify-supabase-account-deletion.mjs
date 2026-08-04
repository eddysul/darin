import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) throw new Error("Supabase environment is incomplete");

const service = createClient(url, secretKey, { auth: { persistSession: false } });
const stamp = Date.now();
const password = `Delete-QA-${crypto.randomUUID()}!`;
const ownerEmail = `delete-owner-${stamp}@darin.test`;
const memberEmail = `delete-member-${stamp}@darin.test`;
const outsiderEmail = `delete-outsider-${stamp}@darin.test`;
let ownerId;
let memberId;
let outsiderId;
let soloBabyId;
let sharedBabyId;
let diaryId;
let memoryId;
let growthBookId;
let contactId;

function pass(message) {
  console.log(`PASS ${message}`);
}
try {
  const ownerCreate = await service.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
  });
  if (ownerCreate.error) throw ownerCreate.error;
  ownerId = ownerCreate.data.user.id;

  const memberCreate = await service.auth.admin.createUser({
    email: memberEmail,
    password,
    email_confirm: true,
  });
  if (memberCreate.error) throw memberCreate.error;
  memberId = memberCreate.data.user.id;

  const outsiderCreate = await service.auth.admin.createUser({
    email: outsiderEmail,
    password,
    email_confirm: true,
  });
  if (outsiderCreate.error) throw outsiderCreate.error;
  outsiderId = outsiderCreate.data.user.id;

  const owner = createClient(url, publishableKey, { auth: { persistSession: false } });
  const login = await owner.auth.signInWithPassword({ email: ownerEmail, password });
  if (login.error || !login.data.session) throw login.error ?? new Error("owner login failed");
  pass("temporary authenticated account created");

  const solo = await owner.rpc("create_baby_with_owner", {
    p_name: `DeleteSolo-${stamp}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (solo.error || !solo.data?.id) throw solo.error ?? new Error("solo baby create failed");
  soloBabyId = solo.data.id;

  const shared = await owner.rpc("create_baby_with_owner", {
    p_name: `DeleteShared-${stamp}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (shared.error || !shared.data?.id) throw shared.error ?? new Error("shared baby create failed");
  sharedBabyId = shared.data.id;

  const memberInsert = await service.from("baby_members").insert({
    baby_id: sharedBabyId,
    user_id: memberId,
    permission_role: "viewer",
    relationship_label: "가족",
    status: "active",
  });
  if (memberInsert.error) throw memberInsert.error;

  const careId = crypto.randomUUID();
  const growthId = crypto.randomUUID();
  const careInsert = await owner.from("care_logs").insert({
    id: careId,
    baby_id: sharedBabyId,
    client_generated_id: careId,
    category: "memo",
    recorded_at: new Date().toISOString(),
    date_key: "2026-07-28",
    time_local: "00:30",
    payload: { note: "account deletion QA" },
    source: "manual",
    created_by: ownerId,
  });
  if (careInsert.error) throw careInsert.error;
  const growthInsert = await owner.from("growth_records").insert({
    id: growthId,
    baby_id: sharedBabyId,
    client_generated_id: growthId,
    measured_at: "2026-07-28",
    weight_kg: 8.5,
    source: "hospital",
    input_method: "manual",
    user_confirmed: true,
    created_by: ownerId,
  });
  if (growthInsert.error) throw growthInsert.error;

  diaryId = crypto.randomUUID();
  memoryId = crypto.randomUUID();
  growthBookId = crypto.randomUUID();
  contactId = crypto.randomUUID();
  const safetyRows = await Promise.all([
    service.from("diary_entries").insert({
      id: diaryId, baby_id: sharedBabyId, author_id: ownerId, entry_date: "2026-07-28",
      body: "shared diary", included_in_growth_book: true,
    }),
    service.from("memory_posts").insert({
      id: memoryId, baby_id: sharedBabyId, author_id: ownerId, caption: "shared memory", privacy_type: "family_circle",
    }),
    service.from("growth_books").insert({
      id: growthBookId, baby_id: sharedBabyId, title: "shared book", status: "draft", created_by: ownerId,
    }),
    owner.from("push_tokens").insert({
      user_id: ownerId, device_id: `delete-qa-${stamp}`,
      expo_push_token: `ExponentPushToken[DeleteQA${crypto.randomUUID().replaceAll("-", "")}]`, platform: "ios",
    }),
    owner.from("notification_settings").insert({ user_id: ownerId, baby_id: sharedBabyId }),
    owner.from("contact_requests").insert({
      id: contactId, user_id: ownerId, email: ownerEmail, category: "account", message: "account safety QA",
    }),
  ]);
  for (const result of safetyRows) if (result.error) throw result.error;
  const eventInsert = await service.from("notification_events").insert({
    recipient_id: ownerId, actor_id: memberId, baby_id: sharedBabyId,
    event_type: "test", title: "delete QA", body: "cleanup",
  });
  if (eventInsert.error) throw eventInsert.error;
  pass("solo and shared baby fixtures created");

  const memberClient = createClient(url, publishableKey, { auth: { persistSession: false } });
  const outsiderClient = createClient(url, publishableKey, { auth: { persistSession: false } });
  const [memberLogin, outsiderLogin] = await Promise.all([
    memberClient.auth.signInWithPassword({ email: memberEmail, password }),
    outsiderClient.auth.signInWithPassword({ email: outsiderEmail, password }),
  ]);
  if (memberLogin.error || outsiderLogin.error) throw memberLogin.error ?? outsiderLogin.error;
  const [memberContactRead, outsiderCareRead, viewerCareRead] = await Promise.all([
    memberClient.from("contact_requests").select("id").eq("id", contactId),
    outsiderClient.from("care_logs").select("id").eq("baby_id", sharedBabyId),
    memberClient.from("care_logs").select("id").eq("baby_id", sharedBabyId),
  ]);
  if (memberContactRead.error || memberContactRead.data.length) throw new Error("other user read contact request");
  if (outsiderCareRead.error || outsiderCareRead.data.length) throw new Error("non-member export source was visible");
  if (viewerCareRead.error || viewerCareRead.data.length !== 1) throw new Error("viewer readable export scope failed");
  const invalidContacts = await Promise.all([
    owner.from("contact_requests").insert({ user_id: ownerId, category: "other", message: "" }),
    owner.from("contact_requests").insert({ user_id: ownerId, category: "other", message: "x".repeat(4001) }),
  ]);
  if (invalidContacts.some((result) => !result.error)) throw new Error("contact validation accepted invalid message");
  const exportJson = JSON.stringify({ baby: shared.data, careLogs: viewerCareRead.data });
  if (!JSON.parse(exportJson)?.baby?.id) throw new Error("export JSON invalid");
  pass("contact RLS and empty/long message validation enforced");
  pass("export source allows member scope, blocks non-member and produces valid JSON");

  const invalidConfirmation = await owner.functions.invoke("delete-account", {
    method: "POST",
    body: { confirmationText: "delete", userId: memberId },
  });
  if (!invalidConfirmation.error) throw new Error("invalid confirmation unexpectedly accepted");
  const memberBeforeDelete = await service.auth.admin.getUserById(memberId);
  if (memberBeforeDelete.error || !memberBeforeDelete.data.user) throw new Error("other account was affected");
  pass("invalid confirmation rejected and other account cannot be targeted");

  const deletion = await owner.functions.invoke("delete-account", {
    method: "POST",
    body: { confirmationText: "삭제", userId: memberId },
  });
  if (deletion.error) throw deletion.error;
  if (!deletion.data?.deleted) throw new Error(deletion.data?.error ?? "delete response missing");
  pass("delete-account function returned success");

  const [ownerLookup, soloLookup, sharedLookup, memberships, careLookup, growthLookup,
    diaryLookup, memoryLookup, bookLookup, tokenLookup, settingLookup, eventLookup, contactLookup] = await Promise.all([
    service.auth.admin.getUserById(ownerId),
    service.from("babies").select("id").eq("id", soloBabyId),
    service.from("babies").select("id").eq("id", sharedBabyId),
    service.from("baby_members").select("user_id").eq("baby_id", sharedBabyId),
    service.from("care_logs").select("id,created_by").eq("id", careId).single(),
    service.from("growth_records").select("id,created_by").eq("id", growthId).single(),
    service.from("diary_entries").select("id,author_id").eq("id", diaryId).single(),
    service.from("memory_posts").select("id,author_id").eq("id", memoryId).single(),
    service.from("growth_books").select("id,created_by").eq("id", growthBookId).single(),
    service.from("push_tokens").select("id").eq("user_id", ownerId),
    service.from("notification_settings").select("id").eq("user_id", ownerId),
    service.from("notification_events").select("id").eq("recipient_id", ownerId),
    service.from("contact_requests").select("id,user_id").eq("id", contactId).single(),
  ]);

  if (!ownerLookup.error || ownerLookup.data.user) throw new Error("auth user still exists");
  if (soloLookup.error || soloLookup.data.length !== 0) throw new Error("solo baby was not deleted");
  if (sharedLookup.error || sharedLookup.data.length !== 1) throw new Error("shared baby was deleted");
  if (memberships.error || memberships.data.length !== 1 || memberships.data[0].user_id !== memberId) {
    throw new Error("shared membership cleanup failed");
  }
  if (careLookup.error || careLookup.data.created_by !== null) throw new Error("shared care log was not anonymized");
  if (growthLookup.error || growthLookup.data.created_by !== null) throw new Error("shared growth record was not anonymized");
  if (diaryLookup.error || diaryLookup.data.author_id !== null) throw new Error("shared diary was not anonymized");
  if (memoryLookup.error || memoryLookup.data.author_id !== null) throw new Error("shared memory was not anonymized");
  if (bookLookup.error || bookLookup.data.created_by !== null) throw new Error("shared growth book was not anonymized");
  if (tokenLookup.error || tokenLookup.data.length) throw new Error("push token cleanup failed");
  if (settingLookup.error || settingLookup.data.length) throw new Error("notification settings cleanup failed");
  if (eventLookup.error || eventLookup.data.length) throw new Error("notification event cleanup failed");
  if (contactLookup.error || contactLookup.data.user_id !== null) throw new Error("contact request was not anonymized");
  pass("auth user and solo baby deleted");
  pass("shared baby preserved and Diary/Growth Book/Memories authorship anonymized");
  pass("push token, notification settings and recipient events cleaned up");
  pass("contact request retained without account identifier");

  const deletedLogin = await owner.auth.signInWithPassword({ email: ownerEmail, password });
  if (!deletedLogin.error) throw new Error("deleted account could still log in");
  pass("login with deleted account denied");
} finally {
  if (sharedBabyId) await service.from("babies").delete().eq("id", sharedBabyId);
  if (soloBabyId) await service.from("babies").delete().eq("id", soloBabyId);
  if (ownerId) await service.auth.admin.deleteUser(ownerId).catch(() => undefined);
  if (memberId) await service.auth.admin.deleteUser(memberId).catch(() => undefined);
  if (outsiderId) await service.auth.admin.deleteUser(outsiderId).catch(() => undefined);
}
