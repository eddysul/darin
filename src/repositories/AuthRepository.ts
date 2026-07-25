import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured, requireSupabase } from "../lib/supabase";
import { createId } from "../utils/id";
import { STORAGE_KEYS } from "../utils/storageKeys";

type DeviceAuth = { email: string; password: string };

let inFlight: Promise<Session> | null = null;
let lastAuthError: string | null = null;
let lastAuthErrorAt = 0;
const AUTH_ERROR_COOLDOWN_MS = 60_000;

async function loadDeviceAuth(): Promise<DeviceAuth | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.supabaseDeviceAuth);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceAuth;
    if (typeof parsed.email === "string" && typeof parsed.password === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

async function saveDeviceAuth(creds: DeviceAuth): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.supabaseDeviceAuth, JSON.stringify(creds));
}

async function clearDeviceAuth(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.supabaseDeviceAuth);
}

function rememberAuthError(message: string): never {
  lastAuthError = message;
  lastAuthErrorAt = Date.now();
  throw new Error(message);
}

async function ensureDeviceSession(): Promise<Session> {
  const sb = requireSupabase();
  const existingCreds = await loadDeviceAuth();
  if (existingCreds) {
    const { data, error } = await sb.auth.signInWithPassword(existingCreds);
    if (!error && data.session) return data.session;
    // Stale creds — clear and fall through to one signup attempt.
    await clearDeviceAuth();
  }

  if (lastAuthError && Date.now() - lastAuthErrorAt < AUTH_ERROR_COOLDOWN_MS) {
    throw new Error(lastAuthError);
  }

  const email = `device.${createId().replace(/-/g, "")}@darin-device.local`;
  const password = `${createId()}${createId()}`;
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    rememberAuthError(
      /rate limit/i.test(error.message)
        ? "email rate limit exceeded — enable Anonymous sign-ins (Auth → Providers), wait ~1 min, reload"
        : error.message,
    );
  }
  if (!data.session) {
    rememberAuthError(
      "Email confirmation is required. Enable Anonymous sign-ins, or turn off Confirm email in Supabase Auth.",
    );
  }
  await saveDeviceAuth({ email, password });
  lastAuthError = null;
  return data.session!;
}

export const AuthRepository = {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  async getSession(): Promise<Session | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser(): Promise<User | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  },

  /**
   * Ensure there is an auth session.
   * 1) Existing session
   * 2) Anonymous (preferred for MVP)
   * 3) One-shot device email/password (only if Anonymous unavailable)
   */
  async ensureSession(): Promise<Session> {
    const sb = requireSupabase();
    const existing = await this.getSession();
    if (existing) {
      lastAuthError = null;
      return existing;
    }

    if (inFlight) return inFlight;

    inFlight = (async () => {
      // Prefer Anonymous every time we need a new session.
      const { data, error } = await sb.auth.signInAnonymously();
      if (!error && data.session) {
        lastAuthError = null;
        lastAuthErrorAt = 0;
        return data.session;
      }

      const anonymousDisabled =
        Boolean(error) && /anonymous|disabled/i.test(error?.message ?? "");
      if (error && !anonymousDisabled) {
        console.warn("[supabase] anonymous sign-in failed:", error.message);
      }
      if (anonymousDisabled) {
        console.warn(
          "[supabase] Anonymous is disabled. Enable Auth → Providers → Anonymous (recommended).",
        );
      }

      // Only if Anonymous truly unavailable — and never while rate-limited cooldown holds.
      return ensureDeviceSession();
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  },

  async signOut(): Promise<void> {
    const sb = getSupabase();
    lastAuthError = null;
    lastAuthErrorAt = 0;
    await clearDeviceAuth();
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },
};
