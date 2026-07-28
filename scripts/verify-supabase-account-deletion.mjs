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
let ownerId;
let memberId;
let soloBabyId;
let sharedBabyId;

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
  pass("solo and shared baby fixtures created");

  const deletion = await owner.functions.invoke("delete-account", { method: "POST" });
  if (deletion.error) throw deletion.error;
  if (!deletion.data?.deleted) throw new Error(deletion.data?.error ?? "delete response missing");
  pass("delete-account function returned success");

  const [ownerLookup, soloLookup, sharedLookup, memberships, careLookup, growthLookup] = await Promise.all([
    service.auth.admin.getUserById(ownerId),
    service.from("babies").select("id").eq("id", soloBabyId),
    service.from("babies").select("id").eq("id", sharedBabyId),
    service.from("baby_members").select("user_id").eq("baby_id", sharedBabyId),
    service.from("care_logs").select("id,created_by").eq("id", careId).single(),
    service.from("growth_records").select("id,created_by").eq("id", growthId).single(),
  ]);

  if (!ownerLookup.error || ownerLookup.data.user) throw new Error("auth user still exists");
  if (soloLookup.error || soloLookup.data.length !== 0) throw new Error("solo baby was not deleted");
  if (sharedLookup.error || sharedLookup.data.length !== 1) throw new Error("shared baby was deleted");
  if (memberships.error || memberships.data.length !== 1 || memberships.data[0].user_id !== memberId) {
    throw new Error("shared membership cleanup failed");
  }
  if (careLookup.error || careLookup.data.created_by !== null) throw new Error("shared care log was not anonymized");
  if (growthLookup.error || growthLookup.data.created_by !== null) throw new Error("shared growth record was not anonymized");
  pass("auth user and solo baby deleted");
  pass("shared baby preserved and authorship anonymized");
} finally {
  if (sharedBabyId) await service.from("babies").delete().eq("id", sharedBabyId);
  if (soloBabyId) await service.from("babies").delete().eq("id", soloBabyId);
  if (ownerId) await service.auth.admin.deleteUser(ownerId).catch(() => undefined);
  if (memberId) await service.auth.admin.deleteUser(memberId).catch(() => undefined);
}
