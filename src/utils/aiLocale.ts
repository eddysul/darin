import type { Locale } from "../i18n";

/** Tells the model which language the user-facing reply must use. */
export function aiOutputLanguageInstruction(locale: Locale): string {
  if (locale === "ko") return "Write only in natural Korean using friendly 해요체. Do not mix in English.";
  if (locale === "ja") return "Write only in natural Japanese using a calm, concise です・ます tone. Do not mix in Korean or English.";
  if (locale === "es") return "Write only in clear, neutral Spanish. Keep the tone warm, factual, and concise. Do not mix in Korean or English.";
  if (locale === "zh-CN") return "Write only in natural Simplified Chinese. Keep the tone warm, factual, and concise. Do not mix in Korean, Japanese, or English.";
  return "Write only in clear, natural English. Keep the tone warm, factual, and concise. Do not mix in Korean.";
}

const UNSAFE_TONE: Record<Locale, readonly string[]> = {
  ko: ["하세요", "해보세요", "보세요", "권장", "추천", "때문에", "덕분에", "정상", "비정상", "또래보다"],
  en: ["you should", "we recommend", "try to", "because of", "caused by", "normal", "abnormal", "compared with other babies"],
  ja: ["してください", "おすすめ", "推奨", "試して", "のせいで", "が原因", "正常", "異常", "ほかの赤ちゃんと比べ"],
  es: ["deberías", "debe ", "recomendamos", "prueba a", "a causa de", "provocado por", "normal", "anormal", "comparado con otros bebés"],
  "zh-CN": ["应该", "建议", "推荐", "试着", "因为", "导致", "正常", "异常", "与其他宝宝相比"],
};

/** Rejects mixed-script output and locale-specific medical/advice language before UI display. */
export function isAiOutputLocaleSafe(text: string, locale: Locale): boolean {
  const normalized = text.toLocaleLowerCase();
  if (UNSAFE_TONE[locale].some((phrase) => normalized.includes(phrase.toLocaleLowerCase()))) return false;
  if (locale !== "ko" && /[가-힣]/.test(text)) return false;
  if ((locale === "en" || locale === "es" || locale === "zh-CN") && /[ぁ-ゟ゠-ヿ]/.test(text)) return false;
  if ((locale === "en" || locale === "es") && /[\u3400-\u9fff]/.test(text)) return false;
  if (locale === "ko") return /[가-힣]/.test(text);
  if (locale === "ja") return /[ぁ-ゟ゠-ヿ]/.test(text);
  if (locale === "zh-CN") return /[\u3400-\u9fff]/.test(text);
  return /[A-Za-z]/.test(text);
}
