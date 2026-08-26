import type { Locale } from "../i18n";
import { canShowLanguagePicker, isLocaleAvailable } from "../config/featureFlags";

export type ResidenceCountry = "US" | "KR" | "OTHER";
export type AppLanguagePreference = "system" | Locale;

export const RESIDENCE_COUNTRY_OPTIONS: Array<{ value: ResidenceCountry; label: string }> = [
  { value: "US", label: "미국" },
  { value: "KR", label: "한국" },
  { value: "OTHER", label: "기타" },
];

export const APP_LANGUAGE_OPTIONS: Array<{ value: AppLanguagePreference; label: string; disabled?: boolean }> = [
  { value: "system", label: "기기 설정 따라가기" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "es", label: "Español" },
  { value: "zh-CN", label: "简体中文" },
];

export function getVisibleAppLanguageOptions(): typeof APP_LANGUAGE_OPTIONS {
  if (!canShowLanguagePicker()) return [];
  return APP_LANGUAGE_OPTIONS.filter((option) => option.value === "system"
    || isLocaleAvailable(option.value));
}

export function isResidenceCountry(value: unknown): value is ResidenceCountry {
  return value === "US" || value === "KR" || value === "OTHER";
}

export function isAppLanguagePreference(value: unknown): value is AppLanguagePreference {
  return value === "system" || value === "ko" || value === "en" || value === "ja" || value === "es" || value === "zh-CN";
}

export function resolveAppLocale(preference: AppLanguagePreference): Locale {
  if (preference !== "system") return isLocaleAvailable(preference) ? preference : "ko";
  const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  const resolved: Locale = deviceLocale.startsWith("ko")
    ? "ko"
    : deviceLocale.startsWith("ja")
      ? "ja"
      : deviceLocale.startsWith("es")
        ? "es"
        : deviceLocale.startsWith("zh")
          ? "zh-CN"
          : "en";
  return isLocaleAvailable(resolved) ? resolved : "ko";
}
