/** Live diary_entries / diary_media / Storage / RLS verification. */
import { cleanupQaAccounts, createPublicClient, createQaAccounts } from "./lib/qa-auth.mjs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) throw new Error("Missing Supabase public client environment variables.");

const lines = [];
const pass = (message) => lines.push(`PASS  ${message}`);
const fail = (message) => lines.push(`FAIL  ${message}`);
const client = createPublicClient;

const probe = client();
const { error: tableError } = await probe.from("diary_entries").select("id").limit(1);
if (tableError && (tableError.code === "PGRST205" || /not find|does not exist/i.test(tableError.message))) {
  fail(`diary migration not applied: ${tableError.message}`);
  console.log(lines.join("\n"));
  process.exit(2);
}
pass("diary_entries table reachable");

const [admin, editor, viewer, outsider] = await createQaAccounts([
  "diary-admin", "diary-editor", "diary-viewer", "diary-outsider",
]);
let babyId = null;
let storagePath = null;

try {
  const { data: baby, error: babyError } = await admin.sb.rpc("create_baby_with_owner", {
    p_name: `일기QA-${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error(`baby create: ${babyError?.message ?? "no baby"}`);
  babyId = baby.id;
  const { error: membersError } = await admin.sb.from("baby_members").insert([
    { baby_id: babyId, user_id: editor.user.id, permission_role: "editor", relationship_label: "시터", status: "active" },
    { baby_id: babyId, user_id: viewer.user.id, permission_role: "viewer", relationship_label: "가족", status: "active" },
  ]);
  if (membersError) throw new Error(`member setup: ${membersError.message}`);
  pass("admin/editor/viewer memberships created");

  const adminEntryId = crypto.randomUUID();
  const adminClientId = `qa-local-${crypto.randomUUID()}`;
  const adminRow = {
    id: adminEntryId,
    baby_id: babyId,
    author_id: admin.user.id,
    entry_date: "2026-08-03",
    body: "Diary RLS QA",
    mood: "happy",
    weather: "sunny",
    tags: ["첫 목욕"],
    included_in_growth_book: true,
    client_generated_id: adminClientId,
    metadata: { authorName: "QA admin", authorRole: "owner" },
  };
  const { error: adminInsertError } = await admin.sb.from("diary_entries").insert(adminRow);
  if (adminInsertError) throw new Error(`admin create: ${adminInsertError.message}`);
  pass("admin create allowed");

  const { error: duplicateError } = await admin.sb.from("diary_entries").insert({ ...adminRow, id: crypto.randomUUID() });
  if (!duplicateError || duplicateError.code !== "23505") throw new Error("client_generated_id duplicate was not blocked");
  const { count: dedupeCount, error: dedupeError } = await admin.sb
    .from("diary_entries")
    .select("id", { count: "exact", head: true })
    .eq("baby_id", babyId)
    .eq("client_generated_id", adminClientId);
  if (dedupeError || dedupeCount !== 1) throw new Error("migration dedupe count mismatch");
  pass("client_generated_id migration is idempotent");

  const { error: viewerCreateError } = await viewer.sb.from("diary_entries").insert({
    ...adminRow,
    id: crypto.randomUUID(),
    author_id: viewer.user.id,
    client_generated_id: crypto.randomUUID(),
  });
  if (!viewerCreateError) throw new Error("viewer create unexpectedly allowed");
  pass("viewer create denied");

  const editorEntryId = crypto.randomUUID();
  const { error: editorCreateError } = await editor.sb.from("diary_entries").insert({
    ...adminRow,
    id: editorEntryId,
    author_id: editor.user.id,
    client_generated_id: editorEntryId,
    body: "editor own diary",
  });
  if (editorCreateError) throw new Error(`editor create: ${editorCreateError.message}`);
  pass("editor create allowed");

  const { data: memberRows, error: memberReadError } = await viewer.sb
    .from("diary_entries").select("id").eq("baby_id", babyId);
  if (memberReadError || memberRows?.length !== 2) throw new Error("member read failed");
  pass("member read allowed");

  const { data: outsiderRows, error: outsiderReadError } = await outsider.sb
    .from("diary_entries").select("id").eq("baby_id", babyId);
  if (outsiderReadError || (outsiderRows?.length ?? 0) !== 0) throw new Error("non-member read was not blocked");
  pass("non-member read denied");

  const { data: authorUpdated, error: authorUpdateError } = await editor.sb
    .from("diary_entries").update({ body: "editor updated own diary" }).eq("id", editorEntryId).select("body").single();
  if (authorUpdateError || authorUpdated?.body !== "editor updated own diary") throw new Error("author update failed");
  pass("author update allowed");

  const { error: viewerUpdateError } = await viewer.sb
    .from("diary_entries").update({ body: "blocked" }).eq("id", adminEntryId).select("id").single();
  if (!viewerUpdateError) throw new Error("viewer update unexpectedly allowed");
  pass("viewer update denied");

  const { error: editorOtherUpdateError } = await editor.sb
    .from("diary_entries").update({ body: "blocked editor" }).eq("id", adminEntryId).select("id").single();
  if (!editorOtherUpdateError) throw new Error("editor updated another author's diary");
  pass("editor update limited to own diary");

  const mediaId = crypto.randomUUID();
  storagePath = `${babyId}/${adminEntryId}/${mediaId}.png`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xkAAAAASUVORK5CYII=", "base64");
  const { error: uploadError } = await admin.sb.storage.from("diary-media").upload(storagePath, png, {
    contentType: "image/png",
    upsert: false,
  });
  if (uploadError) throw new Error(`photo upload: ${uploadError.message}`);
  const { error: mediaInsertError } = await admin.sb.from("diary_media").insert({
    id: mediaId,
    diary_entry_id: adminEntryId,
    baby_id: babyId,
    storage_path: storagePath,
    media_type: "image",
    width: 1,
    height: 1,
  });
  if (mediaInsertError) throw new Error(`media row create: ${mediaInsertError.message}`);
  pass("local photo upload and diary_media create allowed");

  const { data: signed, error: signedError } = await viewer.sb.storage
    .from("diary-media").createSignedUrl(storagePath, 180);
  if (signedError || !signed?.signedUrl) throw new Error(`member signed URL: ${signedError?.message ?? "missing URL"}`);
  pass("diary_media signed URL authorized");

  const { data: outsiderSigned, error: outsiderSignedError } = await outsider.sb.storage
    .from("diary-media").createSignedUrl(storagePath, 180);
  if (!outsiderSignedError || outsiderSigned?.signedUrl) throw new Error("non-member signed URL unexpectedly allowed");
  pass("non-member signed URL denied");

  const { data: adminSessionData } = await admin.sb.auth.getSession();
  const restoredClient = client();
  const activeSession = adminSessionData.session;
  if (!activeSession) throw new Error("admin session missing before restart restore QA");
  const { error: restoreSessionError } = await restoredClient.auth.setSession({
    access_token: activeSession.access_token,
    refresh_token: activeSession.refresh_token,
  });
  if (restoreSessionError) throw new Error(`session restore: ${restoreSessionError.message}`);
  const { data: restoredRows, error: restoredReadError } = await restoredClient
    .from("diary_entries").select("id,included_in_growth_book").eq("baby_id", babyId);
  if (restoredReadError || restoredRows?.length !== 2) throw new Error("restart/session restore did not hydrate diary rows");
  pass("session restore rehydrates server diary");
  await restoredClient.auth.signOut({ scope: "local" });

  const { error: removeError } = await admin.sb.storage.from("diary-media").remove([storagePath]);
  if (removeError) throw new Error(`QA media cleanup: ${removeError.message}`);
  const { error: mediaDeleteError } = await admin.sb.from("diary_media").delete().eq("id", mediaId);
  if (mediaDeleteError) throw new Error(`QA media row cleanup: ${mediaDeleteError.message}`);
  storagePath = null;

  const { error: softDeleteError } = await admin.sb.rpc("soft_delete_diary_entry", { p_diary_entry_id: editorEntryId });
  if (softDeleteError) throw new Error(`admin soft delete: ${softDeleteError.message}`);
  const { data: afterDelete, error: afterDeleteError } = await admin.sb
    .from("diary_entries").select("id").eq("id", editorEntryId);
  if (afterDeleteError || (afterDelete?.length ?? 0) !== 0) throw new Error("deleted diary remained visible");
  pass("admin soft delete and deleted-entry exclusion allowed");

  const { data: included, error: includedError } = await admin.sb.from("diary_entries")
    .update({ included_in_growth_book: false }).eq("id", adminEntryId).select("included_in_growth_book").single();
  if (includedError || included?.included_in_growth_book !== false) throw new Error("includedInGrowthBook update failed");
  pass("includedInGrowthBook persisted");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (storagePath) await admin.sb.storage.from("diary-media").remove([storagePath]);
  if (babyId) await admin.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts([admin, editor, viewer, outsider]);
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
