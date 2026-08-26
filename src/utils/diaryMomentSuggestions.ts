import type { BabyLogEntry } from "../types/babyLog";
import type { MessageKey } from "../i18n";
import type { TodaySummary } from "./reportAggregates";
import { formatSleepDuration } from "./reportAggregates";
import type { Translate } from "./recordDisplay";

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

const ACTIVITY_KEYS: Partial<Record<string, MessageKey>> = {
  tummy: "diary.suggestion.activity.tummy",
  bath: "diary.suggestion.activity.bath",
  play: "diary.suggestion.activity.play",
  doctor: "diary.suggestion.activity.doctor",
  med: "diary.suggestion.activity.med",
  walk: "diary.suggestion.activity.walk",
};

function activityLabel(cat: string, t?: Translate): string | undefined {
  const key = ACTIVITY_KEYS[cat];
  if (!key) return undefined;
  return t ? t(key) : ACTIVITY_LABELS[cat];
}

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
  t?: Translate,
): string {
  if (summary.totalCount === 0) {
    return t
      ? t("diary.suggestion.empty")
      : "오늘은 아직 Care Log 기록이 없어요. 수유·수면·기저귀를 남기면 여기에 요약돼요.";
  }

  const sleep = formatSleepDuration(summary.totalSleepMinutes, t);
  const core = t
    ? t("diary.suggestion.core", {
        feeds: summary.feedCount,
        sleep,
        diapers: summary.diaperCount,
      })
    : `오늘은 수유 ${summary.feedCount}회, 수면 ${sleep}, 기저귀 ${summary.diaperCount}회가 기록되었어요.`;

  const seen = new Set<string>();
  const extras: string[] = [];
  for (const log of todayLogs) {
    const label = activityLabel(log.cat, t);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    extras.push(label);
    if (extras.length >= 2) break;
  }

  if (extras.length === 0) return core;
  if (extras.length === 1) {
    return t
      ? t("diary.suggestion.extraOne", { core, activity: extras[0] })
      : `${core} 추가로 ${extras[0]}도 했어요.`;
  }
  return t
    ? t("diary.suggestion.extraTwo", { core, first: extras[0], second: extras[1] })
    : `${core} 추가로 ${extras[0]}과 ${extras[1]}도 했어요.`;
}

/**
 * Rule-based Moment Sentence Suggestions (no LLM).
 * These are editable record-based draft sentences, never questions the user must answer.
 */
export function buildDiaryMomentSuggestions(input: {
  babyName: string;
  todayLogs: BabyLogEntry[];
  summary: TodaySummary;
  t?: Translate;
}): MomentSuggestion[] {
  const { babyName, todayLogs, summary, t } = input;
  const cats = new Set(todayLogs.map((l) => l.cat));
  const out: MomentSuggestion[] = [
    {
      id: "first-action",
      text: t
        ? t("diary.suggestion.firstAction", { babyName })
        : `오늘 ${babyName}의 새로운 모습을 발견한 소중한 하루였어요.`,
    },
    {
      id: "cute-face",
      text: t
        ? t("diary.suggestion.cuteFace", { babyName })
        : `${babyName}의 귀여운 표정이 오래 기억에 남는 하루였어요.`,
    },
  ];

  if (
    summary.flags.includes("sleep_less_than_yesterday") ||
    (summary.sleepCount > 0 && summary.totalSleepMinutes < 90)
  ) {
    out.push({
      id: "short-nap",
      text: t
        ? t("diary.suggestion.shortNap")
        : "낮잠이 평소보다 짧아 조금 더 세심히 지켜본 하루였어요.",
    });
  } else if (cats.has("bath")) {
    out.push({
      id: "bath",
      text: t
        ? t("diary.suggestion.bath")
        : "목욕하며 물과 한층 더 가까워진 즐거운 시간이었어요.",
    });
  } else if (cats.has("tummy") || cats.has("play")) {
    out.push({
      id: "play",
      text: t
        ? t("diary.suggestion.play")
        : "놀이나 터미타임에서 힘차게 움직이는 모습이 인상적이었어요.",
    });
  } else {
    out.push({
      id: "mood",
      text: t
        ? t("diary.suggestion.mood")
        : "오늘의 표정과 컨디션을 천천히 살펴본 하루였어요.",
    });
  }

  out.push({
    id: "growth-book",
    text: t
      ? t("diary.suggestion.growthBook")
      : "오늘의 예쁜 순간을 성장책에 오래 남겨두고 싶어요.",
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
