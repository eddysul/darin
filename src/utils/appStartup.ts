export type PostSplashPhase = "terms" | "auth" | "postAuth";

/** Wait for persisted setup/terms hydration, then resume configured users. */
export function resolvePostSplashPhase(input: {
  splashFinished: boolean;
  careSetupReady: boolean;
  termsReady: boolean;
  authReady: boolean;
  hasAuthSession: boolean;
  hasSavedCareSetup: boolean;
  termsAccepted: boolean;
}): PostSplashPhase | null {
  if (!input.splashFinished || !input.careSetupReady || !input.termsReady || !input.authReady) return null;
  // A persisted local setup is not proof that the remote profile is complete.
  // Every authenticated session must pass through the shared post-auth router.
  if (input.hasAuthSession) return "postAuth";
  if (!input.termsAccepted) return "terms";
  return "auth";
}
