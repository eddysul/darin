/** Live Growth Book tables / private Storage / RLS verification. */
import { cleanupQaAccounts, createPublicClient, createQaAccounts } from "./lib/qa-auth.mjs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) throw new Error("Missing Supabase public client environment variables.");

const lines = [];
const pass = (message) => lines.push(`PASS  ${message}`);
const fail = (message) => lines.push(`FAIL  ${message}`);
const client = createPublicClient;

const probe = client();
const { error: tableError } = await probe.from("growth_books").select("id").limit(1);
if (tableError && (tableError.code === "PGRST205" || /not find|does not exist/i.test(tableError.message))) {
  fail(`growth book migration not applied: ${tableError.message}`);
  console.log(lines.join("\n"));
  process.exit(2);
}
pass("growth_books table reachable");

const [admin, editor, viewer, outsider] = await createQaAccounts([
  "growth-book-admin", "growth-book-editor", "growth-book-viewer", "growth-book-outsider",
]);
let babyId = null;
let editorBabyId = null;
let storagePath = null;

try {
  const { data: baby, error: babyError } = await admin.sb.rpc("create_baby_with_owner", {
    p_name: `성장책QA-${Date.now()}`, p_child_status: "newborn", p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error(`baby create: ${babyError?.message ?? "no baby"}`);
  babyId = baby.id;
  const { error: membersError } = await admin.sb.from("baby_members").insert([
    { baby_id: babyId, user_id: editor.user.id, permission_role: "editor", relationship_label: "시터", status: "active" },
    { baby_id: babyId, user_id: viewer.user.id, permission_role: "viewer", relationship_label: "가족", status: "active" },
  ]);
  if (membersError) throw new Error(`member setup: ${membersError.message}`);

  const bookId = crypto.randomUUID();
  const { error: bookError } = await admin.sb.from("growth_books").insert({
    id: bookId, baby_id: babyId, title: "QA 성장책", status: "draft", created_by: admin.user.id,
  });
  if (bookError) throw new Error(`admin book create: ${bookError.message}`);
  pass("admin create growth book allowed");

  const { data: editorBaby, error: editorBabyError } = await editor.sb.rpc("create_baby_with_owner", {
    p_name: `편집자성장책QA-${Date.now()}`, p_child_status: "newborn", p_relationship_label: "보호자",
  });
  if (editorBabyError || !editorBaby?.id) throw new Error(`editor baby create: ${editorBabyError?.message ?? "no baby"}`);
  editorBabyId = editorBaby.id;
  const { error: editorBookError } = await editor.sb.from("growth_books").insert({
    id: crypto.randomUUID(), baby_id: editorBabyId, title: "editor book", created_by: editor.user.id,
  });
  if (editorBookError) throw new Error(`editor create: ${editorBookError.message}`);
  pass("editor create growth book allowed");

  const { error: viewerCreateError } = await viewer.sb.from("growth_books").insert({
    id: crypto.randomUUID(), baby_id: babyId, title: "blocked", created_by: viewer.user.id,
  });
  if (!viewerCreateError) throw new Error("viewer growth book create unexpectedly allowed");
  pass("viewer create denied");

  const { error: editorDeleteBookError } = await editor.sb.from("growth_books")
    .update({ deleted_at: new Date().toISOString() }).eq("id", bookId).select("id").single();
  if (!editorDeleteBookError) throw new Error("editor bypassed admin-only book soft delete");
  pass("editor book soft delete bypass denied");

  const pageId = crypto.randomUUID();
  const { error: pageError } = await editor.sb.from("growth_book_pages").insert({
    id: pageId, growth_book_id: bookId, baby_id: babyId, page_type: "cover", page_order: 0,
    content_json: { coverTitle: "QA" }, created_by: editor.user.id,
  });
  if (pageError) throw new Error(`editor page create: ${pageError.message}`);
  const { data: updatedPage, error: updateError } = await editor.sb.from("growth_book_pages")
    .update({ content_json: { coverTitle: "QA updated" } }).eq("id", pageId).select("id").single();
  if (updateError || !updatedPage) throw new Error(`editor page update: ${updateError?.message ?? "no row"}`);
  pass("editor page create/update allowed");

  const { error: viewerUpdateError } = await viewer.sb.from("growth_book_pages")
    .update({ content_json: { coverTitle: "blocked" } }).eq("id", pageId).select("id").single();
  if (!viewerUpdateError) throw new Error("viewer page update unexpectedly allowed");
  pass("viewer page update denied");

  const { data: memberRows, error: memberReadError } = await viewer.sb.from("growth_books").select("id").eq("id", bookId);
  if (memberReadError || memberRows?.length !== 1) throw new Error("member read failed");
  const { data: outsiderRows, error: outsiderReadError } = await outsider.sb.from("growth_books").select("id").eq("id", bookId);
  if (outsiderReadError || outsiderRows?.length) throw new Error("non-member read was not denied");
  pass("member read allowed and non-member read denied");

  const commentId = crypto.randomUUID();
  const { error: commentError } = await viewer.sb.from("growth_book_comments").insert({
    id: commentId, growth_book_id: bookId, page_id: pageId, baby_id: babyId,
    author_id: viewer.user.id, body: "가족 롤링페이퍼", comment_type: "rolling_paper",
  });
  if (commentError) throw new Error(`viewer comment: ${commentError.message}`);
  pass("viewer comment allowed");
  const { error: outsiderCommentError } = await outsider.sb.from("growth_book_comments").insert({
    id: crypto.randomUUID(), growth_book_id: bookId, page_id: pageId, baby_id: babyId,
    author_id: outsider.user.id, body: "blocked", comment_type: "page_comment",
  });
  if (!outsiderCommentError) throw new Error("non-member comment unexpectedly allowed");
  pass("non-member comment denied");

  const mediaId = crypto.randomUUID();
  storagePath = `${babyId}/${bookId}/${pageId}/${mediaId}.png`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xkAAAAASUVORK5CYII=", "base64");
  const { error: uploadError } = await editor.sb.storage.from("growth-book-media").upload(storagePath, png, {
    contentType: "image/png", upsert: false,
  });
  if (uploadError) throw new Error(`media upload: ${uploadError.message}`);
  const { error: mediaError } = await editor.sb.from("growth_book_media").insert({
    id: mediaId, growth_book_id: bookId, page_id: pageId, baby_id: babyId,
    storage_path: storagePath, media_type: "image", created_by: editor.user.id,
  });
  if (mediaError) throw new Error(`media row: ${mediaError.message}`);
  const { data: signed, error: signedError } = await viewer.sb.storage.from("growth-book-media").createSignedUrl(storagePath, 120);
  if (signedError || !signed?.signedUrl) throw new Error(`member signed URL: ${signedError?.message ?? "missing URL"}`);
  const { data: outsiderSigned, error: outsiderSignedError } = await outsider.sb.storage.from("growth-book-media").createSignedUrl(storagePath, 120);
  if (!outsiderSignedError || outsiderSigned?.signedUrl) throw new Error("non-member signed URL unexpectedly allowed");
  pass("private media signed URL authorized and non-member denied");

  const { error: removeError } = await editor.sb.storage.from("growth-book-media").remove([storagePath]);
  if (removeError) throw new Error(`media cleanup: ${removeError.message}`);
  const { error: mediaDeleteError } = await editor.sb.from("growth_book_media").delete().eq("id", mediaId);
  if (mediaDeleteError) throw new Error(`media row cleanup: ${mediaDeleteError.message}`);
  storagePath = null;

  const { error: pageDeleteError } = await editor.sb.rpc("soft_delete_growth_book_page", { p_page_id: pageId });
  if (pageDeleteError) throw new Error(`editor page soft delete: ${pageDeleteError.message}`);
  pass("editor soft delete page allowed");
  const { error: bookDeleteError } = await admin.sb.rpc("soft_delete_growth_book", { p_growth_book_id: bookId });
  if (bookDeleteError) throw new Error(`admin book soft delete: ${bookDeleteError.message}`);
  const { data: afterDelete, error: afterDeleteError } = await viewer.sb.from("growth_books").select("id").eq("id", bookId);
  if (afterDeleteError || afterDelete?.length) throw new Error("soft-deleted book remained visible");
  pass("admin soft delete and deleted book exclusion allowed");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (storagePath) await editor.sb.storage.from("growth-book-media").remove([storagePath]);
  if (babyId) await admin.sb.from("babies").delete().eq("id", babyId);
  if (editorBabyId) await editor.sb.from("babies").delete().eq("id", editorBabyId);
  await cleanupQaAccounts([admin, editor, viewer, outsider]);
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
