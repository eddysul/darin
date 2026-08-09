import type { AuthCallbackResult } from "./authCallback";

export type GoogleFlowValidation =
  | { status: "success" }
  | { status: "cancelled" }
  | {
      status: "error";
      reason: "callback" | "missing_session" | "user_changed" | "missing_identity";
    };

export function validateGoogleLogin(
  callback: AuthCallbackResult | null,
  sessionUserId?: string,
): GoogleFlowValidation {
  if (callback?.status === "cancelled") return { status: "cancelled" };
  if (callback?.status !== "success") return { status: "error", reason: "callback" };
  if (!sessionUserId) return { status: "error", reason: "missing_session" };
  return { status: "success" };
}

export function validateGoogleLink(
  callback: AuthCallbackResult | null,
  previousUserId: string,
  currentUserId: string | undefined,
  identityProviders: readonly string[],
): GoogleFlowValidation {
  if (callback?.status === "cancelled") return { status: "cancelled" };
  if (callback?.status !== "success") return { status: "error", reason: "callback" };
  if (!currentUserId) return { status: "error", reason: "missing_session" };
  if (currentUserId !== previousUserId) return { status: "error", reason: "user_changed" };
  if (!identityProviders.includes("google")) {
    return { status: "error", reason: "missing_identity" };
  }
  return { status: "success" };
}
