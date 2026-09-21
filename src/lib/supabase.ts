/**
 * Supabase browser/Expo client.
 * Uses only EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 * Never import SUPABASE_SECRET_KEY / SERVICE_ROLE_KEY here.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import { sessionClientOptions } from "./sessionClientOptions";

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

/** Emergency device-only logout when an Auth network request never settles. */
export async function clearLocalSupabaseSession(): Promise<void> {
  const previous = client;
  client = null;
  await previous?.auth.stopAutoRefresh().catch(() => undefined);
  if (!url) return;
  const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  await AsyncStorage.multiRemove([storageKey, `${storageKey}-code-verifier`]);
}

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

/** Short-lived request client: an in-flight upload must not adopt a new login. */
export function sessionScopedSupabase(session: Session): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  return createClient<Database>(url, publishableKey, sessionClientOptions(session.access_token));
}

export type CapturedSessionScope = {
  accountId: string;
  client: SupabaseClient<Database>;
  assertCurrent: () => Promise<void>;
};

/**
 * Pins both identity and token for a multi-step operation. The mutable app
 * client is used only to detect an intervening logout/account switch.
 */
export async function captureSessionScope(): Promise<CapturedSessionScope> {
  const appClient = requireSupabase();
  const { data, error } = await appClient.auth.getSession();
  if (error || !data.session) throw error ?? new Error("Authentication required.");
  const session = data.session;
  const accountId = session.user.id;
  return {
    accountId,
    client: sessionScopedSupabase(session),
    assertCurrent: async () => {
      const current = await appClient.auth.getSession();
      if (current.error || current.data.session?.user.id !== accountId) {
        throw new Error("Account changed during media operation.");
      }
    },
  };
}
