import type { BabyLogEntry } from "../types/babyLog";
import type { TodaySummary } from "./reportAggregates";
import { formatSleepDuration } from "./reportAggregates";

export type MomentSuggestion = {
  id: string;
  /** Shown on the chip and appended into the comment field */
  text: string;
};

const ACTIVITY_LABELS: Partial<Record<string, string>> = {
  tummy: "터미타임",
  bath: "목욕",
  play: "놀이",
  doctor: "병원",
  med: "약",
  walk: "산책",
};

/**
 * Rule-based Daily Summary (frozen into careLogSummarySnapshot on save).
 *
 * Rules:
 * - Core counts: 수유(모유+분유+이유식+간식+유축 합산), 수면(총 분), 기저귀
 * - Extra activities: tummy / bath / play / doctor / med — up to 2 labels
 * - Empty day: fixed empty copy
 */
export function buildCareLogDailySummary(
  summary: TodaySummary,
  todayLogs: BabyLogEntry[] = [],
): string {
  if (summary.totalCount === 0) {
    return "오늘은 아직 Care Log 기록이 없어요. 수유·수면·기저귀를 남기면 여기에 요약돼요.";
  }

  const core = `오늘은 수유 ${summary.feedCount}회, 수면 ${formatSleepDuration(summary.totalSleepMinutes)}, 기저귀 ${summary.diaperCount}회가 기록되었어요.`;

  const seen = new Set<string>();
  const extras: string[] = [];
  for (const log of todayLogs) {
    const label = ACTIVITY_LABELS[log.cat];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    extras.push(label);
    if (extras.length >= 2) break;
  }

  if (extras.length === 0) return core;
  if (extras.length === 1) return `${core} 추가로 ${extras[0]}도 했어요.`;
  return `${core} 추가로 ${extras[0]}과 ${extras[1]}도 했어요.`;
}

/**
 * Rule-based Moment Suggestions (no LLM).
 * Always 3–4 question prompts; sleep-short / activity-aware when signals exist.
 */
export function buildDiaryMomentSuggestions(input: {
  babyName: string;
  todayLogs: BabyLogEntry[];
  summary: TodaySummary;
}): MomentSuggestion[] {
  const { babyName, todayLogs, summary } = input;
  const cats = new Set(todayLogs.map((l) => l.cat));
  const out: MomentSuggestion[] = [
    { id: "first-action", text: "오늘 처음 해본 행동이 있었나요?" },
    { id: "cute-face", text: `오늘 ${babyName}의 가장 귀여웠던 표정은 무엇이었나요?` },
  ];

  if (
    summary.flags.includes("sleep_less_than_yesterday") ||
    (summary.sleepCount > 0 && summary.totalSleepMinutes < 90)
  ) {
    out.push({
      id: "short-nap",
      text: "낮잠이 평소보다 짧았는데 특별한 이유가 있었나요?",
    });
  } else if (cats.has("bath")) {
    out.push({
      id: "bath",
      text: "목욕할 때 물을 좋아했나요, 아니면 조심스러웠나요?",
    });
  } else if (cats.has("tummy") || cats.has("play")) {
    out.push({
      id: "play",
      text: "놀이나 터미타임 중에 기억에 남는 장면이 있었나요?",
    });
  } else {
    out.push({
      id: "mood",
      text: "오늘 하루 컨디션은 어땠나요?",
    });
  }

  out.push({
    id: "growth-book",
    text: "오늘 성장책에 남기고 싶은 순간이 있었나요?",
  });

  return out.slice(0, 4);
}

/** Append a suggestion into the comment field (or set if empty). */
export function appendMomentSuggestion(current: string, suggestion: string): string {
  const t = current.trim();
  if (!t) return suggestion;
  if (t.includes(suggestion)) return current;
  return `${t}\n${suggestion}`;
}
