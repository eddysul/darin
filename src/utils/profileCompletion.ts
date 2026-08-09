import { isAppLanguagePreference, isResidenceCountry } from "../types/profilePreferences";

export type ProfileCompletionInput =
  | {
      display_name?: string | null;
      nickname?: string | null;
      default_relation?: string | null;
      residence_country?: string | null;
      preferred_language?: string | null;
      guardian_birth_date?: string | null;
    }
  | {
      displayName?: string | null;
      realName?: string | null;
      defaultRelation?: string | null;
      residenceCountry?: string | null;
      preferredLanguage?: string | null;
      guardianBirthDate?: string | null;
    }
  | null
  | undefined;

/** A provider name or email alone never completes an app profile. */
export function isUserProfileComplete(profile: ProfileCompletionInput): boolean {
  if (!profile) return false;
  const value = profile as {
    display_name?: string | null;
    nickname?: string | null;
    default_relation?: string | null;
    displayName?: string | null;
    realName?: string | null;
    defaultRelation?: string | null;
    residence_country?: string | null;
    preferred_language?: string | null;
    residenceCountry?: string | null;
    preferredLanguage?: string | null;
    guardian_birth_date?: string | null;
    guardianBirthDate?: string | null;
  };
  const displayName = value.display_name ?? value.displayName;
  const realName = value.nickname ?? value.realName;
  const relation = value.default_relation ?? value.defaultRelation;
  const country = value.residence_country ?? value.residenceCountry;
  const language = value.preferred_language ?? value.preferredLanguage;
  const guardianBirthDate = value.guardian_birth_date ?? value.guardianBirthDate;
  const normalizedName = displayName?.trim() ?? "";
  return Boolean(
    normalizedName
      && !normalizedName.includes("@")
      && realName?.trim()
      && !realName.includes("@")
      && relation?.trim()
      && isResidenceCountry(country)
      && isAppLanguagePreference(language)
      && guardianBirthDate?.trim(),
  );
}

export type AuthenticatedRoute = "profileSetup" | "invite" | "babySetup" | "main";

export function canSubmitUserProfile(input: {
  displayName: string;
  realName: string;
  relation?: string | null;
  residenceCountry?: string | null;
  preferredLanguage?: string | null;
  guardianBirthDate?: string | null;
}): boolean {
  return Boolean(
    input.displayName.trim()
      && !input.displayName.includes("@")
      && input.realName.trim()
      && !input.realName.includes("@")
      && input.relation?.trim()
      && isResidenceCountry(input.residenceCountry)
      && isAppLanguagePreference(input.preferredLanguage)
      && input.guardianBirthDate?.trim(),
  );
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
