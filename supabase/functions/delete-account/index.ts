import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function temporaryFailure(stage: string, postgresCode?: string | null) {
  console.error(JSON.stringify({
    stage,
    code: "ACCOUNT_DELETION_TEMPORARY_FAILURE",
    postgresCode: postgresCode ?? null,
  }));
  return json(503, { code: "ACCOUNT_DELETION_TEMPORARY_FAILURE", retryable: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (request.method !== "POST" && request.method !== "DELETE") {
    return json(405, { code: "METHOD_NOT_ALLOWED" });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return json(401, { code: "UNAUTHORIZED" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return temporaryFailure("configuration");

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authorization.replace(/^Bearer\s+/i, "");
    let userId: string;
    try {
      const { data, error } = await userClient.auth.getUser(token);
      if (error || !data.user) return json(401, { code: "UNAUTHORIZED" });
      userId = data.user.id;
    } catch {
      return temporaryFailure("authenticate");
    }

    let confirmationText = "";
    try {
      const body = await request.json();
      confirmationText = typeof body?.confirmationText === "string" ? body.confirmationText.trim() : "";
    } catch {
      return json(400, { code: "INVALID_CONFIRMATION" });
    }
    if (confirmationText !== "삭제") return json(400, { code: "INVALID_CONFIRMATION" });

    // The RPC commits baby lifecycle changes and Storage queue intents first.
    const { error: cleanupError } = await userClient.rpc("prepare_account_deletion");
    if (cleanupError) return temporaryFailure("db_prepare", cleanupError.code);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) return temporaryFailure("auth_delete");

    // The scheduled worker drains durable intents. Physical Storage removal
    // cannot turn a completed account deletion into an HTTP failure.
    return json(200, { deleted: true, mediaCleanupPending: true });
  } catch {
    return temporaryFailure("unexpected");
  }
});
