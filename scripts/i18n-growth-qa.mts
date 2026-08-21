import {
  growthCriticalEn,
  growthCriticalEs,
  growthCriticalJa,
  growthCriticalKo,
  growthCriticalZhCN,
} from "../src/i18nGrowthCriticalMessages.ts";

const locales = { ko: growthCriticalKo, ja: growthCriticalJa, es: growthCriticalEs, "zh-CN": growthCriticalZhCN };
const keys = Object.keys(growthCriticalEn) as Array<keyof typeof growthCriticalEn>;
const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort().join(",");

for (const [locale, messages] of Object.entries(locales)) {
  if (Object.keys(messages).length !== keys.length) throw new Error(`${locale}: key parity failed`);
  for (const key of keys) {
    const value = messages[key];
    if (!value?.trim()) throw new Error(`${locale}: empty ${key}`);
    if (placeholders(value) !== placeholders(growthCriticalEn[key])) throw new Error(`${locale}: placeholder mismatch ${key}`);
    if (locale !== "ko" && /[가-힣]/.test(value)) throw new Error(`${locale}: Korean leakage ${key}`);
    if (locale !== "ko" && value === growthCriticalEn[key]) throw new Error(`${locale}: English fallback ${key}`);
  }
}

console.log(`PASS Growth key parity, placeholders, Korean leakage, and English fallback (${keys.length} keys × 5 locales)`);
