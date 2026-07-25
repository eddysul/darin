export type PostSplashPhase = "terms" | "auth" | "main";

/** Wait for persisted setup/terms hydration, then resume configured users. */
export function resolvePostSplashPhase(input: {
  splashFinished: boolean;
  careSetupReady: boolean;
  termsReady: boolean;
  hasSavedCareSetup: boolean;
  termsAccepted: boolean;
}): PostSplashPhase | null {
  if (!input.splashFinished || !input.careSetupReady || !input.termsReady) return null;
  if (input.hasSavedCareSetup) return "main";
  if (!input.termsAccepted) return "terms";
  return "auth";
}
