import type { Locale } from "../i18n";

export type ResidenceCountry = "US" | "KR" | "OTHER";
export type AppLanguagePreference = "system" | Locale;

export const RESIDENCE_COUNTRY_OPTIONS: Array<{ value: ResidenceCountry; label: string }> = [
  { value: "US", label: "미국" },
  { value: "KR", label: "한국" },
  { value: "OTHER", label: "기타" },
];

export const APP_LANGUAGE_OPTIONS: Array<{ value: AppLanguagePreference; label: string; disabled?: boolean }> = [
  { value: "system", label: "기기 설정 따라가기 · 준비 중", disabled: true },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English · 준비 중", disabled: true },
  { value: "ja", label: "日本語 · 준비 중", disabled: true },
  { value: "es", label: "Español · 준비 중", disabled: true },
  { value: "zh-CN", label: "简体中文 · 준비 중", disabled: true },
];

export function isResidenceCountry(value: unknown): value is ResidenceCountry {
  return value === "US" || value === "KR" || value === "OTHER";
}

export function isAppLanguagePreference(value: unknown): value is AppLanguagePreference {
  return value === "system" || value === "ko" || value === "en" || value === "ja" || value === "es" || value === "zh-CN";
}

export function resolveAppLocale(preference: AppLanguagePreference): Locale {
  if (preference !== "system") return preference;
  const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  if (deviceLocale.startsWith("ko")) return "ko";
  if (deviceLocale.startsWith("ja")) return "ja";
  if (deviceLocale.startsWith("es")) return "es";
  if (deviceLocale.startsWith("zh")) return "zh-CN";
  return "en";
}
