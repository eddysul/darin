/**
 * 주간 특징 표 — 한 주를 숫자로 정리한 것.
 *
 * 이 표 하나가 두 곳을 먹인다.
 *  - 규칙 기반 문장 (기기에서 계산, 즉시, 오프라인)
 *  - AI 해석 (표만 서버로 보낸다. 원본 기록은 나가지 않는다)
 *
 * AI 에게 원본 로그 대신 이 표를 주는 이유
 *  1. 숫자를 우리가 계산하므로 없는 값을 지어낼 수 없다.
 *  2. 기록 수백 건 대신 숫자 수십 개라 토큰이 적다.
 *  3. 시각·메모 같은 원본이 밖으로 나가지 않는다.
 */
import type { BabyLogEntry } from "../types/babyLog";
import type { CareSetup } from "../types/careSetup";
import { extractDailyFeatures, findInsights, type DailyFeatures } from "./careInsights";
import { formatDateKey, lastNDateKeys } from "./dateKey";

/** 표에 담을 지표와 표기 방법. 화면 문구와 프롬프트가 같은 정의를 쓴다. */
const TABLE_METRICS: { key: keyof Omit<DailyFeatures, "dateKey">; label: string; unit: string }[] = [
  { key: "feedCount", label: "수유 횟수", unit: "회" },
  { key: "feedVolume", label: "총 수유량", unit: "ml" },
  { key: "feedIntervalAvg", label: "수유 간격", unit: "분" },
  { key: "firstFeedMinutes", label: "첫 수유 시각", unit: "분" },
  { key: "lastFeedMinutes", label: "마지막 수유 시각", unit: "분" },
  { key: "sleepMinutes", label: "총 수면", unit: "분" },
  { key: "nightSleepMinutes", label: "밤잠", unit: "분" },
  { key: "longestSleepMinutes", label: "가장 긴 잠", unit: "분" },
  { key: "sleepCount", label: "잠든 횟수", unit: "회" },
  { key: "diaperCount", label: "기저귀 횟수", unit: "회" },
  { key: "stoolCount", label: "대변 횟수", unit: "회" },
  { key: "tummyMinutes", label: "터미타임", unit: "분" },
  { key: "playMinutes", label: "놀이 시간", unit: "분" },
  { key: "bathMinutes", label: "목욕 시각", unit: "분" },
  { key: "waterVolume", label: "물 섭취량", unit: "ml" },
  { key: "foodAmount", label: "이유식 양", unit: "g" },
  { key: "milkVolume", label: "우유 섭취량", unit: "ml" },
];

/** 한 주의 길이. 오늘은 아직 끝나지 않은 날이라 항상 제외한다. */
export const WEEK_DAYS = 6;

/** 이 정도는 기록돼 있어야 평균을 말할 수 있다. */
const MIN_DAYS_FOR_METRIC = 3;

export type MetricWindow = {
  avg: number;
  min: number;
  max: number;
  /** 이 지표가 실제로 기록된 날 수. */
  days: number;
};

export type WeeklyMetric = {
  key: string;
  label: string;
  unit: string;
  thisWeek: MetricWindow;
  lastWeek: MetricWindow | null;
  /** (이번주 - 지난주) / 지난주. 비교 대상이 없으면 null. */
  changeRatio: number | null;
  /** 최근 6일 값, 오래된 순. 기록이 없는 날은 null. */
  daily: (number | null)[];
};

export type WeeklyFeatureTable = {
  meta: {
    periodLabel: string;
    /** 카드 뱃지에 쓰는 짧은 표기. "8월 3주차". */
    weekLabel: string;
    /** 최근 6일의 날짜 키, 오래된 순. 지표의 daily 와 자리가 같다. */
    dateKeys: string[];
    ageMonths: number | null;
    /** 최근 6일 중 무엇이든 기록된 날 수. */
    recordedDays: number;
    hasPreviousWeek: boolean;
  };
  metrics: WeeklyMetric[];
  correlations: { a: string; b: string; rho: number; n: number }[];
};

function windowOf(values: (number | null)[]): MetricWindow | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < MIN_DAYS_FOR_METRIC) return null;
  return {
    avg: Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10,
    min: Math.min(...present),
    max: Math.max(...present),
    days: present.length,
  };
}

function monthDayLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

/** 기간이 끝난 날 기준으로 "8월 3주차". 달의 며칠인지로만 센다. */
function weekOfMonthLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}월 ${Math.ceil(Number(day) / 7)}주차`;
}

function ageInMonths(birthDate: string | undefined, now: Date): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > now) return null;
  return Math.round(((now.getTime() - birth.getTime()) / 86_400_000 / 30.44) * 10) / 10;
}

export function buildWeeklyFeatureTable(
  logs: BabyLogEntry[],
  careSetup: CareSetup,
  now = new Date(),
): WeeklyFeatureTable {
  const todayKey = formatDateKey(now);
  // 오늘 포함 13일에서 오늘을 떼면 최근 6일 + 그 앞 6일이 된다.
  const window = lastNDateKeys(WEEK_DAYS * 2 + 1, now).slice(0, WEEK_DAYS * 2);
  const previousKeys = window.slice(0, WEEK_DAYS);
  const recentKeys = window.slice(WEEK_DAYS);

  const byDate = new Map(
    extractDailyFeatures(logs, todayKey).map((day) => [day.dateKey, day] as const),
  );
  const pick = (keys: string[], metric: keyof Omit<DailyFeatures, "dateKey">) =>
    keys.map((key) => byDate.get(key)?.[metric] ?? null);

  const metrics: WeeklyMetric[] = [];
  for (const { key, label, unit } of TABLE_METRICS) {
    const daily = pick(recentKeys, key);
    const thisWeek = windowOf(daily);
    if (!thisWeek) continue; // 기록이 부족한 지표는 표에 넣지 않는다.
    const lastWeek = windowOf(pick(previousKeys, key));
    metrics.push({
      key,
      label,
      unit,
      thisWeek,
      lastWeek,
      changeRatio:
        lastWeek && lastWeek.avg !== 0
          ? Math.round(((thisWeek.avg - lastWeek.avg) / lastWeek.avg) * 100) / 100
          : null,
      daily,
    });
  }

  const recordedDays = recentKeys.filter((key) => (byDate.get(key)?.feedCount ?? null) !== null
    || (byDate.get(key)?.sleepMinutes ?? null) !== null
    || (byDate.get(key)?.diaperCount ?? null) !== null).length;

  return {
    meta: {
      periodLabel: `${monthDayLabel(recentKeys[0])}~${monthDayLabel(recentKeys[recentKeys.length - 1])}`,
      weekLabel: weekOfMonthLabel(recentKeys[recentKeys.length - 1]),
      dateKeys: recentKeys,
      ageMonths: ageInMonths(careSetup.child.birthDate, now),
      recordedDays,
      hasPreviousWeek: metrics.some((metric) => metric.lastWeek !== null),
    },
    metrics,
    correlations: findInsights(logs, todayKey).map((insight) => ({
      a: insight.lead.replace(/ 날, $/, ""),
      b: `${insight.gapText} ${insight.tail}`,
      rho: Math.round(insight.rho * 100) / 100,
      n: insight.n,
    })),
  };
}
