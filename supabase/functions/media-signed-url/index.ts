import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const kinds = new Set([
  "memory_media", "diary_media", "growth_book_media",
  "baby_sticker", "profile_avatar", "baby_avatar",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const authorization = request.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !url || !publicKey || !serviceKey) return json(401, { error: "UNAUTHORIZED" });

  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) return json(401, { error: "UNAUTHORIZED" });
  const user = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await user.auth.getUser(token);
  if (verified.error || !verified.data.user) return json(401, { error: "UNAUTHORIZED" });

  let body: { kind?: unknown; resourceId?: unknown; width?: unknown };
  try { body = await request.json(); } catch { return json(400, { error: "INVALID_REQUEST" }); }
  if (typeof body.kind !== "string" || !kinds.has(body.kind)
    || typeof body.resourceId !== "string" || !uuid.test(body.resourceId)
    || (body.width !== undefined && (!Number.isInteger(body.width) || body.width < 1 || body.width > 2000))) {
    return json(400, { error: "INVALID_REQUEST" });
  }

  const resolved = await user.rpc("resolve_private_media_for_signing", {
    p_kind: body.kind,
    p_resource_id: body.resourceId,
  });
  const row = Array.isArray(resolved.data) ? resolved.data[0] : null;
  if (resolved.error || !row?.bucket_id || !row?.storage_path || !row?.expires_in) {
    return json(404, { error: "MEDIA_NOT_FOUND" });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await admin.storage.from(row.bucket_id).createSignedUrl(
    row.storage_path,
    row.expires_in,
    body.width ? { transform: { width: body.width, quality: 75, resize: "contain" } } : undefined,
  );
  if (signed.error || !signed.data?.signedUrl) return json(503, { error: "SIGNING_UNAVAILABLE" });
  return json(200, { signedUrl: signed.data.signedUrl, expiresIn: row.expires_in });
});
