import { formatLogMeta } from "../constants/babyLogCategories";
import type { Locale } from "../i18n";
import type { BabyLogEntry, DiaryEntry } from "../types/babyLog";
import type { CareSetup, DefaultFeedingMethod } from "../types/careSetup";
import { buildBabyDisplay, buildProfileContextBlock } from "./childDisplay";

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

export function buildBabyLogConsultPrompt(input: {
  careSetup: CareSetup;
  logs: BabyLogEntry[];
  diaryEntries: DiaryEntry[];
  feedCount: number;
  diaperCount: number;
  sleepMinutes: number;
  locale: Locale;
}): string {
  const isKo = input.locale === "ko";
  const langInstruction = isKo
    ? "Always respond in Korean (한국어로만 답변하세요)."
    : "Always respond in English.";

  const display = buildBabyDisplay(input.careSetup.child, input.locale);
  const profileBlock = buildProfileContextBlock(
    input.careSetup.parent,
    input.careSetup.child,
    input.locale,
  );

  const sleepStr =
    input.sleepMinutes > 0
      ? isKo
        ? `${Math.floor(input.sleepMinutes / 60)}시간 ${input.sleepMinutes % 60}분`
        : `${Math.floor(input.sleepMinutes / 60)}h ${input.sleepMinutes % 60}m`
      : isKo
        ? "기록 없음"
        : "no data";

  const logLines = input.logs
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((entry) => {
      const meta = formatLogMeta(entry);
      return `  - ${entry.time} · ${meta}${entry.voice ? " (voice)" : ""}`;
    })
    .join("\n");

  const diaryLines = input.diaryEntries
    .slice(0, 3)
    .map((d) => `  - ${d.date}: ${d.comment}`)
    .join("\n");

  const base = `You are Darin AI, a friendly childcare advisor in the Darin CareLog app.
You help parents understand their baby's daily care logs and give practical, reassuring advice.
Keep responses concise (2-4 sentences). ${langInstruction}
Do not invent medical diagnoses. Distinguish profile/setup context from today's actual care events.`;

  const prefsBlock = isKo
    ? `\n[돌봄 선호 — 프로필 설정]
기본 수유 방식: ${feedingMethodLabel(input.careSetup.preferences.defaultFeedingMethod, "ko")}`
    : `\n[CARE PREFERENCES — profile setup]
Default feeding method: ${feedingMethodLabel(input.careSetup.preferences.defaultFeedingMethod, "en")}`;

  const todayBlock = isKo
    ? `\n[오늘의 실제 기록 요약]
- 수유/식사: ${input.feedCount}회
- 기저귀: ${input.diaperCount}회
- 수면: ${sleepStr}`
    : `\n[TODAY'S ACTUAL CARE EVENTS SUMMARY]
- Feeds/meals: ${input.feedCount}
- Diapers: ${input.diaperCount}
- Sleep: ${sleepStr}`;

  const logsBlock = logLines
    ? isKo
      ? `\n오늘의 상세 기록 (시간순, 실제 이벤트):\n${logLines}`
      : `\nToday's detailed log (chronological, actual events):\n${logLines}`
    : isKo
      ? "\n오늘의 상세 기록이 아직 없습니다."
      : "\nNo detailed logs recorded today yet.";

  const diaryBlock = diaryLines
    ? isKo
      ? `\n최근 일기 메모:\n${diaryLines}`
      : `\nRecent diary notes:\n${diaryLines}`
    : "";

  return `${base}\n\n${profileBlock}\nBaby display: ${display.babyName} · ${display.babyBirthMeta}${prefsBlock}${todayBlock}${logsBlock}${diaryBlock}`;
}
