import assert from "node:assert/strict";
import { DIARY_COVER_TEMPLATE_IDS } from "../src/constants/diaryCoverTemplates";
import { DIARY_PAGE_TEMPLATE_IDS } from "../src/constants/diaryPageTemplates";
import { DIARY_MOOD_OPTIONS, DIARY_SKY_OPTIONS } from "../src/constants/diaryCompose";
import { createT, type Locale, type MessageKey } from "../src/i18n";
import { coreMessages, onboardingMessages } from "../src/i18nCoreMessages";
import { formatDurationMinutes, formatLocalizedDate, formatLocalizedNumber } from "../src/utils/localeFormat";

const locales: Locale[] = ["ko", "en", "ja", "es", "zh-CN"];
const coverKeys = DIARY_COVER_TEMPLATE_IDS.map((id) => `diary.coverTemplate.${id}` as MessageKey);
const pageKeys = DIARY_PAGE_TEMPLATE_IDS.map((id) => `diary.pageTemplate.${id}` as MessageKey);
const weatherKeys = DIARY_SKY_OPTIONS.map(({ id }) => `diary.weather.${id}` as MessageKey);
const moodKeys = DIARY_MOOD_OPTIONS.map(({ id }) => `diary.mood.${id}` as MessageKey);
const requiredKeys: MessageKey[] = [
  "diary.compose.cover",
  "diary.compose.pageStyle",
  "diary.coverAdjust.title",
  ...coverKeys,
  ...pageKeys,
  ...weatherKeys,
  ...moodKeys,
];

const onboardingLocales = Object.keys(onboardingMessages) as Locale[];
const onboardingKeys = Object.keys(onboardingMessages.en).sort();

for (const locale of onboardingLocales) {
  const localeKeys = Object.keys(onboardingMessages[locale]).sort();
  assert.deepEqual(localeKeys, onboardingKeys, `${locale}: onboarding key set differs from English`);
  for (const key of onboardingKeys) {
    const value = onboardingMessages[locale][key as keyof typeof onboardingMessages.en];
    assert.equal(typeof value, "string", `${locale}: onboarding key falls back to English: ${key}`);
    assert.ok(value.trim().length > 0, `${locale}: empty onboarding translation: ${key}`);
  }
}

for (const locale of locales) {
  const t = createT(locale);
  for (const key of Object.keys(coreMessages.en) as MessageKey[]) {
    const value = t(key);
    assert.ok(value.trim().length > 0, `${locale}: missing ${key}`);
    assert.notEqual(value, key, `${locale}: leaked key ${key}`);
  }
  for (const key of requiredKeys) {
    const value = t(key);
    assert.ok(value.trim().length > 0, `${locale}: missing ${key}`);
    assert.notEqual(value, key, `${locale}: leaked key ${key}`);
  }
  assert.ok(t("diary.compose.photoCount", { count: 3 }).includes("3"), `${locale}: interpolation failed`);
  assert.ok(formatLocalizedDate("2026-08-21T00:00:00.000Z", locale).length > 0);
  assert.ok(formatLocalizedNumber(1234.5, locale).length > 0);
  assert.ok(formatDurationMinutes(125, locale).length > 0);
}

assert.equal(new Set(DIARY_COVER_TEMPLATE_IDS).size, 10);
assert.equal(new Set(DIARY_PAGE_TEMPLATE_IDS).size, 10);
console.log("PASS onboarding locale key parity, explicit translations, and no missing-key fallback");
console.log("PASS i18n locale list, diary template parity, interpolation, and locale formatters");

const sampleKeys = [
  "onboardingFlow.stage.unbornTitle",
  "onboardingFlow.stage.bornTitle",
  "onboardingFlow.baby.prenatalName",
  "onboardingFlow.baby.dueDate",
  "onboardingFlow.complete.start",
] as const;
for (const locale of onboardingLocales) {
  const samples = sampleKeys.map((key) => `${key}=${onboardingMessages[locale][key]}`).join(" | ");
  console.log(`SAMPLE ${locale}: ${samples}`);
}
