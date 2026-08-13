import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { getSupabase, isSupabaseConfigured, requireSupabase } from "../lib/supabase";
import {
  completeAuthCallback,
  parseAuthCallback,
  type AuthCallbackResult,
} from "../utils/authCallback";
import { validateGoogleLink, validateGoogleLogin } from "../utils/googleAuthFlow";
import { STORAGE_KEYS } from "../utils/storageKeys";

WebBrowser.maybeCompleteAuthSession();

type PendingEmailAuth = { email: string; flow: "signup" };
type OAuthCallbackSource =
  | "oauth-callback"
  | "google-login"
  | "google-link"
  | "kakao-login"
  | "kakao-link"
  | "apple-login"
  | "apple-link";

export type EmailAuthResult = {
  status: "authenticated" | "confirmation_required";
  user: User | null;
  email: string;
};

function authRedirectUrl(path: "callback" | "reset-password"): string {
  // TestFlight/standalone builds do not always expose an Expo manifest to
  // expo-linking. The native URL scheme is part of Info.plist, so use it
  // directly instead of asking expo-linking to infer it at runtime.
  return `knanny://auth/${path}`;
}

async function clearLegacyDeviceAuth(): Promise<void> {
  // Older builds persisted a generated fallback password in AsyncStorage.
  // Remove it on every auth transition; credentials must never be stored there.
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

function isUnsupportedLegacySession(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.is_anonymous === true || user.app_metadata?.provider === "anonymous";
}

function isEmailConfirmed(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at);
}

function socialDisplayName(user: User): string | undefined {
  const metadata = user.user_metadata;
  const value = metadata?.full_name ?? metadata?.name ?? metadata?.display_name ?? metadata?.nickname;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
    if (isUnsupportedLegacySession(data.session?.user)) {
      // Build 12 no longer supports guest sessions. Clear only this device's
      // token; never delete the legacy server user or associated records.
      await Promise.all([
        sb.auth.signOut({ scope: "local" }),
        clearLegacyDeviceAuth(),
        clearPendingEmailAuth(),
      ]);
      return null;
    }
    return data.session;
  },

  async getUser(): Promise<User | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  },

  async getPendingEmailAuth(): Promise<PendingEmailAuth | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.pendingEmailAuth);
      if (!raw) return null;
      const value = JSON.parse(raw) as PendingEmailAuth;
      if (typeof value.email === "string" && value.flow === "signup") {
        return value;
      }
      await clearPendingEmailAuth();
      return null;
    } catch {
      return null;
    }
  },

  /** Create a new email/password account from the signed-out auth screen. */
  async signUpWithPassword(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<EmailAuthResult> {
    const sb = requireSupabase();
    const email = normalizedEmail(input.email);
    const current = await this.getSession();

    if (current) {
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
      };
    }

    await clearPendingEmailAuth();
    return {
      status: "authenticated",
      user: data.user,
      email,
    };
  },

  async signInWithPassword(emailInput: string, password: string): Promise<Session> {
    const sb = requireSupabase();
    await this.getSession();
    const { data, error } = await sb.auth.signInWithPassword({
      email: normalizedEmail(emailInput),
      password,
    });
    if (error) throw error;
    if (!data.session) throw new Error("로그인 세션을 만들지 못했어요.");
    await Promise.all([clearLegacyDeviceAuth(), clearPendingEmailAuth()]);
    return data.session;
  },

  /** Google sign-in for signed-out login/onboarding screens. */
  async signInWithGoogle(): Promise<{
    user: User;
    email: string;
    name?: string;
  } | null> {
    const sb = requireSupabase();
    await this.getSession();
    const redirectTo = authRedirectUrl("callback");
    const credentials = {
      provider: "google" as const,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    };
    const oauth = await sb.auth.signInWithOAuth(credentials);
    if (oauth.error) throw oauth.error;
    if (!oauth.data.url) throw new Error("Google 로그인 주소를 만들지 못했어요.");

    const browserResult = await WebBrowser.openAuthSessionAsync(oauth.data.url, redirectTo);
    if (browserResult.type !== "success" || !("url" in browserResult) || !browserResult.url) {
      return null;
    }
    const callback = await this.handleAuthUrl(browserResult.url, "google-login");
    const session = await this.getSession();
    const validation = validateGoogleLogin(callback, session?.user.id);
    if (validation.status === "cancelled") return null;
    if (validation.status === "error" || !session?.user) {
      throw new Error("Google 로그인에 실패했어요. 다시 시도해주세요.");
    }

    await Promise.all([clearLegacyDeviceAuth(), clearPendingEmailAuth()]);
    return {
      user: session.user,
      email: session.user.email ?? "",
      name: socialDisplayName(session.user),
    };
  },

  /** Add Google as an identity without changing the signed-in auth.uid(). */
  async linkGoogleIdentity(): Promise<User | null> {
    const sb = requireSupabase();
    const previousSession = await this.getSession();
    if (!previousSession?.user) throw new Error("missing_link_session");

    const redirectTo = authRedirectUrl("callback");
    const oauth = await sb.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauth.error) throw oauth.error;
    if (!oauth.data.url) throw new Error("missing_google_link_url");

    const browserResult = await WebBrowser.openAuthSessionAsync(oauth.data.url, redirectTo);
    if (browserResult.type !== "success" || !("url" in browserResult) || !browserResult.url) {
      return null;
    }

    const callback = await this.handleAuthUrl(browserResult.url, "google-link");
    if (callback?.status === "cancelled") return null;
    if (!callback || callback.status === "error") {
      throw new Error("google_link_callback_failed");
    }
    const session = await this.getSession();
    if (!session?.user || session.user.id !== previousSession.user.id) {
      await sb.auth.setSession({
        access_token: previousSession.access_token,
        refresh_token: previousSession.refresh_token,
      });
      throw new Error(session?.user ? "google_link_user_changed" : "google_link_missing_session");
    }
    const { data: identities, error: identitiesError } = await sb.auth.getUserIdentities();
    if (identitiesError) throw identitiesError;
    const validation = validateGoogleLink(
      callback,
      previousSession.user.id,
      session?.user.id,
      identities.identities.map((identity) => identity.provider),
    );
    if (validation.status === "error") {
      throw new Error(`google_link_${validation.status === "error" ? validation.reason : "failed"}`);
    }
    return session.user;
  },

  /** Kakao sign-in for signed-out login/onboarding screens. */
  async signInWithKakao(): Promise<{
    user: User;
    email: string;
    name?: string;
  } | null> {
    const sb = requireSupabase();
    await this.getSession();
    const redirectTo = authRedirectUrl("callback");
    const credentials = {
      provider: "kakao" as const,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    };
    const oauth = await sb.auth.signInWithOAuth(credentials);
    if (oauth.error) throw oauth.error;
    if (!oauth.data.url) throw new Error("카카오 로그인 주소를 만들지 못했어요.");

    const browserResult = await WebBrowser.openAuthSessionAsync(oauth.data.url, redirectTo);
    if (browserResult.type !== "success" || !("url" in browserResult) || !browserResult.url) {
      return null;
    }
    const callback = await this.handleAuthUrl(browserResult.url, "kakao-login");
    if (callback?.status === "cancelled") return null;
    if (!callback || callback.status === "error") {
      throw new Error("카카오 로그인에 실패했어요. 다시 시도해주세요.");
    }
    const session = await this.getSession();
    if (!session?.user) throw new Error("카카오 로그인 세션을 만들지 못했어요.");

    await Promise.all([clearLegacyDeviceAuth(), clearPendingEmailAuth()]);
    return {
      user: session.user,
      email: session.user.email ?? "",
      name: socialDisplayName(session.user),
    };
  },

  /** Add Kakao as an identity without changing the signed-in auth.uid(). */
  async linkKakaoIdentity(): Promise<User | null> {
    const sb = requireSupabase();
    const previousSession = await this.getSession();
    if (!previousSession?.user) throw new Error("missing_link_session");

    const redirectTo = authRedirectUrl("callback");
    const oauth = await sb.auth.linkIdentity({
      provider: "kakao",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (oauth.error) throw oauth.error;
    if (!oauth.data.url) throw new Error("missing_kakao_link_url");

    const browserResult = await WebBrowser.openAuthSessionAsync(oauth.data.url, redirectTo);
    if (browserResult.type !== "success" || !("url" in browserResult) || !browserResult.url) {
      return null;
    }

    const callback = await this.handleAuthUrl(browserResult.url, "kakao-link");
    if (callback?.status === "cancelled") return null;
    if (!callback || callback.status === "error") {
      throw new Error("kakao_link_callback_failed");
    }
    const session = await this.getSession();
    if (!session?.user || session.user.id !== previousSession.user.id) {
      await sb.auth.setSession({
        access_token: previousSession.access_token,
        refresh_token: previousSession.refresh_token,
      });
      throw new Error(session?.user ? "kakao_link_user_changed" : "kakao_link_missing_session");
    }
    const { data: identities, error: identitiesError } = await sb.auth.getUserIdentities();
    if (identitiesError) throw identitiesError;
    if (!identities.identities.some((identity) => identity.provider === "kakao")) {
      throw new Error("kakao_link_identity_missing");
    }
    return session.user;
  },

  /** Native Sign in with Apple followed by Supabase ID-token authentication. */
  async signInWithApple(): Promise<{
    user: User;
    email: string;
    name?: string;
  } | null> {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) throw new Error("이 기기에서는 Apple 로그인을 사용할 수 없어요.");

    await this.getSession();

    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as Error & { code?: string }).code === "ERR_REQUEST_CANCELED"
      ) {
        return null;
      }
      throw error;
    }

    if (!credential.identityToken) {
      throw new Error("Apple 인증 토큰을 받지 못했어요. 다시 시도해주세요.");
    }

    const sb = requireSupabase();
    const { data, error } = await sb.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });
    if (error) throw error;
    if (!data.user || !data.session) throw new Error("Apple 로그인 세션을 만들지 못했어요.");

    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ")
      .trim();
    let user = data.user;
    if (fullName && !socialDisplayName(user)) {
      const updated = await sb.auth.updateUser({ data: { display_name: fullName } });
      if (updated.error) throw updated.error;
      user = updated.data.user;
    }

    await Promise.all([clearLegacyDeviceAuth(), clearPendingEmailAuth()]);
    return {
      user,
      email: user.email ?? credential.email ?? "",
      name: socialDisplayName(user) ?? (fullName || undefined),
    };
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
      type: "signup",
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

  async completePendingEmailAuth(): Promise<User> {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    if (!data.user || !isEmailConfirmed(data.user)) {
      throw new Error("이메일 인증이 아직 완료되지 않았어요. 메일의 인증 링크를 먼저 열어주세요.");
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

  /** Accept only callbacks that produce and verify a real Supabase session. */
  async handleAuthUrl(
    url: string,
    providerSource: OAuthCallbackSource = "oauth-callback",
  ): Promise<AuthCallbackResult | null> {
    const parsed = parseAuthCallback(url);
    return completeAuthCallback(
      parsed,
      {
        exchangeCodeForSession: async (code) => {
          const sb = requireSupabase();
          const { error } = await sb.auth.exchangeCodeForSession(code);
          return { error: error ? { code: error.code } : null };
        },
        setSession: async (tokens) => {
          const sb = requireSupabase();
          const { error } = await sb.auth.setSession(tokens);
          return { error: error ? { code: error.code } : null };
        },
        getSession: async () => {
          const sb = requireSupabase();
          const { data, error } = await sb.auth.getSession();
          return { data: { session: data.session }, error: error ? { code: error.code } : null };
        },
      },
      __DEV__
        ? (event) => console.warn("[Auth] OAuth callback rejected", {
            provider: providerSource,
            source: event.source,
            errorCode: event.errorCode,
          })
        : undefined,
    );
  },

  /** Require a real signed-in session. This method never creates an account. */
  async ensureSession(): Promise<Session> {
    const existing = await this.getSession();
    if (existing) {
      await clearLegacyDeviceAuth();
      return existing;
    }
    await clearLegacyDeviceAuth();
    throw new Error("로그인이 필요해요.");
  },

  async signOut(): Promise<void> {
    const sb = getSupabase();
    await clearLegacyDeviceAuth();
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },
};
