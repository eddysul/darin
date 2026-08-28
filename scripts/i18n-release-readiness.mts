import assert from "node:assert/strict";
import fs from "node:fs";
import { createT, type Locale } from "../src/i18n.ts";
import { isAiOutputLocaleSafe } from "../src/utils/aiLocale.ts";
import { storedRecordValueLabel } from "../src/utils/recordDisplay.ts";
import { buildVoiceSession } from "../src/utils/voiceToBabyLog.ts";
import {
  describeTable,
  narrativeSystemPrompt,
  validateNarrative,
} from "../src/utils/weeklyNarrativePrompt.ts";
import type { WeeklyFeatureTable } from "../src/utils/weeklyFeatureTable.ts";

const locales: Locale[] = ["ko", "en", "ja", "es", "zh-CN"];
const table: WeeklyFeatureTable = {
  meta: {
    periodLabel: "8월 18일~8월 23일",
    weekLabel: "8월 4주차",
    dateKeys: ["2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"],
    ageMonths: 4,
    recordedDays: 6,
    hasPreviousWeek: true,
  },
  metrics: [{
    key: "nightSleepMinutes",
    label: "밤잠",
    unit: "분",
    thisWeek: { avg: 120, min: 100, max: 140, days: 6 },
    lastWeek: { avg: 100, min: 90, max: 110, days: 6 },
    changeRatio: 0.2,
    daily: [100, 110, 120, 120, 130, 140],
  }],
  correlations: [],
};

const valid: Record<Locale, string> = {
  ko: "밤잠이 길어졌어요\n\n100분 → 120분으로 늘었어요.",
  en: "Night sleep became longer\n\nIt changed from 100 minutes → 120 minutes.",
  ja: "夜の睡眠が長くなりました\n\n100分 → 120分に変わりました。",
  es: "El sueño nocturno fue más largo\n\nCambió de 100 minutos → 120 minutos.",
  "zh-CN": "夜间睡眠时间变长了\n\n从100分钟 → 120分钟。",
};
const unsafe: Record<Locale, string> = {
  ko: "밤잠을 늘려보세요",
  en: "You should increase sleep",
  ja: "睡眠を増やしてください",
  es: "Deberías aumentar el sueño",
  "zh-CN": "应该增加睡眠",
};

for (const locale of locales) {
  assert.ok(narrativeSystemPrompt(locale).includes("Write only"), `${locale}: target-language instruction missing`);
  assert.ok(isAiOutputLocaleSafe(valid[locale], locale), `${locale}: valid native-language copy rejected`);
  assert.ok(validateNarrative(valid[locale], table, locale), `${locale}: valid narrative rejected`);
  assert.equal(isAiOutputLocaleSafe(unsafe[locale], locale), false, `${locale}: advice language accepted`);
  assert.equal(validateNarrative(`${valid[locale]}\nExtra line`, table, locale), false, `${locale}: extra output accepted`);
}
assert.doesNotMatch(describeTable(table), /[가-힣]/, "AI table serialization leaks Korean labels into non-Korean prompts");

for (const locale of locales.filter((value) => value !== "ko")) {
  const t = createT(locale);
  for (const value of ["대변", "묽음", "노란색", "좌측", "복용 완료"]) {
    assert.doesNotMatch(storedRecordValueLabel(t, value), /[가-힣]/, `${locale}: legacy value leaked: ${value}`);
  }
}

const voice = buildVoiceSession("어제 오후 2시에 응가했어 노란색 묽음");
const diaper = voice.events.find((event) => event.cat === "diaper");
assert.equal(diaper?.stoolState, "묽음", "voice stool consistency must use a structured field");
assert.doesNotMatch(diaper?.notes ?? "", /원문 시점|상태:/, "voice parser exposed generated Korean notes");

const source = (path: string) => fs.readFileSync(path, "utf8");
const languageProvider = source("src/LanguageContext.tsx");
const pushWorker = source("supabase/functions/send-push-notification/index.ts");
const reminderWorker = source("supabase/functions/process-care-reminders/index.ts");
const insightPrompt = source("src/utils/insightPhrasePrompt.ts");
assert.match(languageProvider, /syncPreferredLanguage\(resolved\)/, "display locale is not synced for server push copy");
assert.match(pushWorker, /profiles["']\)\.select\(["']preferred_language["']\)/, "push worker does not read recipient locale");
assert.match(reminderWorker, /profiles["']\)\.select\(["']preferred_language["']\)/, "care reminder worker does not read recipient locale");
assert.doesNotMatch(insightPrompt, /`(?:관계|우리 문장|기준|결과|차이|관측)/, "insight prompt labels can bias non-Korean output");

const reportScreen = source("src/screens/tabs/BabyReportScreen.tsx");
assert.match(reportScreen, /useWindowDimensions/, "report screen does not adapt to small widths");
assert.doesNotMatch(reportScreen, /dialWrap:\s*\{\s*width:\s*316/, "report dial remains fixed-width");
for (const file of ["src/screens/onboarding/OnboardingShell.tsx", "src/components/settings/AppSettingsModal.tsx"]) {
  assert.match(source(file), /flexShrink:\s*1/, `${file}: translated action copy cannot shrink or wrap safely`);
}

const pdf = source("src/utils/growthBookPdf.ts");
const dataExport = source("src/repositories/DataExportRepository.ts");
assert.match(pdf, /t:\s*Translate;[\s\S]*locale:\s*Locale;/, "PDF locale inputs must be required");
assert.doesNotMatch(pdf, /dialogTitle:[^\n]*[가-힣]/, "PDF share dialog has hardcoded Korean copy");
assert.match(dataExport, /options:\s*\{\s*dialogTitle:\s*string\s*\}/, "JSON export dialog title is not localized by caller");
assert.doesNotMatch(dataExport, /dialogTitle:\s*["'][^"']*[가-힣]/, "JSON export dialog has hardcoded Korean copy");

console.log("PASS five-locale AI safety, recipient push locale sync, small-screen guards, legacy display mapping, voice parser boundary, and localized export/PDF contracts");
