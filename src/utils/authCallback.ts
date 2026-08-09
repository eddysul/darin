export type AuthCallbackMode = "confirmed" | "recovery";

export type ParsedAuthCallback =
  | { status: "ignored" }
  | { status: "cancelled"; errorDescription?: string }
  | {
      status: "error";
      reason: "provider_error" | "missing_credentials" | "incomplete_tokens";
      errorCode?: string;
      errorDescription?: string;
    }
  | { status: "exchange"; mode: AuthCallbackMode; code: string }
  | {
      status: "tokens";
      mode: AuthCallbackMode;
      accessToken: string;
      refreshToken: string;
    };

function callbackPath(url: URL): "/auth/callback" | "/auth/reset-password" | null {
  const scheme = url.protocol.toLowerCase();
  if (!["knanny:", "exp:", "exps:", "http:", "https:"].includes(scheme)) return null;

  const rawPath =
    scheme === "knanny:" ? `/${url.hostname}${url.pathname}` : url.pathname.replace(/^\/--/, "");
  const path = rawPath.replace(/\/+$/, "");
  if (path === "/auth/callback") return "/auth/callback";
  if (path === "/auth/reset-password") return "/auth/reset-password";
  return null;
}

/** Parse an auth callback without reading or changing the current session. */
export function parseAuthCallback(urlValue: string): ParsedAuthCallback {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return { status: "ignored" };
  }

  const path = callbackPath(url);
  if (!path) return { status: "ignored" };

  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const read = (key: string) => url.searchParams.get(key) ?? hash.get(key);
  const providerError = read("error");
  const errorDescription = read("error_description") ?? undefined;
  if (providerError === "access_denied") {
    return { status: "cancelled", errorDescription };
  }
  if (providerError) {
    return {
      status: "error",
      reason: "provider_error",
      errorCode: providerError,
      errorDescription,
    };
  }

  const type = read("type");
  const mode: AuthCallbackMode =
    type === "recovery" || path === "/auth/reset-password" ? "recovery" : "confirmed";
  const code = read("code");
  if (code) return { status: "exchange", mode, code };

  const accessToken = read("access_token");
  const refreshToken = read("refresh_token");
  if (accessToken && refreshToken) {
    return { status: "tokens", mode, accessToken, refreshToken };
  }
  if (accessToken || refreshToken) {
    return { status: "error", reason: "incomplete_tokens" };
  }
  return { status: "error", reason: "missing_credentials" };
}
