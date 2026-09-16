import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { drainStorageCleanup } from "../_shared/storageCleanup.ts";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: jsonHeaders });
  }
  if (request.method !== "POST" && request.method !== "DELETE") {
    return json(405, { error: "Method not allowed" });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return json(401, { error: "Authentication required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: "Server configuration missing" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return json(401, { error: "Invalid session" });
  }

  let confirmationText = "";
  try {
    const body = await request.json();
    confirmationText = typeof body?.confirmationText === "string" ? body.confirmationText.trim() : "";
  } catch {
    return json(400, { error: "Confirmation is required" });
  }
  if (confirmationText !== "삭제") return json(400, { error: "Confirmation text does not match" });

  // B0.4a determines which DB resources are actually deleted. Transactional
  // deletion triggers enqueue only those resources; never delete bytes using
  // a pre-deletion membership snapshot that may have become stale.
  const { error: cleanupError } = await userClient.rpc("prepare_account_deletion");
  if (cleanupError) {
    console.error("account cleanup failed");
    return json(500, { error: "Account data cleanup failed", retryable: true });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error("auth user deletion failed");
    return json(500, { error: "Auth account deletion failed", retryable: true });
  }

  let mediaCleanupPending = true;
  try {
    const result = await drainStorageCleanup({
      claim: async () => {
        const { data, error } = await adminClient.rpc("claim_media_cleanup", { p_requested_by: userData.user.id, p_limit: 100 });
        if (error) throw error;
        return data ?? [];
      },
      remove: async (bucket, path) => {
        const { error } = await adminClient.storage.from(bucket).remove([path]);
        if (error) throw error;
      },
      finish: async (intent) => {
        const { data, error } = await adminClient.rpc("finish_media_cleanup", {
          p_bucket: intent.bucket_id, p_path: intent.storage_path, p_lease: intent.lease_id,
        });
        if (error) throw error;
        return data === true;
      },
    });
    // Bounded request work; >100 or crashed requests are drained by maintenance.
    mediaCleanupPending = result.pending > 0 || result.completed === 100;
  } catch { /* durable intents survive account deletion */ }
  return json(200, { deleted: true, mediaCleanupPending });
});
