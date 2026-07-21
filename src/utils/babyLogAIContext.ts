import { formatLogMeta } from "./formatLog";
import type { Locale } from "../i18n";
import type { BabyLogEntry, DiaryEntry } from "../types/babyLog";
import type { CareSetup, DefaultFeedingMethod } from "../types/careSetup";
import { buildBabyDisplay, buildProfileContextBlock } from "./childDisplay";
import { formatDateKey } from "./dateKey";
import {
  buildTodaySummary,
  formatSleepDuration,
  getLogsForDay,
  weeklyTrend,
  type DayAggregate,
  type TodaySummary,
} from "./reportAggregates";

function feedingMethodLabel(method: DefaultFeedingMethod, locale: Locale): string {
  const ko: Record<DefaultFeedingMethod, string> = {
    breastfeeding: "모유 수유",
    formula: "분유",
    mixed: "혼합 수유",
    pumped_milk: "유축 모유",
    not_sure: "미정",
  };
  const en: Record<DefaultFeedingMethod, string> = {
    breastfeeding: "Breastfeeding",
    formula: "Formula",
    mixed: "Mixed feeding",
    pumped_milk: "Pumped milk",
    not_sure: "Not sure yet",
  };
  return locale === "ko" ? ko[method] : en[method];
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

export function buildCareContextPack(input: {
  careSetup: CareSetup;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  locale: Locale;
  question?: string;
}): CareContextPack {
  const todayKey = formatDateKey();
  const todayLogs = getLogsForDay(input.logs, todayKey, todayKey);
  const week = weeklyTrend(input.logs);
  const todaySummary = buildTodaySummary(input.logs);
  const display = buildBabyDisplay(input.careSetup.child, input.locale);
  const focus = input.question ? detectQuestionFocus(input.question) : "general";
  const weekLogCount = week.reduce((s, d) => s + d.totalCount, 0);

  const sources = [
    input.locale === "ko" ? "아기 프로필" : "Baby profile",
    input.locale === "ko" ? "오늘 수유/수면/배변 기록" : "Today feeding/sleep/diaper",
    input.locale === "ko" ? "최근 7일 트렌드" : "Last 7-day trend",
    input.locale === "ko" ? "최근 일기" : "Recent diaries",
  ];
  if (focus !== "general") {
    sources.push(input.locale === "ko" ? `질문 관련 기록 (${focus})` : `Question-related logs (${focus})`);
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
}): string {
  const isKo = input.locale === "ko";
  const pack = buildCareContextPack(input);
  const todayKey = formatDateKey();
  const profileBlock = buildProfileContextBlock(
    input.careSetup.parent,
    input.careSetup.child,
    input.locale,
  );

  const safety = isKo
    ? `\n[의료 안전]
고열, 호흡곤란, 반복 구토, 탈수 의심, 처짐이 있으면 소아과나 응급 진료를 권하세요.
의학적 진단처럼 말하지 마세요. 기록에 근거해 답하고, 확실하지 않으면 모른다고 말하세요.
답변 끝에 짧게 "최근 기록 기준"임을 밝혀도 좋습니다.`
    : `\n[SAFETY]
If there are signs of high fever, breathing difficulty, repeated vomiting, dehydration, or lethargy, advise pediatric/ER care.
Do not make medical diagnoses. Ground answers in logged data; say when unsure.
You may note answers are based on recent logs.`;

  const langInstruction = isKo
    ? "Always respond in Korean (한국어로만 답변하세요)."
    : "Always respond in English.";

  const prefs = isKo
    ? `기본 수유 방식: ${feedingMethodLabel(input.careSetup.preferences.defaultFeedingMethod, "ko")}`
    : `Default feeding: ${feedingMethodLabel(input.careSetup.preferences.defaultFeedingMethod, "en")}`;

  const s = pack.todaySummary;
  const todayBlock = isKo
    ? `[오늘 요약 — 최근 기록 기준]
- 수유 ${s.feedCount}회 · 수면 ${s.sleepCount}회(${formatSleepDuration(s.totalSleepMinutes)}) · 배변 ${s.diaperCount}회
- 전체 기록 ${s.totalCount}건`
    : `[TODAY SUMMARY]
- Feed ${s.feedCount} · Sleep ${s.sleepCount} (${formatSleepDuration(s.totalSleepMinutes)}) · Diaper ${s.diaperCount}
- Total events ${s.totalCount}`;

  const weekLines = pack.week
    .map(
      (d) =>
        `  - ${d.dateKey} (${d.label}): feed ${d.feedingCount}, sleep ${d.sleepMinutes}m, diaper ${d.diaperCount}`,
    )
    .join("\n");

  const weekBlock = isKo
    ? `[최근 7일 트렌드]\n${weekLines || "  (데이터 없음)"}`
    : `[LAST 7 DAYS]\n${weekLines || "  (no data)"}`;

  const focusLogs = relevantLogs(input.logs, pack.focus, todayKey);
  const focusLines = focusLogs
    .map((e) => `  - ${e.dateKey ?? todayKey} ${e.time} · ${formatLogMeta(e)}${e.voice ? " (voice)" : ""}`)
    .join("\n");

  const focusBlock =
    pack.focus === "general"
      ? isKo
        ? `[오늘 상세 기록]\n${focusLines || "  (없음)"}`
        : `[TODAY DETAILS]\n${focusLines || "  (none)"}`
      : isKo
        ? `[질문 관련 기록 · focus=${pack.focus}]\n${focusLines || "  (관련 기록 부족 — 판단이 어려울 수 있음)"}`
        : `[RELEVANT LOGS · focus=${pack.focus}]\n${focusLines || "  (sparse — may be hard to judge)"}`;

  const diaryLines = input.diaryEntries
    .slice(0, 3)
    .map((d) => {
      const snapshot = d.careLogSummarySnapshot
        ? ` [${isKo ? "육아 기록" : "Care Log"}: ${d.careLogSummarySnapshot}]`
        : "";
      return `  - ${d.date}: ${d.comment}${snapshot}`;
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
        ? "\n기록이 부족하면 확정적으로 말하지 말고 '판단하기 어려워요'라고 하세요."
        : "\nIf logs are sparse, say it is hard to judge confidently."
      : "";

  const base = `You are Darin AI, a childcare advisor in Darin CareLog.
Keep answers concise (2-4 sentences). ${langInstruction}
Use ONLY the context pack below — do not invent events.${sparseNote}`;

  return `${base}
${safety}

${profileBlock}
Display: ${pack.babyName} · ${pack.babyBirthMeta}
${prefs}

${todayBlock}

${weekBlock}

${focusBlock}

${diaryBlock}`;
}
