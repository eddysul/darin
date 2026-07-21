export type PostSplashPhase = "login" | "main";

/** Wait for persisted setup hydration, then resume configured users in the MVP. */
export function resolvePostSplashPhase(input: {
  splashFinished: boolean;
  careSetupReady: boolean;
  hasSavedCareSetup: boolean;
}): PostSplashPhase | null {
  if (!input.splashFinished || !input.careSetupReady) return null;
  return input.hasSavedCareSetup ? "main" : "login";
}
