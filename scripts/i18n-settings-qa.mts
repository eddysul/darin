import {
  settingsCriticalEn,
  settingsCriticalEs,
  settingsCriticalJa,
  settingsCriticalKo,
  settingsCriticalZhCN,
} from "../src/i18nSettingsCriticalMessages.ts";

const locales = { ko: settingsCriticalKo, ja: settingsCriticalJa, es: settingsCriticalEs, "zh-CN": settingsCriticalZhCN };
const keys = Object.keys(settingsCriticalEn) as Array<keyof typeof settingsCriticalEn>;
const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort().join(",");
const exactFallbackAllowed = new Set(["Darin ID", "Google", "Apple", "JSON", "ml", "oz", "kg/cm", "lb/in", "℃", "℉", "D+", "Beta", "Soft delete"]);

for (const [locale, messages] of Object.entries(locales)) {
  if (Object.keys(messages).length !== keys.length) throw new Error(`${locale}: key parity failed`);
  for (const key of keys) {
    const value = messages[key];
    if (!value?.trim()) throw new Error(`${locale}: empty ${key}`);
    if (placeholders(value) !== placeholders(settingsCriticalEn[key])) throw new Error(`${locale}: placeholder mismatch ${key}`);
    if (locale !== "ko" && /[가-힣]/.test(value)) throw new Error(`${locale}: Korean leakage ${key}`);
    if (locale !== "ko" && value === settingsCriticalEn[key] && !exactFallbackAllowed.has(value)) throw new Error(`${locale}: English fallback ${key} (${value})`);
  }
}

console.log(`PASS Settings key parity, placeholders, Korean leakage, and English fallback (${keys.length} keys × 5 locales)`);
