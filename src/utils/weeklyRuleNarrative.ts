/**
 * 표에서 규칙만으로 문장을 만드는 층.
 *
 * 두 곳에서 쓴다.
 *  - 무료 사용자의 주간 요약 (기기에서 계산, 즉시, 오프라인)
 *  - AI 해석이 실패하거나 검증에서 폐기됐을 때의 대체 문장
 *
 * 문장은 열거하지 않고 조합한다. 지표를 늘려도 문구를 새로 쓰지 않아도 되게.
 * 판단어("잘", "충분히")와 권유("~해보세요")는 쓰지 않는다. 앱이 아이를 평가하지 않는다.
 */
import type { Locale } from "../i18n";
import {
  formatClockReading,
  formatWeeklyAmount,
  narrativeChangeKey,
  narrativeSubjectKey,
  weekdayMessageKey,
  weeklyMetricLabel,
} from "./insightDisplay";
import type { Translate } from "./recordDisplay";
import type { WeeklyFeatureTable, WeeklyMetric } from "./weeklyFeatureTable";

export type RuleNarrative = {
  headline: string;
  body: string;
};

/** 마지막 글자에 받침이 있는지. 한글·숫자·영문 끝을 모두 다룬다. */
function hasFinalConsonant(text: string): boolean {
  const last = text.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  // 숫자는 한국어 읽기의 끝소리로 판단한다 (0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 에 받침)
  if (last >= "0" && last <= "9") return "013678".includes(last);
  // ml, g 처럼 영문으로 끝나는 단위
  return ["l", "m", "n", "g", "k", "p", "t"].includes(last.toLowerCase());
}

/** 받침에 맞는 조사를 붙인다. */
function withParticle(text: string, withJong: string, withoutJong: string): string {
  return `${text}${hasFinalConsonant(text) ? withJong : withoutJong}`;
}

/** 이 정도는 넘어야 "달라졌다"고 말한다. 매일의 흔들림을 변화라고 부르지 않기 위해. */
const CHANGE_RATIO = 0.15;

/**
 * 지표별 표현.
 *  subject  문장 주어로 쓰는 짧은 이름
 *  up/down  이 지표 하나만 말할 때의 헤드라인
 *  riseStem 두 지표를 엮을 때 쓰는 동사 어간 ("늘", "길어지")
 */
const PHRASE: Record<
  string,
  { subject: string; up: string; down: string; riseStem: string; fallStem: string }
> = {
  feedCount: { subject: "수유", up: "요즘 더 자주 먹고 있어요", down: "요즘 먹는 횟수가 줄었어요", riseStem: "늘", fallStem: "줄" },
  feedVolume: { subject: "수유량", up: "요즘 더 많이 먹고 있어요", down: "요즘 먹는 양이 줄었어요", riseStem: "늘", fallStem: "줄" },
  feedIntervalAvg: { subject: "수유 간격", up: "수유 간격이 길어지고 있어요", down: "수유 간격이 짧아지고 있어요", riseStem: "길어지", fallStem: "짧아지" },
  sleepMinutes: { subject: "총 수면", up: "요즘 조금 더 자고 있어요", down: "요즘 잠이 조금 줄었어요", riseStem: "늘", fallStem: "줄" },
  nightSleepMinutes: { subject: "밤잠", up: "밤잠이 길어지고 있어요", down: "밤잠이 짧아지고 있어요", riseStem: "길어지", fallStem: "짧아지" },
  longestSleepMinutes: { subject: "가장 긴 잠", up: "한 번에 자는 시간이 길어졌어요", down: "한 번에 자는 시간이 짧아졌어요", riseStem: "길어지", fallStem: "짧아지" },
  sleepCount: { subject: "잠든 횟수", up: "잠을 더 여러 번 나눠 자고 있어요", down: "잠을 덜 나눠 자고 있어요", riseStem: "늘", fallStem: "줄" },
  diaperCount: { subject: "기저귀", up: "기저귀를 더 자주 갈고 있어요", down: "기저귀 가는 횟수가 줄었어요", riseStem: "늘", fallStem: "줄" },
  stoolCount: { subject: "대변", up: "대변을 더 자주 보고 있어요", down: "대변 횟수가 줄었어요", riseStem: "늘", fallStem: "줄" },
  tummyMinutes: { subject: "터미타임", up: "터미타임이 길어지고 있어요", down: "터미타임이 짧아지고 있어요", riseStem: "길어지", fallStem: "짧아지" },
  playMinutes: { subject: "놀이 시간", up: "노는 시간이 길어지고 있어요", down: "노는 시간이 짧아지고 있어요", riseStem: "길어지", fallStem: "짧아지" },
  waterVolume: { subject: "물", up: "물을 더 많이 마시고 있어요", down: "물을 덜 마시고 있어요", riseStem: "늘", fallStem: "줄" },
  foodAmount: { subject: "이유식", up: "이유식을 더 많이 먹고 있어요", down: "이유식 양이 줄었어요", riseStem: "늘", fallStem: "줄" },
  milkVolume: { subject: "우유", up: "우유를 더 많이 마시고 있어요", down: "우유를 덜 마시고 있어요", riseStem: "늘", fallStem: "줄" },
};

/** 어간을 과거형으로. "길어지" → "길어졌어요", "늘" → "늘었어요". */
function pastForm(stem: string): string {
  return stem.endsWith("지") ? `${stem.slice(0, -1)}졌어요` : `${stem}었어요`;
}

/** 헤드라인으로 삼기에 자연스러운 순서. 앞쪽이 부모 관심에 가깝다. */
const PRIORITY = [
  "nightSleepMinutes",
  "sleepMinutes",
  "longestSleepMinutes",
  "feedCount",
  "feedVolume",
  "foodAmount",
  "stoolCount",
  "diaperCount",
  "feedIntervalAvg",
  "waterVolume",
  "milkVolume",
  "tummyMinutes",
  "playMinutes",
  "sleepCount",
];

function formatValue(metric: WeeklyMetric, value: number, t: Translate, locale: Locale): string {
  return formatWeeklyAmount(metric.key, metric.unit, value, t, locale);
}

const CLOCK_METRICS = ["firstFeedMinutes", "lastFeedMinutes", "bathMinutes"];

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function weekdayOf(dateKey: string, t: Translate, locale: Locale): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const index = new Date(year, month - 1, day).getDay();
  if (locale === "ko") return WEEKDAY[index] ?? "";
  return t(weekdayMessageKey(index));
}

/**
 * 변화가 언제 나타났는지. 지난주 평균을 변화 방향으로 넘어선 날이 어떻게 놓였는지만 본다.
 *
 * 하루만 튀었는지, 어느 날부터 쭉인지는 표에도 그래프에도 글로는 없다.
 * 그래서 이게 카드의 훅이 된다. 못 찾으면 null 이고 헤드라인은 밋밋한 쪽으로 간다.
 */
function findShape(
  metric: WeeklyMetric,
  up: boolean,
  dateKeys: string[],
  t: Translate,
  locale: Locale,
): { kind: "single" | "since"; weekday: string } | null {
  const base = metric.lastWeek!.avg;
  const flags = metric.daily.map((value) => (value === null ? null : up ? value > base : value < base));
  if (flags.filter((flag) => flag !== null).length < 4) return null;

  const hits = flags.filter((flag) => flag === true).length;
  if (hits === 1) {
    return { kind: "single", weekday: weekdayOf(dateKeys[flags.indexOf(true)], t, locale) };
  }

  // 마지막 날부터 거꾸로 몇 날이 연속인지
  let start = flags.length;
  while (start > 0 && flags[start - 1] === true) start -= 1;
  if (start === 0 || flags.length - start < 3) return null;

  // "어느 날부터"라고 말하려면 그 앞뒤가 겹치지 않아야 한다.
  // 앞쪽에 한 날이 살짝 걸치는 건 흔하므로 개수가 아니라 값의 분리로 판단한다.
  const head = metric.daily.slice(0, start).filter((v): v is number => v !== null);
  const tail = metric.daily.slice(start).filter((v): v is number => v !== null);
  if (!head.length || !tail.length) return null;
  const separated = up ? Math.min(...tail) > Math.max(...head) : Math.max(...tail) < Math.min(...head);
  return separated ? { kind: "since", weekday: weekdayOf(dateKeys[start], t, locale) } : null;
}

export function buildRuleNarrative(table: WeeklyFeatureTable, t: Translate, locale: Locale): RuleNarrative {
  const comparable = table.metrics.filter(
    (metric) => metric.lastWeek !== null && metric.changeRatio !== null && PHRASE[metric.key],
  );

  // 가장 크게 달라진 지표 하나를 고른다. 같은 정도면 관심이 큰 쪽을 앞세운다.
  let lead: WeeklyMetric | null = null;
  for (const metric of comparable) {
    if (Math.abs(metric.changeRatio!) < CHANGE_RATIO) continue;
    // 2.4회 → 2.9회 처럼 표기하면 "2회 → 2회" 가 되는 지표는 헤드라인으로 쓸 수 없다.
    if (formatValue(metric, metric.lastWeek!.avg, t, locale) === formatValue(metric, metric.thisWeek.avg, t, locale)) continue;
    if (!lead) {
      lead = metric;
      continue;
    }
    const better =
      Math.abs(metric.changeRatio!) > Math.abs(lead.changeRatio!) * 1.2 ||
      (Math.abs(metric.changeRatio!) > Math.abs(lead.changeRatio!) * 0.8 &&
        PRIORITY.indexOf(metric.key) < PRIORITY.indexOf(lead.key));
    if (better) lead = metric;
  }

  if (lead) {
    const up = lead.changeRatio! > 0;
    const phrase = PHRASE[lead.key];
    const subjectKey = narrativeSubjectKey(lead.key);
    const changeKey = narrativeChangeKey(lead.key, up);
    const subject = subjectKey ? t(subjectKey) : weeklyMetricLabel(lead.key, t);
    const shape = findShape(lead, up, table.meta.dateKeys, t, locale);
    let headline: string;
    if (locale === "ko") {
      const past = pastForm(up ? phrase.riseStem : phrase.fallStem);
      if (shape?.kind === "since") {
        headline = `${withParticle(subject, "이", "가")} ${shape.weekday}요일부터 부쩍 ${past}`;
      } else if (shape?.kind === "single") {
        headline = `${withParticle(subject, "은", "는")} ${shape.weekday}요일 하루만 달랐어요`;
      } else {
        headline = changeKey ? t(changeKey) : phrase[up ? "up" : "down"];
      }
    } else if (shape?.kind === "since") {
      headline = t("insight.critical.093", { subject, weekday: shape.weekday });
    } else if (shape?.kind === "single") {
      headline = t("insight.critical.094", { subject, weekday: shape.weekday });
    } else {
      headline = changeKey ? t(changeKey) : subject;
    }

    const before = formatValue(lead, lead.lastWeek!.avg, t, locale);
    const after = formatValue(lead, lead.thisWeek.avg, t, locale);
    return {
      headline,
      body: locale === "ko"
        ? `하루 평균 ${before} → ${withParticle(after, "으로", "로")} ${up ? "늘었어요" : "줄었어요"}.`
        : t("insight.critical.095", { before, after }),
    };
  }

  const shown = PRIORITY.map((key) => table.metrics.find((metric) => metric.key === key))
    .filter((metric): metric is WeeklyMetric => Boolean(metric))
    .slice(0, 3);
  if (!shown.length) {
    return { headline: "", body: "" };
  }
  const parts = shown.map((metric) => {
    const label = weeklyMetricLabel(metric.key, t);
    const value = CLOCK_METRICS.includes(metric.key)
      ? formatClockReading(metric.thisWeek.avg, locale)
      : formatValue(metric, metric.thisWeek.avg, t, locale);
    return `${label} ${value}`;
  });
  return {
    headline: table.meta.hasPreviousWeek ? t("insight.critical.096") : t("insight.critical.097"),
    body: locale === "ko"
      ? `하루 평균 ${withParticle(parts.join(", "), "이에요", "예요")}.`
      : t("insight.critical.098", { parts: parts.join(", ") }),
  };
}
