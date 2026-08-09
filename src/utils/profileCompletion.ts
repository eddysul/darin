export type ProfileCompletionInput =
  | {
      display_name?: string | null;
      default_relation?: string | null;
    }
  | {
      displayName?: string | null;
      defaultRelation?: string | null;
    }
  | null
  | undefined;

/** A provider name or email alone never completes an app profile. */
export function isUserProfileComplete(profile: ProfileCompletionInput): boolean {
  if (!profile) return false;
  const value = profile as {
    display_name?: string | null;
    default_relation?: string | null;
    displayName?: string | null;
    defaultRelation?: string | null;
  };
  const displayName = value.display_name ?? value.displayName;
  const relation = value.default_relation ?? value.defaultRelation;
  const normalizedName = displayName?.trim() ?? "";
  return Boolean(normalizedName && !normalizedName.includes("@") && relation?.trim());
}

export type AuthenticatedRoute = "profileSetup" | "invite" | "babySetup" | "main";

export function canSubmitUserProfile(displayName: string, relation?: string | null): boolean {
  return Boolean(displayName.trim() && relation?.trim());
}

export function resolveAuthenticatedRoute(input: {
  profileComplete: boolean;
  hasPendingInvite: boolean;
  hasBaby: boolean;
}): AuthenticatedRoute {
  if (!input.profileComplete) return "profileSetup";
  if (input.hasPendingInvite) return "invite";
  if (!input.hasBaby) return "babySetup";
  return "main";
}
