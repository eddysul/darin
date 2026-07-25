/**
 * Live Supabase verification for Care Log slice.
 * Usage: node --env-file=.env scripts/verify-supabase-care-logs.mjs
 * Does not print secret keys.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

const lines = [];
const pass = (m) => lines.push(`PASS  ${m}`);
const fail = (m) => lines.push(`FAIL  ${m}`);
const info = (m) => lines.push(`INFO  ${m}`);

function finish(code) {
  console.log(lines.join("\n"));
  process.exit(code);
}

if (!url || !anon) {
  fail("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  finish(1);
}

const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// --- 1) Schema presence ---
const tables = ["profiles", "babies", "baby_members", "invite_codes", "care_logs"];
let schemaOk = true;
for (const table of tables) {
  const { error } = await client.from(table).select("*").limit(1);
  if (error && (error.code === "PGRST205" || /could not find|does not exist/i.test(error.message))) {
    fail(`${table}: not found (${error.message})`);
    schemaOk = false;
  } else if (error && /permission|JWT|RLS|row-level/i.test(error.message)) {
    pass(`${table}: exists (blocked without auth — expected)`);
  } else if (error) {
    // PostgREST often returns empty with RLS; other errors still informative
    info(`${table}: ${error.code ?? ""} ${error.message}`);
  } else {
    pass(`${table}: reachable`);
  }
}

if (!schemaOk) {
  info("Apply supabase/migrations/202607250001_care_logs_slice.sql in SQL Editor first.");
  finish(2);
}

// --- 2) Anonymous auth ---
const { data: authData, error: authErr } = await client.auth.signInAnonymously();
let session = authData?.session ?? null;
let userId = authData?.user?.id ?? null;

if (authErr || !session) {
  info(`Anonymous unavailable: ${authErr?.message ?? "no session"} — trying device signup`);
  const email = `device.verify.${Date.now()}@darin-device.local`;
  const password = `Pw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const { data: signed, error: upErr } = await client.auth.signUp({ email, password });
  if (upErr || !signed.session) {
    fail(`Device signup failed: ${upErr?.message ?? "no session (email confirm may be on)"}`);
    info("Enable Anonymous OR disable Confirm email in Auth settings.");
    finish(3);
  }
  session = signed.session;
  userId = signed.user.id;
  pass(`Device auth ok (user ${userId.slice(0, 8)}…)`);
} else {
  pass(`Anonymous auth ok (user ${userId.slice(0, 8)}…)`);
}

// --- 3) Profile ---
const { error: profileErr } = await client.from("profiles").upsert({
  id: userId,
  display_name: "Verify Bot",
  preferred_language: "ko",
});
if (profileErr) fail(`profile upsert: ${profileErr.message}`);
else pass("profile upsert ok");

// --- 4) Baby + member via RPC ---
const { data: baby, error: babyErr } = await client.rpc("create_baby_with_owner", {
  p_name: "검증아기",
  p_child_status: "newborn",
  p_relationship_label: "엄마",
});
if (babyErr || !baby?.id) {
  fail(`create_baby_with_owner: ${babyErr?.message ?? "no baby"}`);
  finish(4);
}
pass(`baby created (${String(baby.id).slice(0, 8)}…)`);

// --- 5) care_logs insert ---
const logId = crypto.randomUUID();
const now = new Date();
const dateKey = now.toISOString().slice(0, 10);
const timeLocal = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

const { data: inserted, error: insErr } = await client
  .from("care_logs")
  .insert({
    id: logId,
    baby_id: baby.id,
    client_generated_id: logId,
    category: "formula",
    recorded_at: now.toISOString(),
    date_key: dateKey,
    time_local: timeLocal,
    payload: { amount: "60", chip: "verify" },
    source: "manual",
    created_by: userId,
  })
  .select("*")
  .single();

if (insErr || !inserted) {
  fail(`care_logs insert: ${insErr?.message ?? "no row"}`);
} else {
  pass(`care_logs insert ok (${inserted.id.slice(0, 8)}…)`);
}

// --- 6) Re-fetch (restart hydrate simulation) ---
const { data: fetched, error: fetchErr } = await client
  .from("care_logs")
  .select("*")
  .eq("baby_id", baby.id)
  .eq("id", logId)
  .maybeSingle();

if (fetchErr) fail(`care_logs re-fetch: ${fetchErr.message}`);
else if (!fetched) fail("care_logs re-fetch returned empty");
else pass(`care_logs re-fetch ok (category=${fetched.category})`);

// --- 7) RLS: no session cannot read the row ---
const stranger = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: leaked, error: leakErr } = await stranger.from("care_logs").select("id").eq("id", logId);
if (leakErr) info(`stranger blocked with error: ${leakErr.message}`);
else if (!leaked?.length) pass("RLS: unauthenticated read returns 0 rows");
else fail(`RLS leak: unauthenticated saw ${leaked.length} row(s)`);

// Cleanup
await client.from("care_logs").delete().eq("id", logId);
await client.from("babies").delete().eq("id", baby.id);
pass("cleanup done");

const failed = lines.some((l) => l.startsWith("FAIL"));
finish(failed ? 10 : 0);
