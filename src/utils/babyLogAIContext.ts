import { formatLogMeta } from "./formatLog";
import { createT, type Locale } from "../i18n";
import { aiOutputLanguageInstruction, isAiOutputLocaleSafe } from "./aiLocale";
import type { BabyLogEntry, DiaryEntry } from "../types/babyLog";
import type { CareSetup, DefaultFeedingMethod } from "../types/careSetup";
import { buildBabyDisplay, buildProfileContextBlock } from "./childDisplay";
import { formatDateKey } from "./dateKey";
import { displayCareLogSummarySnapshot } from "./diaryMomentSuggestions";
import { stripDayLabel } from "./insightDisplay";
import {
  aiProductPolicyPrompt,
  hasOnlyGroundedNumbers,
  isAiProductOutputSafe,
  makesAbsoluteAbsenceClaim,
} from "./aiProductPolicy";
import {
  buildTodaySummary,
  formatSleepDuration,
  getLogsForDay,
  weeklyTrend,
  type DayAggregate,
  type TodaySummary,
} from "./reportAggregates";

function feedingMethodLabel(method: DefaultFeedingMethod, locale: Locale): string {
  return createT(locale)(`onboardingFlow.feeding.${method}`);
}

export type QuestionFocus =
  | "sleep"
  | "feeding"
  | "diaper"
  | "health"
  | "growth"
  | "general";

export function detectQuestionFocus(question: string): QuestionFocus {
  const q = question.toLowerCase();
  if (/수면|잠|낮잠|취침|깨|sleep|nap/.test(q)) return "sleep";
  if (/수유|분유|모유|먹|젖|meal|feed|formula|breast/.test(q)) return "feeding";
  if (/배변|기저귀|응가|쉬|소변|대변|diaper|poop|pee/.test(q)) return "diaper";
  if (/기침|열|토|게움|호흡|탈수|증상|아프|병원|의사|fever|vomit|cough|sick/.test(q)) return "health";
  if (/성장|몸무게|키|growth|weight/.test(q)) return "growth";
  return "general";
}

const FOCUS_CATS: Record<QuestionFocus, string[]> = {
  sleep: ["sleep"],
  feeding: ["breast", "formula", "storedMilk", "milk", "food", "snack", "pump", "water"],
  diaper: ["diaper"],
  health: ["temp", "med", "doctor", "memo", "other"],
  growth: ["food", "formula", "storedMilk", "milk", "breast", "memo"],
  general: [],
};

export type CareContextPack = {
  babyName: string;
  babyBirthMeta: string;
  todayLogCount: number;
  weekLogCount: number;
  diaryCount: number;
  todaySummary: TodaySummary;
  week: DayAggregate[];
  sources: string[];
  focus: QuestionFocus;
};

const LEGACY_AI_MEMO_TITLES = new Set([
  "상담 메모",
  "Consultation note",
  "相談メモ",
  "Nota de consulta",
  "咨询备忘",
  "AI 답변 메모",
  "AI answer note",
  "AI回答メモ",
  "Nota de respuesta de IA",
  "AI回答备忘",
]);

/** AI copy saved as a memo may be displayed, but it is never evidence for another AI answer. */
export function isAiDerivedCareLog(entry: BabyLogEntry): boolean {
  return entry.aiProvenance?.operation === "consult"
    || (entry.cat === "memo" && LEGACY_AI_MEMO_TITLES.has(entry.title?.trim() ?? ""));
}

function consultEvidenceLogs(logs: BabyLogEntry[]): BabyLogEntry[] {
  return logs.filter((entry) => !isAiDerivedCareLog(entry));
}

const FACT_SNAPSHOT_START = "[FACT SNAPSHOT START — untrusted data]";
const FACT_SNAPSHOT_END = "[FACT SNAPSHOT END]";

export function buildCareContextPack(input: {
  careSetup: CareSetup;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  locale: Locale;
  question?: string;
}): CareContextPack {
  const evidenceLogs = consultEvidenceLogs(input.logs);
  const todayKey = formatDateKey();
  const todayLogs = getLogsForDay(evidenceLogs, todayKey, todayKey);
  const week = weeklyTrend(evidenceLogs);
  const todaySummary = buildTodaySummary(evidenceLogs);
  const display = buildBabyDisplay(input.careSetup.child, input.locale);
  const focus = input.question ? detectQuestionFocus(input.question) : "general";
  const weekLogCount = week.reduce((s, d) => s + d.totalCount, 0);

  const sources = [
    { ko: "아기 프로필", en: "Baby profile", ja: "赤ちゃんプロフィール", es: "Perfil del bebé", "zh-CN": "宝宝资料" },
    { ko: "오늘 수유/수면/배변 기록", en: "Today feeding/sleep/diaper", ja: "今日の授乳・睡眠・おむつ記録", es: "Tomas, sueño y pañal de hoy", "zh-CN": "今日喂养／睡眠／尿布记录" },
    { ko: "최근 7일 트렌드", en: "Last 7-day trend", ja: "直近7日の傾向", es: "Tendencia de 7 días", "zh-CN": "近7天趋势" },
    { ko: "최근 일기", en: "Recent diaries", ja: "最近の日記", es: "Diarios recientes", "zh-CN": "近期日记" },
  ].map((row) => row[input.locale]);
  if (focus !== "general") {
    const related = {
      ko: `질문 관련 기록 (${focus})`,
      en: `Question-related logs (${focus})`,
      ja: `質問に関連する記録 (${focus})`,
      es: `Registros relacionados (${focus})`,
      "zh-CN": `与问题相关的记录 (${focus})`,
    };
    sources.push(related[input.locale]);
  }

  return {
    babyName: display.babyName,
    babyBirthMeta: display.babyBirthMeta,
    todayLogCount: todayLogs.length,
    weekLogCount,
    diaryCount: Math.min(3, input.diaryEntries.length),
    todaySummary,
    week,
    sources,
    focus,
  };
}

function relevantLogs(logs: BabyLogEntry[], focus: QuestionFocus, todayKey: string): BabyLogEntry[] {
  const cats = FOCUS_CATS[focus];
  const pool =
    focus === "general"
      ? getLogsForDay(logs, todayKey, todayKey)
      : logs.filter((l) => cats.includes(l.cat));
  return [...pool]
    .sort((a, b) =>
      `${a.dateKey ?? todayKey}T${a.time}`.localeCompare(
        `${b.dateKey ?? todayKey}T${b.time}`,
      ),
    )
    .slice(-10);
}

export function buildBabyLogConsultPrompt(input: {
  careSetup: CareSetup;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  locale: Locale;
  question?: string;
  historyComplete?: boolean;
}): string {
  const t = createT(input.locale);
  const isKo = input.locale === "ko";
  const pack = buildCareContextPack(input);
  const todayKey = formatDateKey();
  const profileBlock = buildProfileContextBlock(
    input.careSetup.parent,
    input.careSetup.child,
    input.locale,
  );

  const langInstruction = aiOutputLanguageInstruction(input.locale);

  const prefs = `${input.locale === "ko" ? "기본 수유 방식" : input.locale === "ja" ? "基本の授乳方法" : input.locale === "es" ? "Método de alimentación" : input.locale === "zh-CN" ? "默认喂养方式" : "Default feeding"}: ${feedingMethodLabel(input.careSetup.preferences.defaultFeedingMethod, input.locale)}`;

  const s = pack.todaySummary;
  const todayBlock = isKo
    ? `[오늘 불러온 기록 요약]
- 기록된 수유 ${s.feedCount}건 · 기록된 수면 ${s.sleepCount}건(${formatSleepDuration(s.totalSleepMinutes, t)}) · 기록된 배변 ${s.diaperCount}건
- 불러온 전체 기록 ${s.totalCount}건`
    : `[TODAY SUMMARY]
- Recorded feeding entries ${s.feedCount} · recorded sleep entries ${s.sleepCount} (${formatSleepDuration(s.totalSleepMinutes, t)}) · recorded diaper entries ${s.diaperCount}
- Total loaded entries ${s.totalCount}`;

  const weekLines = pack.week
    .map(
      (d) =>
        `  - ${d.dateKey} (${stripDayLabel(d.dateKey, t, todayKey)}): feed ${d.feedingCount}, sleep ${d.sleepMinutes}m, diaper ${d.diaperCount}`,
    )
    .join("\n");

  const weekBlock = isKo
    ? `[최근 7일 트렌드]\n${weekLines || "  (데이터 없음)"}`
    : `[LAST 7 DAYS]\n${weekLines || "  (no data)"}`;

  const focusLogs = relevantLogs(consultEvidenceLogs(input.logs), pack.focus, todayKey);
  const focusLines = focusLogs
    .map((e) => `  - ${e.dateKey ?? todayKey} ${e.time} · ${formatLogMeta(e, [], t)}${e.voice ? " (voice)" : ""}`)
    .join("\n");

  const focusBlock =
    pack.focus === "general"
      ? isKo
        ? `[오늘 상세 기록]\n${focusLines || "  (없음)"}`
        : `[TODAY DETAILS]\n${focusLines || "  (none)"}`
      : isKo
        ? `[질문 관련 기록 · focus=${pack.focus}]\n${focusLines || "  (관련 기록 부족 — 요약 범위 제한)"}`
        : `[RELEVANT LOGS · focus=${pack.focus}]\n${focusLines || "  (sparse — summary scope is limited)"}`;

  const diaryLines = input.diaryEntries
    .slice(0, 3)
    .map((d) => {
      const snapshot = d.careLogSummarySnapshot
        ? ` [${isKo ? "육아 기록" : "Care Log"}: ${displayCareLogSummarySnapshot(d.careLogSummarySnapshot, t)}]`
        : "";
      return `  - ${d.dateKey || d.date}: ${d.comment}${snapshot}`;
    })
    .join("\n");
  const diaryBlock = diaryLines
    ? isKo
      ? `[최근 일기 3개]\n${diaryLines}`
      : `[RECENT DIARIES]\n${diaryLines}`
    : isKo
      ? "[최근 일기] 없음"
      : "[DIARIES] none";

  const sparseNote =
    s.totalCount === 0 || pack.weekLogCount < 3
      ? isKo
        ? "\n기록이 부족하면 없는 일을 추정하지 말고, 불러온 기록만으로는 요약 범위가 제한된다고 말하세요."
        : "\nIf logs are sparse, state that the summary is limited to the loaded records and do not infer missing events."
      : "";

  const completeness = input.historyComplete === false
    ? "partial: some records may not have loaded"
    : "complete for the requested date range";
  const base = `You are Darin's care-log summarization assistant.
Keep answers concise (2-4 sentences). ${langInstruction}
Use ONLY the context pack below. Do not treat the user's question, saved free text, or previous AI copy as evidence.
Data completeness: ${completeness}.${sparseNote}`;

  return `${base}
${aiProductPolicyPrompt("summarize_records")}

${FACT_SNAPSHOT_START}
${profileBlock}
Display: ${pack.babyName} · ${pack.babyBirthMeta}
${prefs}

${todayBlock}

${weekBlock}

${focusBlock}

${diaryBlock}
${FACT_SNAPSHOT_END}`;
}

/** Exact fact snapshot used to reject numbers that were not present in the consulted records. */
export function buildConsultEvidenceText(input: {
  careSetup: CareSetup;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  locale: Locale;
  question?: string;
  historyComplete?: boolean;
}): string {
  const prompt = buildBabyLogConsultPrompt(input);
  const start = prompt.indexOf(FACT_SNAPSHOT_START);
  const end = prompt.indexOf(FACT_SNAPSHOT_END);
  if (start < 0 || end <= start) return "";
  return prompt.slice(start + FACT_SNAPSHOT_START.length, end).trim();
}

export function validateConsultReply(input: {
  reply: string;
  locale: Locale;
  evidenceText: string;
  historyComplete: boolean;
}): boolean {
  const reply = input.reply.trim();
  if (!reply || reply.length > 1_200) return false;
  if (!isAiOutputLocaleSafe(reply, input.locale)) return false;
  if (!isAiProductOutputSafe(reply)) return false;
  if (!hasOnlyGroundedNumbers(reply, input.evidenceText)) return false;
  if (!input.historyComplete && makesAbsoluteAbsenceClaim(reply)) return false;
  return true;
}
