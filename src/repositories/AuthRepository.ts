import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import * as ExpoLinking from "expo-linking";
import { getSupabase, isSupabaseConfigured, requireSupabase } from "../lib/supabase";
import { createId } from "../utils/id";
import { STORAGE_KEYS } from "../utils/storageKeys";

type DeviceAuth = { email: string; password: string };
type PendingEmailAuth = { email: string; flow: "anonymous_upgrade" | "signup" };

export type EmailAuthResult = {
  status: "authenticated" | "confirmation_required";
  user: User | null;
  email: string;
  needsPasswordAfterConfirmation: boolean;
};

function authRedirectUrl(path: "callback" | "reset-password"): string {
  // Expo Go uses exp://host/--/... while development/production builds use
  // the `knanny` scheme configured in app.json. Generate the URL at runtime
  // so email links return to whichever client initiated the auth request.
  return ExpoLinking.createURL(`auth/${path}`);
}

function authRedirectPath(url: URL): "/auth/callback" | "/auth/reset-password" | null {
  const scheme = url.protocol.toLowerCase();
  if (!["knanny:", "exp:", "exps:", "http:", "https:"].includes(scheme)) return null;

  const rawPath =
    scheme === "knanny:" ? `/${url.hostname}${url.pathname}` : url.pathname.replace(/^\/--/, "");
  const path = rawPath.replace(/\/+$/, "");
  if (path === "/auth/callback") return "/auth/callback";
  if (path === "/auth/reset-password") return "/auth/reset-password";
  return null;
}

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

async function savePendingEmailAuth(value: PendingEmailAuth): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.pendingEmailAuth, JSON.stringify(value));
}

async function clearPendingEmailAuth(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.pendingEmailAuth);
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAnonymousUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.is_anonymous === true || user.app_metadata?.provider === "anonymous";
}

function isEmailConfirmed(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at);
}

async function anonymousHasBabyMembership(): Promise<boolean> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("baby_members").select("baby_id").limit(1);
  if (error) throw error;
  return Boolean(data?.length);
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

  isAnonymousUser,

  async getPendingEmailAuth(): Promise<PendingEmailAuth | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.pendingEmailAuth);
      if (!raw) return null;
      const value = JSON.parse(raw) as PendingEmailAuth;
      if (
        typeof value.email === "string" &&
        (value.flow === "anonymous_upgrade" || value.flow === "signup")
      ) {
        return value;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Create an email/password account. Anonymous users are upgraded in place so
   * their auth.uid() — and therefore every existing RLS relationship — stays unchanged.
   */
  async signUpWithPassword(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<EmailAuthResult> {
    const sb = requireSupabase();
    const email = normalizedEmail(input.email);
    const current = await this.getSession();

    if (current && isAnonymousUser(current.user)) {
      const { data, error } = await sb.auth.updateUser(
        {
          email,
          data: input.displayName ? { display_name: input.displayName.trim() } : undefined,
        },
        { emailRedirectTo: authRedirectUrl("callback") },
      );
      if (error) throw error;

      if (isEmailConfirmed(data.user)) {
        const passwordResult = await sb.auth.updateUser({ password: input.password });
        if (passwordResult.error) throw passwordResult.error;
        await clearPendingEmailAuth();
        await clearDeviceAuth();
        return {
          status: "authenticated",
          user: passwordResult.data.user,
          email,
          needsPasswordAfterConfirmation: false,
        };
      }

      await savePendingEmailAuth({ email, flow: "anonymous_upgrade" });
      return {
        status: "confirmation_required",
        user: data.user,
        email,
        needsPasswordAfterConfirmation: true,
      };
    }

    if (current && !isAnonymousUser(current.user)) {
      throw new Error("이미 이메일 계정으로 로그인되어 있어요.");
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo: authRedirectUrl("callback"),
        data: input.displayName ? { display_name: input.displayName.trim() } : undefined,
      },
    });
    if (error) throw error;
    if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
      throw new Error("이미 가입된 이메일이에요. 로그인해주세요.");
    }

    if (!data.session || !isEmailConfirmed(data.user)) {
      await savePendingEmailAuth({ email, flow: "signup" });
      return {
        status: "confirmation_required",
        user: data.user,
        email,
        needsPasswordAfterConfirmation: false,
      };
    }

    await clearPendingEmailAuth();
    return {
      status: "authenticated",
      user: data.user,
      email,
      needsPasswordAfterConfirmation: false,
    };
  },

  async signInWithPassword(emailInput: string, password: string): Promise<Session> {
    const sb = requireSupabase();
    const current = await this.getSession();
    if (current && isAnonymousUser(current.user) && (await anonymousHasBabyMembership())) {
      throw new Error(
        "이 기기의 익명 기록을 먼저 새 이메일 계정에 연결해주세요. 기존 계정 로그인으로 전환하면 익명 기록을 안전하게 합칠 수 없어요.",
      );
    }
    const { data, error } = await sb.auth.signInWithPassword({
      email: normalizedEmail(emailInput),
      password,
    });
    if (error) throw error;
    if (!data.session) throw new Error("로그인 세션을 만들지 못했어요.");
    await Promise.all([clearDeviceAuth(), clearPendingEmailAuth()]);
    return data.session;
  },

  async sendPasswordReset(emailInput: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(normalizedEmail(emailInput), {
      redirectTo: authRedirectUrl("reset-password"),
    });
    if (error) throw error;
  },

  async resendPendingEmailAuth(): Promise<"resent" | "already_confirmed"> {
    const sb = requireSupabase();
    const pending = await this.getPendingEmailAuth();
    if (!pending) throw new Error("다시 보낼 인증 요청을 찾지 못했어요. 회원가입을 다시 진행해주세요.");

    // A confirmation link opened on the same device may already have restored
    // the session. Do not ask GoTrue to resend a signup email in that state.
    const session = await this.getSession();
    if (
      session?.user.email?.toLowerCase() === pending.email.toLowerCase() &&
      isEmailConfirmed(session.user)
    ) {
      await clearPendingEmailAuth();
      return "already_confirmed";
    }

    const { error } = await sb.auth.resend({
      type: pending.flow === "anonymous_upgrade" ? "email_change" : "signup",
      email: pending.email,
      options: { emailRedirectTo: authRedirectUrl("callback") },
    });
    if (error) {
      // GoTrue may explicitly reject a resend for a confirmed address. Some
      // configurations intentionally return success instead to avoid account
      // enumeration, so the confirmation screen also offers a direct login path.
      if (/already.{0,20}confirm|confirm.{0,20}already|email.{0,20}confirmed/i.test(error.message)) {
        await clearPendingEmailAuth();
        return "already_confirmed";
      }
      throw error;
    }
    return "resent";
  },

  async completePendingEmailAuth(password?: string): Promise<User> {
    const sb = requireSupabase();
    const pending = await this.getPendingEmailAuth();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    if (!data.user || !isEmailConfirmed(data.user)) {
      throw new Error("이메일 인증이 아직 완료되지 않았어요. 메일의 인증 링크를 먼저 열어주세요.");
    }
    if (pending?.flow === "anonymous_upgrade") {
      if (!password) throw new Error("인증을 마치려면 비밀번호를 다시 입력해주세요.");
      const updated = await sb.auth.updateUser({ password });
      if (updated.error) throw updated.error;
      await clearPendingEmailAuth();
      return updated.data.user;
    }
    await clearPendingEmailAuth();
    return data.user;
  },

  async updatePassword(password: string): Promise<User> {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    return data.user;
  },

  /** Accept PKCE or token-style Supabase confirmation/recovery redirects. */
  async handleAuthUrl(url: string): Promise<"recovery" | "confirmed" | null> {
    const parsed = new URL(url);
    const redirectPath = authRedirectPath(parsed);
    if (!redirectPath) return null;
    const sb = requireSupabase();
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const code = parsed.searchParams.get("code");
    const accessToken = parsed.searchParams.get("access_token") ?? hash.get("access_token");
    const refreshToken = parsed.searchParams.get("refresh_token") ?? hash.get("refresh_token");
    const type = parsed.searchParams.get("type") ?? hash.get("type");

    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (accessToken && refreshToken) {
      const { error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    }
    return type === "recovery" || redirectPath === "/auth/reset-password"
      ? "recovery"
      : "confirmed";
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
