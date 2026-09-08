import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AI_PRODUCT_POLICY_VERSION,
  aiProductPolicyPrompt,
  hasExactMetricComparison,
  hasOnlyExpectedMetricUnit,
  hasOnlyGroundedNumbers,
  isAiProductOutputSafe,
  makesAbsoluteAbsenceClaim,
  preservesFactNumbers,
  requestsClinicalJudgment,
} from "../src/utils/aiProductPolicy.ts";
import {
  consultCriticalEn,
  consultCriticalEs,
  consultCriticalJa,
  consultCriticalKo,
  consultCriticalZhCN,
} from "../src/i18nConsultCriticalMessages.ts";

assert.equal(AI_PRODUCT_POLICY_VERSION, 1);
assert.match(aiProductPolicyPrompt("summarize_records"), /untrusted data/i);
assert.match(aiProductPolicyPrompt("weekly_narrative"), /same metric/i);
assert.match(aiProductPolicyPrompt("rewrite_insight"), /association-only/i);

for (const question of [
  "이 정도 수유량이면 부족한가요?",
  "Should we go to the hospital?",
  "これは正常ですか？",
  "¿Es una emergencia?",
  "这个情况正常吗？",
]) {
  assert.equal(requestsClinicalJudgment(question), true, `clinical request was not blocked: ${question}`);
}
for (const question of [
  "오늘 수유 기록을 요약해줘",
  "Show the doctor visit recorded yesterday",
  "今日の体温記録を見せて",
  "Resume los registros de sueño",
  "显示今天记录的体温",
]) {
  assert.equal(requestsClinicalJudgment(question), false, `factual record request was blocked: ${question}`);
}

for (const unsafe of [
  "수유량이 부족하니 병원에 가세요.",
  "This is normal and you should wait.",
  "正常なので受診は不要です。",
  "Es normal porque durmió más.",
  "这是正常的，因为睡得更多。",
]) {
  assert.equal(isAiProductOutputSafe(unsafe), false, `unsafe output was accepted: ${unsafe}`);
}
assert.equal(isAiProductOutputSafe("기록된 수유는 오전 8시와 오후 1시에 있어요."), true);

const evidence = JSON.stringify({ times: ["08:00", "13:00"], amountMl: 120, days: 7 });
assert.equal(hasOnlyGroundedNumbers("08:00과 13:00에 각각 120ml가 기록됐어요.", evidence), true);
assert.equal(hasOnlyGroundedNumbers("08:00과 14:00에 기록됐어요.", evidence), false, "invented time passed");

const pairs = [
  { previous: 100, current: 120 },
  { previous: 4, current: 6 },
];
assert.equal(hasExactMetricComparison("100분 → 120분으로 바뀌었어요.", pairs), true);
assert.equal(hasExactMetricComparison("100분 → 6회로 바뀌었어요.", pairs), false, "cross-metric pair passed");
assert.equal(hasExactMetricComparison("최소 90분에서 100분 → 120분", pairs), false, "extra fact passed");
assert.equal(hasOnlyExpectedMetricUnit("100분 → 120분으로 바뀌었어요.", "분"), true);
assert.equal(hasOnlyExpectedMetricUnit("It changed from 100 minutes → 120 minutes.", "분"), true);
assert.equal(hasOnlyExpectedMetricUnit("Cambió de 100 → 120 minutos.", "분"), true);
assert.equal(hasOnlyExpectedMetricUnit("100회 → 120회로 바뀌었어요.", "분"), false, "wrong unit passed");
assert.equal(hasOnlyExpectedMetricUnit("100분 → 120ml로 바뀌었어요.", "분"), false, "mixed units passed");

assert.equal(preservesFactNumbers("30분 차이가 있었어요.", "30분 차이", "9일"), true);
assert.equal(preservesFactNumbers("9일 동안 30분 차이가 있었어요.", "30분 차이", "9일"), true);
assert.equal(preservesFactNumbers("31분 차이가 있었어요.", "30분 차이", "9일"), false);
assert.equal(preservesFactNumbers("30분, 30분 차이가 있었어요.", "30분 차이", "9일"), false);
assert.equal(preservesFactNumbers("차이가 있었어요.", "30분 차이", "9일"), false);

assert.equal(makesAbsoluteAbsenceClaim("수유 기록이 없어요."), true);
assert.equal(makesAbsoluteAbsenceClaim("No feeding logs were recorded."), true);
assert.equal(makesAbsoluteAbsenceClaim("불러온 기록만으로는 요약 범위가 제한돼요."), false);

const localized = [
  consultCriticalKo,
  consultCriticalEn,
  consultCriticalJa,
  consultCriticalEs,
  consultCriticalZhCN,
];
for (const messages of localized) {
  assert.ok(messages["consult.critical.082"].trim(), "clinical boundary copy is missing");
  assert.ok(messages["consult.critical.083"].trim(), "rejected-output fallback is missing");
}

const source = (path: string) => fs.readFileSync(path, "utf8");
const consultScreen = source("src/screens/tabs/ConsultScreen.tsx");
const consultContext = source("src/utils/babyLogAIContext.ts");
const narrative = source("src/utils/weeklyNarrativePrompt.ts");
const insight = source("src/utils/insightPhrasePrompt.ts");
const repository = source("src/repositories/CareLogRepository.ts");
const chatStore = source("src/utils/chatHistoryStore.ts");
const chatDefaults = source("src/constants/chatDefaults.ts");

assert.doesNotMatch(consultContext, /childcare advisor|advise pediatric|고열, 호흡곤란/i);
assert.match(consultContext, /aiProductPolicyPrompt\("summarize_records"\)/);
assert.match(consultContext, /consultEvidenceLogs\(input\.logs\)/, "AI-derived memos are not filtered");
assert.match(consultScreen, /requestsClinicalJudgment\(trimmed\)/, "clinical requests are not preflighted");
assert.match(consultScreen, /callOpenAI\(\[\{ role: "user", content: trimmed \}\], prompt\)/, "old AI replies may re-enter the request");
assert.doesNotMatch(consultScreen, /historyRef/, "previous AI output is still being sent as history");
assert.match(consultScreen, /validateConsultReply\(\{/);
assert.match(consultScreen, /\? reply : t\("consult\.critical\.083"\)/, "invalid output is not replaced safely");
assert.match(consultScreen, /\[activeBabyId, locale\]/, "late response scope omits locale");
assert.match(
  consultScreen,
  /try \{\s+const recentHistory = await ensureCareLogsForRange/,
  "record prefetch failure can leave the request locked",
);
assert.match(
  consultScreen,
  /catch \{\s+if \(requestScopeRun !== babyScopeRunRef\.current\) return;/,
  "an old scope failure can leak into the current screen",
);
assert.match(consultScreen, /aiProvenance: memoSeed\.trim\(\)/);
assert.match(repository, /aiProvenance: entry\.aiProvenance/);
assert.match(chatStore, /message\.aiPolicyVersion !== AI_PRODUCT_POLICY_VERSION/);
assert.match(chatDefaults, /aiPolicyVersion: AI_PRODUCT_POLICY_VERSION/);
assert.match(narrative, /NARRATIVE_VERSION = 6/);
assert.match(narrative, /hasExactMetricComparison/);
assert.match(narrative, /\^metric:\(\[A-Za-z\]/, "weekly narrative does not require a metric id");
assert.match(insight, /INSIGHT_PHRASE_VERSION = 4/);
assert.match(insight, /preservesFactNumbers/);

console.log("PASS B0.3 AI product policy, grounding, medical boundary, provenance, and five-locale fallback checks");
