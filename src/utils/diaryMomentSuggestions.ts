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

const EMPTY_SNAPSHOTS = new Set([
  "오늘은 아직 Care Log 기록이 없어요. 수유·수면·기저귀를 남기면 여기에 요약돼요.",
  "No Care Log records yet today. Feeding, sleep, and diaper logs will show up here.",
  "今日はまだケア記録がありません。授乳・睡眠・おむつを残すと、ここにまとまります。",
  "Aún no hay registros de cuidados hoy. Las tomas, el sueño y los pañales aparecerán aquí.",
  "今天还没有照护记录。留下喂养、睡眠和尿布后，摘要会出现在这里。",
]);

const ACTIVITY_STORED_TO_KEY: Record<string, MessageKey> = {
  "터미타임": "diary.suggestion.activity.tummy",
  "Tummy time": "diary.suggestion.activity.tummy",
  "タミータイム": "diary.suggestion.activity.tummy",
  "Tiempo boca abajo": "diary.suggestion.activity.tummy",
  "俯卧时间": "diary.suggestion.activity.tummy",
  "목욕": "diary.suggestion.activity.bath",
  "Bath": "diary.suggestion.activity.bath",
  "お風呂": "diary.suggestion.activity.bath",
  "Baño": "diary.suggestion.activity.bath",
  "洗澡": "diary.suggestion.activity.bath",
  "놀이": "diary.suggestion.activity.play",
  "Play": "diary.suggestion.activity.play",
  "遊び": "diary.suggestion.activity.play",
  "Juego": "diary.suggestion.activity.play",
  "玩耍": "diary.suggestion.activity.play",
  "병원": "diary.suggestion.activity.doctor",
  "Clinic": "diary.suggestion.activity.doctor",
  "通院": "diary.suggestion.activity.doctor",
  "Consulta": "diary.suggestion.activity.doctor",
  "就诊": "diary.suggestion.activity.doctor",
  "약": "diary.suggestion.activity.med",
  "Medicine": "diary.suggestion.activity.med",
  "お薬": "diary.suggestion.activity.med",
  "Medicina": "diary.suggestion.activity.med",
  "药物": "diary.suggestion.activity.med",
  "산책": "diary.suggestion.activity.walk",
  "Stroll": "diary.suggestion.activity.walk",
  "お散歩": "diary.suggestion.activity.walk",
  "Paseo": "diary.suggestion.activity.walk",
  "散步": "diary.suggestion.activity.walk",
};

const CORE_PATTERNS: RegExp[] = [
  /^오늘은 수유 (\d+)회, 수면 (.+?), 기저귀 (\d+)회가 기록되었어요\.(?: 추가로 (.+)도 했어요\.)?$/,
  /^Today: (\d+) feeds, (.+?) of sleep, and (\d+) diaper changes\.(?: You also did (.+)\.)?$/,
  /^今日は授乳(\d+)回、睡眠(.+?)、おむつ(\d+)回が記録されています。(?: さらに(.+)もしました。)?$/,
  /^Hoy: (\d+) tomas, (.+?) de sueño y (\d+) cambios de pañal\.(?: También hiciste (.+)\.)?$/,
  /^今天记录了喂养(\d+)次、睡眠(.+?)、尿布(\d+)次。(?: 另外还做了(.+)。)?$/,
];

function parseSleepMinutes(raw: string): number | null {
  const value = raw.trim();
  const hourMin =
    /^(\d+)\s*(?:시간|hr|h|時間|小时)\s*(\d+)\s*(?:분|min\.?|分|分钟)$/i.exec(value)
    ?? /^(\d+)時間(\d+)分$/.exec(value)
    ?? /^(\d+)小时(\d+)分钟$/.exec(value);
  if (hourMin) return Number(hourMin[1]) * 60 + Number(hourMin[2]);
  const hoursOnly =
    /^(\d+)\s*(?:시간|hr|h|時間|小时)$/i.exec(value)
    ?? /^(\d+)時間$/.exec(value)
    ?? /^(\d+)小时$/.exec(value);
  if (hoursOnly) return Number(hoursOnly[1]) * 60;
  const minsOnly =
    /^(\d+)\s*(?:분|min\.?|分|分钟)$/i.exec(value)
    ?? /^(\d+)分$/.exec(value)
    ?? /^(\d+)分钟$/.exec(value);
  if (minsOnly) return Number(minsOnly[1]);
  return null;
}

function splitExtraActivities(raw: string): string[] {
  const value = raw.trim();
  if (!value) return [];
  const parts = value
    .split(/\s*(?:, |과 |와 | and |と| y |和)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [value];
}

function localizeActivity(label: string, t: Translate): string {
  const key = ACTIVITY_STORED_TO_KEY[label];
  return key ? t(key) : label;
}

/**
 * Frozen care-log snapshots stay as stored text, but known generated templates
 * are remapped so language switches do not leave Korean (or another locale) on screen.
 */
export function displayCareLogSummarySnapshot(snapshot: string, t: Translate): string {
  const text = snapshot.trim();
  if (!text) return t("diary.suggestion.empty");
  if (EMPTY_SNAPSHOTS.has(text)) return t("diary.suggestion.empty");

  for (const pattern of CORE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const feeds = Number(match[1]);
    const sleepMinutes = parseSleepMinutes(match[2]);
    const diapers = Number(match[3]);
    if (!Number.isFinite(feeds) || sleepMinutes == null || !Number.isFinite(diapers)) continue;
    const sleep = formatSleepDuration(sleepMinutes, t);
    const core = t("diary.suggestion.core", { feeds, sleep, diapers });
    const extras = splitExtraActivities(match[4] ?? "").map((label) => localizeActivity(label, t));
    if (extras.length >= 2) return t("diary.suggestion.extraTwo", { core, first: extras[0], second: extras[1] });
    if (extras.length === 1) return t("diary.suggestion.extraOne", { core, activity: extras[0] });
    return core;
  }
  return snapshot;
}

/** Append a suggestion into the comment field (or set if empty). */
export function appendMomentSuggestion(current: string, suggestion: string): string {
  const t = current.trim();
  if (!t) return suggestion;
  if (t.includes(suggestion)) return current;
  return `${t}\n${suggestion}`;
}
