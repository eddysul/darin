import type { Locale } from "../i18n";

export type ResidenceCountry = "US" | "KR" | "OTHER";
export type AppLanguagePreference = "system" | "ko" | "en";

export const RESIDENCE_COUNTRY_OPTIONS: Array<{ value: ResidenceCountry; label: string }> = [
  { value: "US", label: "미국" },
  { value: "KR", label: "한국" },
  { value: "OTHER", label: "기타" },
];

export const APP_LANGUAGE_OPTIONS: Array<{ value: AppLanguagePreference; label: string }> = [
  { value: "system", label: "기기 설정 따라가기" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];

export function isResidenceCountry(value: unknown): value is ResidenceCountry {
  return value === "US" || value === "KR" || value === "OTHER";
}

export function isAppLanguagePreference(value: unknown): value is AppLanguagePreference {
  return value === "system" || value === "ko" || value === "en";
}

export function resolveAppLocale(preference: AppLanguagePreference): Locale {
  if (preference === "ko" || preference === "en") return preference;
  const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return deviceLocale.startsWith("ko") ? "ko" : "en";
}
