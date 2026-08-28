import { coreMessages, type CoreMessageKey } from "./i18nCoreMessages";
import { legacyLocaleOverrides } from "./i18nLegacyLocaleOverrides";
import { legacyMessages } from "./i18nLegacyMessages";

export type Locale = "ko" | "en" | "ja" | "es" | "zh-CN";

const messages = legacyMessages;

export type MessageKey = keyof typeof messages.en | CoreMessageKey;

const localeOverrides = legacyLocaleOverrides as Record<
  Exclude<Locale, "ko" | "en">,
  Partial<Record<keyof typeof messages.en, string>>
>;

export function createT(locale: Locale) {
  return (key: MessageKey, params?: Record<string, string | number>) => {
    const core = coreMessages[locale][key as CoreMessageKey];
    const legacyKey = key as keyof typeof messages.en;
    const translated = core ?? (locale === "ko" || locale === "en"
      ? messages[locale][legacyKey]
      : localeOverrides[locale][legacyKey] ?? messages.en[legacyKey]);
    if (!params) return translated;
    return Object.entries(params).reduce(
      (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
      translated as string,
    );
  };
}
