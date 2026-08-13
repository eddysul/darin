/** Build 12 account-only auth QA. Never creates an anonymous user. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !publicKey || !secretKey) {
  throw new Error(
    "BLOCKED: Supabase public variables and SUPABASE_SECRET_KEY are required. " +
      "Never expose the secret through EXPO_PUBLIC_* variables.",
  );
}

const service = createClient(url, secretKey, { auth: { persistSession: false } });
const publicClient = () => createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const lines = [];
const pass = (message) => lines.push(`PASS  ${message}`);
const fail = (message) => lines.push(`FAIL  ${message}`);
const info = (message) => lines.push(`INFO  ${message}`);
const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const password = `Darin!${crypto.randomUUID()}9`;
const ownerEmail = `auth-owner-${stamp}@darin.invalid`;
const outsiderEmail = `auth-outsider-${stamp}@darin.invalid`;
let ownerId = null;
let outsiderId = null;
let babyId = null;

try {
  const source = readFileSync(new URL("../src/repositories/AuthRepository.ts", import.meta.url), "utf8");
  if (source.includes("signInAnonymously")) throw new Error("app repository still calls signInAnonymously");
  if (source.includes("anonymous_upgrade") || source.includes("anonymous_records_require_linking")) {
    throw new Error("legacy anonymous migration/guard code remains");
  }
  if (!source.includes("signInWithPassword") || !source.includes("signInWithOAuth")) {
    throw new Error("normal email/OAuth login paths are missing");
  }
  if (!source.includes("linkIdentity")) throw new Error("provider identity linking was removed");
  pass("app auth repository has no anonymous creation or migration path");
  pass("email/OAuth login and signed-in provider linking remain present");

  const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publicKey },
  });
  if (!settingsResponse.ok) throw new Error(`auth settings probe: HTTP ${settingsResponse.status}`);
  const settings = await settingsResponse.json();
  const anonymousSetting = settings?.external?.anonymous ?? settings?.external?.anonymous_users;
  info(`Supabase anonymous provider enabled: ${anonymousSetting === true ? "YES" : anonymousSetting === false ? "NO" : "UNKNOWN"}`);

  const ownerCreate = await service.auth.admin.createUser({
    email: ownerEmail, password, email_confirm: true,
  });
  if (ownerCreate.error || !ownerCreate.data.user) throw ownerCreate.error ?? new Error("owner create failed");
  ownerId = ownerCreate.data.user.id;
  const outsiderCreate = await service.auth.admin.createUser({
    email: outsiderEmail, password, email_confirm: true,
  });
  if (outsiderCreate.error || !outsiderCreate.data.user) throw outsiderCreate.error ?? new Error("outsider create failed");
  outsiderId = outsiderCreate.data.user.id;

  const owner = publicClient();
  const outsider = publicClient();
  const [ownerLogin, outsiderLogin] = await Promise.all([
    owner.auth.signInWithPassword({ email: ownerEmail, password }),
    outsider.auth.signInWithPassword({ email: outsiderEmail, password }),
  ]);
  if (ownerLogin.error || !ownerLogin.data.session) throw ownerLogin.error ?? new Error("owner login failed");
  if (outsiderLogin.error || !outsiderLogin.data.session) throw outsiderLogin.error ?? new Error("outsider login failed");
  pass("confirmed email/password users receive real sessions");

  const created = await owner.rpc("create_baby_with_owner", {
    p_name: `AuthQA-${stamp}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (created.error || !created.data?.id) throw created.error ?? new Error("baby create failed");
  babyId = created.data.id;
  const careId = crypto.randomUUID();
  const care = await owner.from("care_logs").insert({
    id: careId,
    baby_id: babyId,
    client_generated_id: careId,
    category: "memo",
    recorded_at: new Date().toISOString(),
    date_key: new Date().toISOString().slice(0, 10),
    time_local: "12:00",
    payload: { note: "account-only auth QA" },
    source: "manual",
    created_by: ownerId,
  });
  if (care.error) throw care.error;
  const outsiderRead = await outsider.from("care_logs").select("id").eq("id", careId);
  if (outsiderRead.error || outsiderRead.data?.length) throw new Error("non-member read was not blocked");
  pass("signed-in owner can write and signed-in non-member remains blocked by RLS");

  await owner.from("babies").delete().eq("id", babyId);
  babyId = null;
  await Promise.allSettled([
    owner.auth.signOut({ scope: "local" }),
    outsider.auth.signOut({ scope: "local" }),
  ]);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (babyId) await service.from("babies").delete().eq("id", babyId);
  if (ownerId) await service.auth.admin.deleteUser(ownerId);
  if (outsiderId) await service.auth.admin.deleteUser(outsiderId);
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
