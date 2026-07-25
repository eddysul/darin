/**
 * Supabase browser/Expo client.
 * Uses only EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 * Never import SUPABASE_SECRET_KEY / SERVICE_ROLE_KEY here.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export type SupabaseStatus = "ready" | "missing_env";

export function getSupabaseEnvStatus(): SupabaseStatus {
  if (!url || !publishableKey) return "missing_env";
  return "ready";
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnvStatus() === "ready";
}

let client: SupabaseClient<Database> | null = null;

/** Returns null when env is missing — callers should fall back to local cache. */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient<Database>(url, publishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/** Throws when Supabase is not configured — use inside repositories that require server. */
export function requireSupabase(): SupabaseClient<Database> {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return sb;
}
