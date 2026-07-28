/**
 * Live Email + Password / anonymous-upgrade preservation QA.
 * Uses the service key only inside this Node QA process to create/confirm
 * isolated test users without sending messages to unowned inboxes, then removes
 * every test user afterward.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !publicKey || !secretKey) throw new Error("Missing Supabase QA environment variables.");

const client = () => createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const service = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const lines = [];
const pass = (message) => lines.push(`PASS  ${message}`);
const fail = (message) => lines.push(`FAIL  ${message}`);
const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const password = `Darin!${crypto.randomUUID()}9`;
const signupEmail = `auth-signup-${stamp}@darin.invalid`;
const linkedEmail = `auth-linked-${stamp}@darin.invalid`;
let signupUserId = null;
let linkedUserId = null;
let outsiderUserId = null;
let babyId = null;

try {
  // Create an already-confirmed isolated account without delivering email. The
  // app's public signUp path is covered by AuthRepository and UI tests; this live
  // probe verifies password login/session semantics under Confirm email ON.
  const { data: signupData, error: signupError } = await service.auth.admin.createUser({
    email: signupEmail,
    password,
    email_confirm: true,
  });
  if (signupError || !signupData.user) throw new Error(`email user create: ${signupError?.message ?? "no user"}`);
  signupUserId = signupData.user.id;
  const signup = client();
  const { data: loginData, error: loginError } = await signup.auth.signInWithPassword({ email: signupEmail, password });
  if (loginError || !loginData.session) throw new Error(`password login: ${loginError?.message ?? "no session"}`);
  pass("signInWithPassword succeeds for a confirmed Email + Password account");
  await signup.auth.signOut();

  // Create anonymous data exactly as the current vertical slices do.
  const anon = client();
  const { data: anonData, error: anonError } = await anon.auth.signInAnonymously();
  if (anonError || !anonData.user) throw new Error(`anonymous auth: ${anonError?.message ?? "no user"}`);
  linkedUserId = anonData.user.id;
  const { data: baby, error: babyError } = await anon.rpc("create_baby_with_owner", {
    p_name: `EmailAuthQA-${stamp}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error(`baby create: ${babyError?.message ?? "no baby"}`);
  babyId = baby.id;

  const careId = crypto.randomUUID();
  const growthId = crypto.randomUUID();
  const inviteCode = `QA${stamp.replace(/\W/g, "").slice(-10)}`;
  const { error: careError } = await anon.from("care_logs").insert({
    id: careId,
    baby_id: babyId,
    client_generated_id: careId,
    category: "memo",
    recorded_at: new Date().toISOString(),
    date_key: "2026-07-27",
    time_local: "12:00",
    payload: { note: "email auth preservation QA" },
    source: "manual",
    created_by: linkedUserId,
  });
  if (careError) throw new Error(`care create: ${careError.message}`);
  const { error: growthError } = await anon.from("growth_records").insert({
    id: growthId,
    baby_id: babyId,
    client_generated_id: growthId,
    measured_at: "2026-07-27",
    weight_kg: 8.7,
    source: "hospital",
    input_method: "manual",
    user_confirmed: true,
    created_by: linkedUserId,
  });
  if (growthError) throw new Error(`growth create: ${growthError.message}`);
  const { error: inviteError } = await anon.from("invite_codes").insert({
    baby_id: babyId,
    code: inviteCode,
    created_by: linkedUserId,
    permission_role: "viewer",
    relationship_label: "가족",
  });
  if (inviteError) throw new Error(`invite create: ${inviteError.message}`);
  pass("anonymous baby/care_log/growth_record/invite_code created");

  // Simulate the confirmation-link result without sending a message to an
  // unowned inbox. The password is still set through the same public-client
  // updateUser path used by the app after confirmation.
  const { data: emailUpgrade, error: emailUpgradeError } = await service.auth.admin.updateUserById(linkedUserId, {
    email: linkedEmail,
    email_confirm: true,
    user_metadata: { display_name: "Email Auth QA" },
  });
  if (emailUpgradeError || emailUpgrade.user.id !== linkedUserId) throw new Error(`anonymous email confirm: ${emailUpgradeError?.message ?? "id changed"}`);
  const { data: passwordUpgrade, error: passwordUpgradeError } = await anon.auth.updateUser({ password });
  if (passwordUpgradeError || passwordUpgrade.user.id !== linkedUserId) throw new Error(`anonymous password link: ${passwordUpgradeError?.message ?? "id changed"}`);
  pass("anonymous account upgraded in place with identical auth.uid()");

  await anon.auth.signOut();
  const restored = client();
  const { data: restoredLogin, error: restoredLoginError } = await restored.auth.signInWithPassword({
    email: linkedEmail,
    password,
  });
  if (restoredLoginError || restoredLogin.user?.id !== linkedUserId) {
    throw new Error(`upgraded login: ${restoredLoginError?.message ?? "user mismatch"}`);
  }
  const [profiles, babies, members, cares, growth, invites] = await Promise.all([
    restored.from("profiles").select("id").eq("id", linkedUserId),
    restored.from("babies").select("id").eq("id", babyId),
    restored.from("baby_members").select("user_id,permission_role").eq("baby_id", babyId),
    restored.from("care_logs").select("id,created_by").eq("id", careId),
    restored.from("growth_records").select("id,created_by").eq("id", growthId),
    restored.from("invite_codes").select("id,created_by").eq("code", inviteCode),
  ]);
  for (const result of [profiles, babies, members, cares, growth, invites]) {
    if (result.error || result.data?.length !== 1) throw new Error(`preservation read: ${result.error?.message ?? "missing row"}`);
  }
  if (cares.data[0].created_by !== linkedUserId || growth.data[0].created_by !== linkedUserId || invites.data[0].created_by !== linkedUserId) {
    throw new Error("created_by ownership changed during upgrade");
  }
  pass("profiles/babies/membership/care/growth/invite ownership preserved after re-login");

  const outsider = client();
  const { data: outsiderData, error: outsiderError } = await outsider.auth.signInAnonymously();
  if (outsiderError || !outsiderData.user) throw new Error(`outsider auth: ${outsiderError?.message ?? "no user"}`);
  outsiderUserId = outsiderData.user.id;
  const { data: blockedCare, error: blockedCareError } = await outsider.from("care_logs").select("id").eq("baby_id", babyId);
  const { data: blockedGrowth, error: blockedGrowthError } = await outsider.from("growth_records").select("id").eq("baby_id", babyId);
  if (blockedCareError || blockedGrowthError || blockedCare.length || blockedGrowth.length) throw new Error("non-member RLS read was not blocked");
  pass("non-member care_logs/growth_records access blocked");

  // A second login client proves session-independent restore.
  await restored.auth.signOut();
  const restarted = client();
  const { data: restartLogin, error: restartError } = await restarted.auth.signInWithPassword({ email: linkedEmail, password });
  if (restartError || restartLogin.user?.id !== linkedUserId) throw new Error(`restart login: ${restartError?.message ?? "failed"}`);
  const { data: restartGrowth, error: restartGrowthError } = await restarted.from("growth_records").select("id").eq("baby_id", babyId);
  if (restartGrowthError || restartGrowth.length !== 1) throw new Error("restart hydrate probe failed");
  pass("fresh client session restores server growth data");
  await restarted.from("babies").delete().eq("id", babyId);
  await restarted.auth.signOut();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  for (const id of [signupUserId, linkedUserId, outsiderUserId]) {
    if (id) await service.auth.admin.deleteUser(id);
  }
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
