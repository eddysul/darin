import {
  familyCriticalEn,
  familyCriticalEs,
  familyCriticalJa,
  familyCriticalKo,
  familyCriticalZhCN,
} from "../src/i18nFamilyCriticalMessages.ts";
import {
  memoryCriticalEn,
  memoryCriticalEs,
  memoryCriticalJa,
  memoryCriticalKo,
  memoryCriticalZhCN,
} from "../src/i18nMemoriesCriticalMessages.ts";
import {
  stickerCriticalEn,
  stickerCriticalEs,
  stickerCriticalJa,
  stickerCriticalKo,
  stickerCriticalZhCN,
} from "../src/i18nStickerCriticalMessages.ts";
import {
  noticeCriticalEn,
  noticeCriticalEs,
  noticeCriticalJa,
  noticeCriticalKo,
  noticeCriticalZhCN,
} from "../src/i18nNoticeCriticalMessages.ts";
import {
  pickerCriticalEn,
  pickerCriticalEs,
  pickerCriticalJa,
  pickerCriticalKo,
  pickerCriticalZhCN,
} from "../src/i18nPickerCriticalMessages.ts";
import {
  insightCriticalEn,
  insightCriticalEs,
  insightCriticalJa,
  insightCriticalKo,
  insightCriticalZhCN,
} from "../src/i18nInsightCriticalMessages.ts";
import {
  chromeCriticalEn,
  chromeCriticalEs,
  chromeCriticalJa,
  chromeCriticalKo,
  chromeCriticalZhCN,
} from "../src/i18nChromeCriticalMessages.ts";
import {
  qaCriticalEn,
  qaCriticalEs,
  qaCriticalJa,
  qaCriticalKo,
  qaCriticalZhCN,
} from "../src/i18nQaCriticalMessages.ts";

type Catalog = Record<string, string>;

const catalogs: Array<{ name: string; en: Catalog; locales: Record<string, Catalog> }> = [
  { name: "Family", en: familyCriticalEn, locales: { ko: familyCriticalKo, ja: familyCriticalJa, es: familyCriticalEs, "zh-CN": familyCriticalZhCN } },
  { name: "Memory", en: memoryCriticalEn, locales: { ko: memoryCriticalKo, ja: memoryCriticalJa, es: memoryCriticalEs, "zh-CN": memoryCriticalZhCN } },
  { name: "Sticker", en: stickerCriticalEn, locales: { ko: stickerCriticalKo, ja: stickerCriticalJa, es: stickerCriticalEs, "zh-CN": stickerCriticalZhCN } },
  { name: "Notice", en: noticeCriticalEn, locales: { ko: noticeCriticalKo, ja: noticeCriticalJa, es: noticeCriticalEs, "zh-CN": noticeCriticalZhCN } },
  { name: "Picker", en: pickerCriticalEn, locales: { ko: pickerCriticalKo, ja: pickerCriticalJa, es: pickerCriticalEs, "zh-CN": pickerCriticalZhCN } },
  { name: "Insight", en: insightCriticalEn, locales: { ko: insightCriticalKo, ja: insightCriticalJa, es: insightCriticalEs, "zh-CN": insightCriticalZhCN } },
  { name: "Chrome", en: chromeCriticalEn, locales: { ko: chromeCriticalKo, ja: chromeCriticalJa, es: chromeCriticalEs, "zh-CN": chromeCriticalZhCN } },
  { name: "QA", en: qaCriticalEn, locales: { ko: qaCriticalKo, ja: qaCriticalJa, es: qaCriticalEs, "zh-CN": qaCriticalZhCN } },
];

const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort().join(",");

for (const catalog of catalogs) {
  const keys = Object.keys(catalog.en);
  for (const [locale, messages] of Object.entries(catalog.locales)) {
    if (Object.keys(messages).length !== keys.length) throw new Error(`${catalog.name} ${locale}: key parity failed`);
    for (const key of keys) {
      const value = messages[key];
      if (!value?.trim()) throw new Error(`${catalog.name} ${locale}: empty ${key}`);
      if (placeholders(value) !== placeholders(catalog.en[key])) {
        throw new Error(`${catalog.name} ${locale}: placeholder mismatch ${key}`);
      }
      if (locale !== "ko" && /[가-힣]/.test(value)) throw new Error(`${catalog.name} ${locale}: Korean leakage ${key}`);
      if (locale !== "ko" && value === catalog.en[key]) {
        throw new Error(`${catalog.name} ${locale}: English fallback ${key}`);
      }
    }
  }
  console.log(`PASS ${catalog.name} key parity, placeholders, Korean leakage, and English fallback (${keys.length} keys × 5 locales)`);
}
