import { getSupabase } from "../lib/supabase";

export async function getAIRequestHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Authentication required");

  return { Authorization: `Bearer ${accessToken}` };
}
