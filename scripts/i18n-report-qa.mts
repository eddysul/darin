import { reportCriticalEn, reportCriticalEs, reportCriticalJa, reportCriticalKo, reportCriticalZhCN } from "../src/i18nReportCriticalMessages.ts";
const locales = { ko: reportCriticalKo, ja: reportCriticalJa, es: reportCriticalEs, "zh-CN": reportCriticalZhCN };
const keys = Object.keys(reportCriticalEn) as Array<keyof typeof reportCriticalEn>;
const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort().join(",");
for (const [locale, messages] of Object.entries(locales)) {
  if (Object.keys(messages).length !== keys.length) throw new Error(`${locale}: key parity failed`);
  for (const key of keys) {
    const value = messages[key];
    if (!value?.trim()) throw new Error(`${locale}: empty ${key}`);
    if (placeholders(value) !== placeholders(reportCriticalEn[key])) throw new Error(`${locale}: placeholder mismatch ${key}`);
    if (locale !== "ko" && /[가-힣]/.test(value)) throw new Error(`${locale}: Korean leakage ${key}`);
    if (locale !== "ko" && value === reportCriticalEn[key]) throw new Error(`${locale}: English fallback ${key}`);
  }
}
console.log(`PASS Report key parity, placeholders, Korean leakage, and English fallback (${keys.length} keys × 5 locales)`);
