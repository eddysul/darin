import { createClient } from "@supabase/supabase-js";

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

  // Remove private media belonging only to babies that will be deleted. Shared
  // baby media must remain available to the other active family members.
  const { data: memberships, error: membershipsError } = await adminClient
    .from("baby_members").select("baby_id").eq("user_id", userData.user.id);
  if (membershipsError) return json(500, { error: "Account membership lookup failed", retryable: true });
  const babyIds = [...new Set((memberships ?? []).map((row) => row.baby_id))];
  const soloBabyIds: string[] = [];
  for (const babyId of babyIds) {
    const { count, error } = await adminClient.from("baby_members").select("id", { count: "exact", head: true })
      .eq("baby_id", babyId).neq("user_id", userData.user.id).eq("status", "active");
    if (error) return json(500, { error: "Shared data ownership check failed", retryable: true });
    if ((count ?? 0) === 0) soloBabyIds.push(babyId);
  }
  if (soloBabyIds.length) {
    const mediaSources = [
      { table: "diary_media", bucket: "diary-media" },
      { table: "growth_book_media", bucket: "growth-book-media" },
      { table: "memory_media", bucket: "memories" },
    ] as const;
    for (const source of mediaSources) {
      const { data: rows, error } = await adminClient.from(source.table).select("storage_path").in("baby_id", soloBabyIds);
      if (error) return json(500, { error: "Account media lookup failed", retryable: true });
      const paths = (rows ?? []).map((row) => row.storage_path).filter(Boolean);
      if (paths.length) {
        const { error: removeError } = await adminClient.storage.from(source.bucket).remove(paths);
        if (removeError) return json(500, { error: "Account media cleanup failed", retryable: true });
      }
    }
  }

  const { error: cleanupError } = await userClient.rpc("prepare_account_deletion");
  if (cleanupError) {
    console.error("account cleanup failed", cleanupError);
    return json(500, { error: "Account data cleanup failed", retryable: true });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error("auth user deletion failed", deleteError);
    return json(500, { error: "Auth account deletion failed", retryable: true });
  }

  return json(200, { deleted: true, soloBabiesDeleted: soloBabyIds.length });
});
