export type PostSplashPhase = "terms" | "auth" | "main";

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
  if (input.hasSavedCareSetup && input.hasAuthSession) return "main";
  if (!input.termsAccepted) return "terms";
  return "auth";
}
