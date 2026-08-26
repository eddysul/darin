import type { Locale } from "../i18n";

/** Tells the model which language the user-facing reply must use. */
export function aiOutputLanguageInstruction(locale: Locale): string {
  if (locale === "ko") return "Write only in Korean (한국어, 해요체). Do not write in English.";
  if (locale === "ja") return "Write only in Japanese. Do not write in English or Korean.";
  if (locale === "es") return "Write only in Spanish. Do not write in English or Korean.";
  if (locale === "zh-CN") return "Write only in Simplified Chinese. Do not write in English or Korean.";
  return "Write only in English. Do not write in Korean.";
}
