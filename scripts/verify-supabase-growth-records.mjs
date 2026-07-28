/**
 * Live growth_records CRUD + RLS verification.
 * Usage: node --env-file=.env scripts/verify-supabase-growth-records.mjs
 * Creates isolated anonymous QA users and removes the QA baby at the end.
 */
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

async function anonymous(label) {
  const sb = client();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`${label} auth: ${error?.message ?? "no user"}`);
  return { sb, user: data.user };
}

const probe = client();
const { error: tableError } = await probe.from("growth_records").select("id").limit(1);
if (tableError && (tableError.code === "PGRST205" || /not find|does not exist/i.test(tableError.message))) {
  fail(`growth_records migration not applied: ${tableError.message}`);
  console.log(lines.join("\n"));
  process.exit(2);
}
pass("growth_records table reachable");

const admin = await anonymous("admin");
const viewer = await anonymous("viewer");
const editor = await anonymous("editor");
let babyId = null;

try {
  const { data: baby, error: babyError } = await admin.sb.rpc("create_baby_with_owner", {
    p_name: `성장QA-${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error(`baby create: ${babyError?.message ?? "no baby"}`);
  babyId = baby.id;
  pass("admin baby/member created");

  const { error: membersError } = await admin.sb.from("baby_members").insert([
    { baby_id: babyId, user_id: viewer.user.id, permission_role: "viewer", relationship_label: "가족", status: "active" },
    { baby_id: babyId, user_id: editor.user.id, permission_role: "editor", relationship_label: "시터", status: "active" },
  ]);
  if (membersError) throw new Error(`member setup: ${membersError.message}`);
  pass("viewer/editor memberships created");

  const adminRecordId = crypto.randomUUID();
  const migrationKey = `qa-local-${crypto.randomUUID()}`;
  const base = {
    id: adminRecordId,
    baby_id: babyId,
    client_generated_id: migrationKey,
    measured_at: "2026-07-27",
    weight_kg: 8.1,
    height_cm: 68.2,
    head_circumference_cm: 43.4,
    source: "hospital",
    input_method: "manual",
    user_confirmed: true,
    note: "growth records QA",
    created_by: admin.user.id,
  };
  const { error: insertError } = await admin.sb.from("growth_records").upsert(base, { onConflict: "baby_id,client_generated_id" });
  if (insertError) throw new Error(`admin insert: ${insertError.message}`);
  pass("admin create allowed");

  const { error: duplicateError } = await admin.sb.from("growth_records").upsert(base, { onConflict: "baby_id,client_generated_id" });
  const { count: dedupeCount, error: countError } = await admin.sb
    .from("growth_records")
    .select("id", { count: "exact", head: true })
    .eq("baby_id", babyId)
    .eq("client_generated_id", migrationKey);
  if (duplicateError || countError || dedupeCount !== 1) throw new Error("local migration dedupe failed");
  pass("client_generated_id migration upload is idempotent");

  const outsider = await anonymous("outsider");
  const { data: outsiderRows, error: outsiderReadError } = await outsider.sb.from("growth_records").select("id").eq("baby_id", babyId);
  if (outsiderReadError || (outsiderRows?.length ?? 0) !== 0) throw new Error("non-member read was not blocked");
  pass("non-member read blocked");

  const { data: viewerRows, error: viewerReadError } = await viewer.sb.from("growth_records").select("*").eq("baby_id", babyId);
  if (viewerReadError || viewerRows?.length !== 1) throw new Error(`viewer read: ${viewerReadError?.message ?? "wrong count"}`);
  pass("viewer read allowed");

  const { error: viewerInsertError } = await viewer.sb.from("growth_records").insert({ ...base, id: crypto.randomUUID(), client_generated_id: crypto.randomUUID(), created_by: viewer.user.id });
  if (!viewerInsertError) throw new Error("viewer insert unexpectedly allowed");
  const { error: viewerUpdateError } = await viewer.sb.from("growth_records").update({ note: "blocked" }).eq("id", adminRecordId).select("*").single();
  if (!viewerUpdateError) throw new Error("viewer update unexpectedly allowed");
  const { error: viewerDeleteError } = await viewer.sb.from("growth_records").delete().eq("id", adminRecordId).select("*").single();
  if (!viewerDeleteError) throw new Error("viewer delete unexpectedly allowed");
  pass("viewer create/update/delete blocked");

  const editorRecordId = crypto.randomUUID();
  const { error: editorInsertError } = await editor.sb.from("growth_records").insert({
    ...base,
    id: editorRecordId,
    client_generated_id: editorRecordId,
    created_by: editor.user.id,
    source: "home",
  });
  if (editorInsertError) throw new Error(`editor insert: ${editorInsertError.message}`);
  const { error: editorUpdateError } = await editor.sb.from("growth_records").update({ weight_kg: 8.2 }).eq("id", editorRecordId).select("*").single();
  if (editorUpdateError) throw new Error(`editor update: ${editorUpdateError.message}`);
  const { error: editorDeleteError } = await editor.sb.from("growth_records").delete().eq("id", editorRecordId).select("*").single();
  if (editorDeleteError) throw new Error(`editor delete: ${editorDeleteError.message}`);
  pass("editor create/update/delete allowed");

  const { data: updated, error: adminUpdateError } = await admin.sb.from("growth_records").update({ weight_kg: 8.3 }).eq("id", adminRecordId).select("*").single();
  if (adminUpdateError || Number(updated?.weight_kg) !== 8.3) throw new Error(`admin update: ${adminUpdateError?.message ?? "wrong value"}`);
  pass("admin update and server re-fetch allowed");

  const { error: adminDeleteError } = await admin.sb.from("growth_records").delete().eq("id", adminRecordId).select("*").single();
  if (adminDeleteError) throw new Error(`admin delete: ${adminDeleteError.message}`);
  pass("admin delete allowed");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (babyId) await admin.sb.from("babies").delete().eq("id", babyId);
  await Promise.all([admin.sb.auth.signOut(), viewer.sb.auth.signOut(), editor.sb.auth.signOut()]);
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
