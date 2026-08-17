/**
 * 기록에서 패턴을 찾는 계층. AI·서버를 쓰지 않는 순수 계산.
 *
 * 두 가지를 제공한다.
 *
 *  1. 분포 (buildDistribution) — 지금 UI가 쓰는 것.
 *     검정을 하지 않는다. "이런 날엔 이랬다"를 표본 수와 함께 보여주고
 *     판단은 사용자에게 맡긴다. 주장하지 않으므로 다중비교 문제가 없고
 *     데이터가 적어도 정직하다.
 *
 *  2. 상관 (findCorrelations) — 아직 UI에 연결하지 않았다.
 *     실제 로그로 임계값(MIN_SAMPLES / MIN_RHO)을 튜닝한 뒤에 붙일 것.
 *     문장을 만들 때 인과·권유형 표현을 쓰지 않는다는 규칙은
 *     describeCorrelation에 박아두었다.
 */
import type { BabyLogEntry } from "../types/babyLog";
import { FEEDING_CATS } from "./reportAggregates";
import { isCustomCategoryKey } from "../types/logCategory";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import { formatDateKey } from "./dateKey";
import { toMinutes } from "./formatLog";

function isFeeding(cat: string): boolean {
  return !isCustomCategoryKey(cat) && FEEDING_CATS.includes(cat as BabyLogCategoryId);
}

/** 하루치에서 뽑아낸 값들. 기록이 없으면 null (0으로 채우지 않는다). */
export type DailyFeatures = {
  dateKey: string;
  /** 마지막 수유 시각 (분). */
  lastFeedMinutes: number | null;
  /** 첫 수유 시각 (분). */
  firstFeedMinutes: number | null;
  feedCount: number | null;
  /** 총 수유량 (ml). 양을 적은 기록이 하나도 없으면 null. */
  feedVolume: number | null;
  sleepMinutes: number | null;
  sleepCount: number | null;
  /** 가장 긴 수면 한 번의 길이 (분). */
  longestSleepMinutes: number | null;
  diaperCount: number | null;
  bathMinutes: number | null;
  /** 터미타임 + 놀이 총 시간 (분). */
  activeMinutes: number | null;
};

function sumDuration(entries: BabyLogEntry[]): number {
  return entries.reduce((total, entry) => total + (Number.parseInt(entry.duration ?? "0", 10) || 0), 0);
}

export function extractDailyFeatures(
  logs: BabyLogEntry[],
  todayKey = formatDateKey(),
): DailyFeatures[] {
  const byDate = new Map<string, BabyLogEntry[]>();
  for (const entry of logs) {
    const dateKey = entry.dateKey ?? todayKey;
    const bucket = byDate.get(dateKey);
    if (bucket) bucket.push(entry);
    else byDate.set(dateKey, [entry]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, entries]) => {
      const feeds = entries.filter((entry) => isFeeding(entry.cat)).sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
      const sleeps = entries.filter((entry) => entry.cat === "sleep");
      const diapers = entries.filter((entry) => entry.cat === "diaper");
      const baths = entries.filter((entry) => entry.cat === "bath");
      const active = entries.filter((entry) => entry.cat === "tummy" || entry.cat === "play");

      const volumes = feeds
        .map((entry) => Number.parseFloat(entry.amount ?? ""))
        .filter((value) => Number.isFinite(value) && value > 0);
      const sleepDurations = sleeps
        .map((entry) => Number.parseInt(entry.duration ?? "0", 10) || 0)
        .filter((value) => value > 0);

      return {
        dateKey,
        lastFeedMinutes: feeds.length ? toMinutes(feeds[feeds.length - 1].time) : null,
        firstFeedMinutes: feeds.length ? toMinutes(feeds[0].time) : null,
        feedCount: feeds.length || null,
        feedVolume: volumes.length ? volumes.reduce((a, b) => a + b, 0) : null,
        sleepMinutes: sleepDurations.length ? sleepDurations.reduce((a, b) => a + b, 0) : null,
        sleepCount: sleeps.length || null,
        longestSleepMinutes: sleepDurations.length ? Math.max(...sleepDurations) : null,
        diaperCount: diapers.length || null,
        bathMinutes: baths.length ? toMinutes(baths[baths.length - 1].time) : null,
        activeMinutes: active.length ? sumDuration(active) || null : null,
      };
    });
}

// ── 분포 ────────────────────────────────────────────────────────────────

export type DistributionBucket = {
  /** "이른 편", "보통", "늦은 편" */
  name: string;
  /** 이 구간의 실제 범위 표기 ("~19:40") */
  range: string;
  /** 구간 평균 결과값 */
  value: number;
  /** 이 구간에 속한 날 수 */
  days: number;
};

export type Distribution = {
  bucketLabel: string;
  valueLabel: string;
  buckets: DistributionBucket[];
  totalDays: number;
};

/** 분포를 보여주려면 각 구간에 최소 이만큼은 있어야 한다. */
export const MIN_DAYS_PER_BUCKET = 3;

function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 입력값을 3분위로 나눠 각 구간의 결과 평균을 낸다.
 *
 * 고정 경계(예: 18시/20시) 대신 3분위를 쓰는 이유: 가정마다 리듬이 달라
 * 고정 경계로는 한쪽 구간에 전부 몰린다. 3분위는 구간이 비지 않는 것도 보장한다.
 */
export function buildDistribution(
  points: { input: number; output: number }[],
  labels: { bucketLabel: string; valueLabel: string; formatInput?: (minutes: number) => string },
): Distribution | null {
  const sorted = [...points].sort((a, b) => a.input - b.input);
  if (sorted.length < MIN_DAYS_PER_BUCKET * 3) return null;

  const size = Math.floor(sorted.length / 3);
  const groups = [
    sorted.slice(0, size),
    sorted.slice(size, sorted.length - size),
    sorted.slice(sorted.length - size),
  ];
  if (groups.some((group) => group.length < MIN_DAYS_PER_BUCKET)) return null;

  const format = labels.formatInput ?? ((value: number) => String(Math.round(value)));
  const names = ["이른 편", "보통", "늦은 편"];

  return {
    bucketLabel: labels.bucketLabel,
    valueLabel: labels.valueLabel,
    totalDays: sorted.length,
    buckets: groups.map((group, index) => ({
      name: names[index],
      range:
        index === 0
          ? `~${format(group[group.length - 1].input)}`
          : index === 2
            ? `${format(group[0].input)}~`
            : `${format(group[0].input)}~${format(group[group.length - 1].input)}`,
      value: group.reduce((sum, point) => sum + point.output, 0) / group.length,
      days: group.length,
    })),
  };
}

/** 마지막 수유 시각 → 그날 총 수면. 현재 UI가 쓰는 유일한 분포. */
export function buildLastFeedSleepDistribution(
  logs: BabyLogEntry[],
  todayKey = formatDateKey(),
): Distribution | null {
  const points = extractDailyFeatures(logs, todayKey)
    .filter((day) => day.lastFeedMinutes !== null && day.sleepMinutes !== null)
    .map((day) => ({ input: day.lastFeedMinutes!, output: day.sleepMinutes! }));
  return buildDistribution(points, {
    bucketLabel: "마지막 수유 시각",
    valueLabel: "그날 총 수면",
    formatInput: formatClock,
  });
}

// ── 상관 (UI 미연결) ────────────────────────────────────────────────────

/** 순위 변환. 동점은 평균 순위. */
function ranks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) out[indexed[k].index] = rank;
    i = j + 1;
  }
  return out;
}

/** Spearman 순위상관. Pearson보다 이상치와 비정규 분포에 강하다. */
export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const n = rx.length;
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / n;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = rx[i] - mx;
    const b = ry[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** 정규 근사 꼬리확률. 표본이 작을수록 낙관적이므로 임계를 넉넉히 잡을 것. */
function normalTail(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (1.330274 * t ** 4 - 1.821256 * t ** 3 + 1.781478 * t * t - 0.356538 * t + 0.319381);
  return z > 0 ? p : 1 - p;
}

/** rho의 양측 p값 (Fisher z 변환). normalTail은 상위꼬리이므로 |z|를 그대로 넘긴다. */
export function pValueFromRho(rho: number, n: number): number {
  if (n < 4) return 1;
  if (Math.abs(rho) >= 1) return 0;
  const z = Math.atanh(rho) * Math.sqrt((n - 3) / 1.06);
  return Math.min(1, 2 * normalTail(Math.abs(z)));
}

/**
 * Benjamini-Hochberg 보정. 여러 쌍을 동시에 검정하면 우연히 유의한 것이 나오므로
 * 반드시 거쳐야 한다. 입력 순서대로 q값을 돌려준다.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const n = pValues.length;
  const order = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p);
  const q = new Array<number>(n);
  let previous = 1;
  for (let i = n - 1; i >= 0; i -= 1) {
    const adjusted = Math.min(previous, (order[i].p * n) / (i + 1));
    previous = adjusted;
    q[order[i].index] = Math.min(1, adjusted);
  }
  return q;
}

export type FeatureKey = keyof Omit<DailyFeatures, "dateKey">;

/**
 * 검정할 쌍은 미리 고정한다. 가능한 조합을 전부 돌리면 그 자체가 p-hacking이다.
 * 육아 상식으로 그럴듯한 것만 남겼다.
 */
export const CORRELATION_CANDIDATES: {
  input: FeatureKey;
  output: FeatureKey;
  inputLabel: string;
  outputLabel: string;
}[] = [
  { input: "lastFeedMinutes", output: "longestSleepMinutes", inputLabel: "마지막 수유가 이른", outputLabel: "가장 긴 잠이 길었어요" },
  { input: "feedVolume", output: "sleepMinutes", inputLabel: "수유량이 많은", outputLabel: "총 수면이 길었어요" },
  { input: "bathMinutes", output: "longestSleepMinutes", inputLabel: "목욕이 이른", outputLabel: "가장 긴 잠이 길었어요" },
  { input: "sleepCount", output: "longestSleepMinutes", inputLabel: "낮잠 횟수가 적은", outputLabel: "가장 긴 잠이 길었어요" },
  { input: "activeMinutes", output: "sleepMinutes", inputLabel: "활동 시간이 많은", outputLabel: "총 수면이 길었어요" },
];

/** UI 노출 임계. 실데이터 확보 후 튜닝할 것. */
export const MIN_SAMPLES = 14;
export const MIN_RHO = 0.4;
export const MAX_Q = 0.05;

export type Correlation = {
  inputLabel: string;
  outputLabel: string;
  rho: number;
  n: number;
  q: number;
};

/** 임계를 통과한 상관을 강한 순으로. 없으면 빈 배열이 정답이다. */
export function findCorrelations(
  logs: BabyLogEntry[],
  todayKey = formatDateKey(),
): Correlation[] {
  const days = extractDailyFeatures(logs, todayKey);

  const measured = CORRELATION_CANDIDATES.map((candidate) => {
    const pairs = days
      .map((day) => ({ x: day[candidate.input], y: day[candidate.output] }))
      .filter((pair): pair is { x: number; y: number } => pair.x !== null && pair.y !== null);
    const rho = pairs.length >= MIN_SAMPLES ? spearman(pairs.map((p) => p.x), pairs.map((p) => p.y)) : null;
    return { candidate, rho, n: pairs.length };
  });

  const testable = measured.filter((item): item is typeof item & { rho: number } => item.rho !== null);
  if (!testable.length) return [];

  const qs = benjaminiHochberg(testable.map((item) => pValueFromRho(item.rho, item.n)));

  return testable
    .map((item, index) => ({
      inputLabel: item.candidate.inputLabel,
      outputLabel: item.candidate.outputLabel,
      rho: item.rho,
      n: item.n,
      q: qs[index],
    }))
    .filter((item) => Math.abs(item.rho) >= MIN_RHO && item.q < MAX_Q)
    .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
}

/**
 * 상관을 문장으로. 과거 서술형만 쓴다.
 * "~하면 ~해요"(인과)나 "~해보세요"(권유)는 쓰지 않는다 — 부모는 이걸 보고 실제로 행동을 바꾸는데,
 * 관측된 상관의 원인이 교란변수(성장 급증기, 주말 등)일 수 있다.
 */
export function describeCorrelation(correlation: Correlation): string {
  const direction = correlation.rho < 0 ? correlation.inputLabel : correlation.inputLabel.replace(/이른|많은|적은/, (m) =>
    m === "이른" ? "늦은" : m === "많은" ? "적은" : "많은",
  );
  return `최근 기록에서 ${direction} 날에 ${correlation.outputLabel} (${correlation.n}일 기준)`;
}
