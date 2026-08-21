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
  /** 대변(둘다 포함) 횟수. */
  stoolCount: number | null;
  bathMinutes: number | null;
  tummyMinutes: number | null;
  playMinutes: number | null;
  /** 물 섭취량 (ml). */
  waterVolume: number | null;
  /** 이유식 양 (g). */
  foodAmount: number | null;
  /** 우유 섭취량 (ml). */
  milkVolume: number | null;
  /** 밤(20~08시)에 잔 시간 (분). 밤잠과 낮잠을 갈라야 "밤잠이 모인다"를 말할 수 있다. */
  nightSleepMinutes: number | null;
  /** 수유 사이 평균 간격 (분). 규칙성 판단에 쓴다. */
  feedIntervalAvg: number | null;
};

/** 자정을 넘길 수 있으므로 구간을 펼쳐 겹치는 만큼만 더한다. */
function nightOverlapMinutes(start: number, duration: number): number {
  const end = start + Math.max(0, duration);
  // 새벽(0~8시) · 밤(20~24시) · 다음날 새벽
  const nightWindows: [number, number][] = [[0, 480], [1200, 1440], [1440, 1920]];
  return nightWindows.reduce((total, [from, to]) => {
    const overlap = Math.min(end, to) - Math.max(start, from);
    return total + Math.max(0, overlap);
  }, 0);
}

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
      const tummy = entries.filter((entry) => entry.cat === "tummy");
      const play = entries.filter((entry) => entry.cat === "play");

      const sumAmount = (cat: string): number | null => {
        const values = entries
          .filter((entry) => entry.cat === cat)
          .map((entry) => Number.parseFloat(entry.amount ?? ""))
          .filter((value) => Number.isFinite(value) && value > 0);
        return values.length ? values.reduce((a, b) => a + b, 0) : null;
      };

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
        stoolCount:
          diapers.filter((entry) => entry.chip === "대변" || entry.chip === "둘다").length || null,
        bathMinutes: baths.length ? toMinutes(baths[baths.length - 1].time) : null,
        tummyMinutes: tummy.length ? sumDuration(tummy) || null : null,
        playMinutes: play.length ? sumDuration(play) || null : null,
        nightSleepMinutes: sleeps.length
          ? sleeps.reduce(
              (total, entry) =>
                total + nightOverlapMinutes(toMinutes(entry.time), Number.parseInt(entry.duration ?? "0", 10) || 0),
              0,
            ) || null
          : null,
        feedIntervalAvg: (() => {
          if (feeds.length < 2) return null;
          const times = feeds.map((entry) => toMinutes(entry.time));
          const gaps = times.slice(1).map((t, i) => t - times[i]).filter((g) => g > 0);
          return gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
        })(),
        waterVolume: sumAmount("water"),
        foodAmount: sumAmount("food"),
        milkVolume: sumAmount("milk"),
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
  /** 결과값 표기. 지표마다 단위가 달라 분포가 직접 들고 있는다. */
  formatValue: (value: number) => string;
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
  labels: {
    bucketLabel: string;
    valueLabel: string;
    formatInput?: (value: number) => string;
    /** 구간 이름 (작은 값 → 큰 값). 시각이면 "이른 편", 횟수면 "적은 편" 등. */
    bucketNames?: [string, string, string];
    formatValue?: (value: number) => string;
  },
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
  const names = labels.bucketNames ?? ["이른 편", "보통", "늦은 편"];

  return {
    bucketLabel: labels.bucketLabel,
    valueLabel: labels.valueLabel,
    formatValue: labels.formatValue ?? ((value: number) => String(Math.round(value))),
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

/**
 * 마지막 수유 시각 → 그날 총 수면. 현재 UI가 쓰는 유일한 분포.
 *
 * 오늘은 제외한다. 아직 끝나지 않은 날을 완전한 하루처럼 넣으면
 * 그 날이 속한 구간의 평균만 끌어내려 없는 차이를 만들어낸다.
 */
export function buildLastFeedSleepDistribution(
  logs: BabyLogEntry[],
  todayKey = formatDateKey(),
): Distribution | null {
  const points = extractDailyFeatures(logs, todayKey)
    .filter((day) => day.dateKey !== todayKey)
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


// ── 발견 ────────────────────────────────────────────────────────────────

export type FeatureKey = keyof Omit<DailyFeatures, "dateKey">;

type FeatureFamily = "feed" | "sleep" | "diaper" | "water" | "food" | "activity" | "bath";

type FeatureMeta = {
  /** 같은 영역끼리는 짝짓지 않는다. 정의가 겹쳐 당연한 결과만 나온다. */
  family: FeatureFamily;
  /** 분포 축에 쓰는 이름 */
  axis: string;
  format: (value: number) => string;
  /** 구간 이름 3개 (작은 값 → 큰 값) */
  buckets: [string, string, string];
  /** "~한 날" 앞부분. low = 값이 작을 때, high = 값이 클 때 */
  low: string;
  high: string;
  /** 결과 쪽에 올 때 쓰는 표현 */
  more: string;
  less: string;
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

const CLOCK = { format: formatClock, buckets: ["이른 편", "보통", "늦은 편"] as [string, string, string] };
const COUNT = { format: (v: number) => `${Math.round(v)}회`, buckets: ["적은 편", "보통", "많은 편"] as [string, string, string] };
const MINUTES = { format: (v: number) => formatMinutes(Math.round(v)), buckets: ["짧은 편", "보통", "긴 편"] as [string, string, string] };
const ML = { format: (v: number) => `${Math.round(v)}ml`, buckets: ["적은 편", "보통", "많은 편"] as [string, string, string] };
const GRAM = { format: (v: number) => `${Math.round(v)}g`, buckets: ["적은 편", "보통", "많은 편"] as [string, string, string] };

const FEATURES: Record<FeatureKey, FeatureMeta> = {
  lastFeedMinutes: { family: "feed", axis: "마지막 수유 시각", low: "마지막 수유가 이른", high: "마지막 수유가 늦은", more: "마지막 수유가 늦어졌어요", less: "마지막 수유가 빨라졌어요", ...CLOCK },
  firstFeedMinutes: { family: "feed", axis: "첫 수유 시각", low: "첫 수유가 이른", high: "첫 수유가 늦은", more: "첫 수유가 늦어졌어요", less: "첫 수유가 빨라졌어요", ...CLOCK },
  feedCount: { family: "feed", axis: "수유 횟수", low: "수유가 적은", high: "수유가 잦은", more: "더 자주 먹었어요", less: "덜 자주 먹었어요", ...COUNT },
  feedVolume: { family: "feed", axis: "총 수유량", low: "적게 먹은", high: "많이 먹은", more: "더 많이 먹었어요", less: "덜 먹었어요", ...ML },
  nightSleepMinutes: { family: "sleep", axis: "밤잠", low: "밤에 덜 잔", high: "밤에 많이 잔", more: "밤에 더 잤어요", less: "밤에 덜 잤어요", ...MINUTES },
  feedIntervalAvg: { family: "feed", axis: "수유 간격", low: "수유 간격이 짧은", high: "수유 간격이 긴", more: "수유 간격이 길었어요", less: "수유 간격이 짧았어요", ...MINUTES },
  sleepMinutes: { family: "sleep", axis: "총 수면", low: "적게 잔", high: "많이 잔", more: "더 오래 잤어요", less: "덜 잤어요", ...MINUTES },
  sleepCount: { family: "sleep", axis: "잠든 횟수", low: "나눠 자지 않은", high: "여러 번 나눠 잔", more: "잠을 더 여러 번 나눠 잤어요", less: "잠을 덜 나눠 잤어요", ...COUNT },
  longestSleepMinutes: { family: "sleep", axis: "가장 긴 잠", low: "길게 이어 자지 못한", high: "길게 이어 잔", more: "한 번에 더 길게 잤어요", less: "한 번에 짧게 잤어요", ...MINUTES },
  diaperCount: { family: "diaper", axis: "기저귀 횟수", low: "기저귀가 적은", high: "기저귀가 잦은", more: "기저귀를 더 자주 갈았어요", less: "기저귀를 덜 갈았어요", ...COUNT },
  stoolCount: { family: "diaper", axis: "대변 횟수", low: "대변이 적은", high: "대변이 잦은", more: "대변을 더 자주 봤어요", less: "대변을 덜 봤어요", ...COUNT },
  bathMinutes: { family: "bath", axis: "목욕 시각", low: "목욕이 이른", high: "목욕이 늦은", more: "목욕이 늦어졌어요", less: "목욕이 빨라졌어요", ...CLOCK },
  tummyMinutes: { family: "activity", axis: "터미타임", low: "터미타임이 짧은", high: "터미타임이 긴", more: "터미타임을 더 오래 했어요", less: "터미타임이 짧았어요", ...MINUTES },
  playMinutes: { family: "activity", axis: "놀이 시간", low: "덜 논", high: "많이 논", more: "더 오래 놀았어요", less: "덜 놀았어요", ...MINUTES },
  waterVolume: { family: "water", axis: "물 섭취량", low: "물을 적게 마신", high: "물을 많이 마신", more: "물을 더 많이 마셨어요", less: "물을 덜 마셨어요", ...ML },
  foodAmount: { family: "food", axis: "이유식 양", low: "이유식을 적게 먹은", high: "이유식을 많이 먹은", more: "이유식을 더 많이 먹었어요", less: "이유식을 덜 먹었어요", ...GRAM },
  milkVolume: { family: "food", axis: "우유 섭취량", low: "우유를 적게 마신", high: "우유를 많이 마신", more: "우유를 더 많이 마셨어요", less: "우유를 덜 마셨어요", ...ML },
};

/**
 * 후보 쌍은 손으로 나열하지 않고 서로 다른 영역끼리 자동으로 만든다.
 *
 * 같은 영역끼리 빼는 이유: 총 수면과 가장 긴 잠처럼 정의가 겹치면
 * "많이 잔 날 길게 잤어요" 같은 당연한 문장만 나온다.
 *
 * 쌍이 늘어도 안전한 이유: 실제로 두 지표를 함께 기록한 날이 MIN_SAMPLES 이상인
 * 쌍만 검정하고, BH 보정도 그 부분집합에만 건다. 물을 안 적는 가정에서는
 * 물 관련 쌍이 아예 검정되지 않으므로 보정이 필요 이상으로 엄격해지지 않는다.
 */
export const CORRELATION_CANDIDATES: { input: FeatureKey; output: FeatureKey }[] = (() => {
  const keys = Object.keys(FEATURES) as FeatureKey[];
  const pairs: { input: FeatureKey; output: FeatureKey }[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      if (FEATURES[keys[i]].family === FEATURES[keys[j]].family) continue;
      pairs.push({ input: keys[i], output: keys[j] });
    }
  }
  return pairs;
})();

/** 문장에서 앞에 올 영역 순서. 작을수록 원인처럼 읽힌다. */
const FAMILY_ORDER: Record<FeatureFamily, number> = {
  bath: 0, activity: 1, water: 2, food: 3, feed: 4, sleep: 5, diaper: 6,
};

/** 헤드라인에서 차이값 뒤에 붙는 말. "1시간 40분 __" */
const GAP_TAIL: Record<FeatureKey, string> = {
  sleepMinutes: "더 잤어요",
  longestSleepMinutes: "더 길게 잤어요",
  sleepCount: "더 나눠 잤어요",
  diaperCount: "더 갈았어요",
  stoolCount: "더 봤어요",
  feedCount: "더 먹었어요",
  feedVolume: "더 먹었어요",
  foodAmount: "더 먹었어요",
  milkVolume: "더 마셨어요",
  waterVolume: "더 마셨어요",
  nightSleepMinutes: "밤에 더 잤어요",
  feedIntervalAvg: "간격이 길었어요",
  tummyMinutes: "더 했어요",
  playMinutes: "더 놀았어요",
  lastFeedMinutes: "늦게 먹었어요",
  firstFeedMinutes: "늦게 먹었어요",
  bathMinutes: "늦게 씻었어요",
};

/** UI 노출 임계. 실데이터 확보 후 튜닝할 것. */
export const MIN_SAMPLES = 14;
export const MIN_RHO = 0.4;
export const MAX_Q = 0.05;

export type Insight = {
  input: FeatureKey;
  output: FeatureKey;
  rho: number;
  n: number;
  q: number;
  /** 한 줄로 이은 문장. */
  headline: string;
  /** 카드에서 이름·차이값을 끼워 넣기 위해 나눠둔 조각. */
  lead: string;
  gapText: string;
  tail: string;
  distribution: Distribution;
};

/** 한 화면에 올릴 발견 수. 영역 쌍이 7개라 스물한 가지가 가능하지만 다섯을 넘기면 목록이 된다. */
export const MAX_INSIGHTS = 5;

/**
 * 발견을 찾을 때 거슬러 올라가는 날 수.
 *
 * 주간 리포트에 실리므로 한 주(6일)로 하고 싶지만 6일로는 어떤 상관도 검정할 수 없다.
 * MIN_SAMPLES 가 14일이라 표본이 애초에 모자라고, 6점으로 상관을 주장하는 것 자체가
 * 통계적으로 성립하지 않는다. 그래서 "최근"의 범위를 4주로 잡는다.
 * 예전에는 기록 전체를 썼다. 반년 전 습관이 이번 달 발견으로 나오는 게 이상해서 창을 뒀다.
 */
export const INSIGHT_WINDOW_DAYS = 28;

/**
 * 최근 창 안의 후보 쌍을 검정해 통과한 것을 강한 순으로 돌려준다.
 * 통과한 게 없으면 빈 배열 — 없는 패턴을 만들어내지 않기 위해 아예 띄우지 않는다.
 *
 * 같은 영역 쌍에서는 하나만 남긴다. 마지막 수유와 총 수면, 마지막 수유와 가장 긴 잠이
 * 둘 다 통과하면 사실상 같은 얘기라 두 줄을 쓸 이유가 없다.
 */
export function findInsights(
  logs: BabyLogEntry[],
  todayKey = formatDateKey(),
  limit = MAX_INSIGHTS,
  windowDays = INSIGHT_WINDOW_DAYS,
): Insight[] {
  // 오늘은 아직 끝나지 않은 날이라 뺀다. 그다음 최근 windowDays 일만 남긴다.
  const days = extractDailyFeatures(logs, todayKey)
    .filter((day) => day.dateKey !== todayKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-windowDays);

  const measured = CORRELATION_CANDIDATES.map((candidate) => {
    const pairs = days
      .map((day) => ({ x: day[candidate.input], y: day[candidate.output] }))
      .filter((pair): pair is { x: number; y: number } => pair.x !== null && pair.y !== null);
    const rho = pairs.length >= MIN_SAMPLES ? spearman(pairs.map((p) => p.x), pairs.map((p) => p.y)) : null;
    return { candidate, rho, n: pairs.length, pairs };
  });

  const testable = measured.filter((item): item is typeof item & { rho: number } => item.rho !== null);
  if (!testable.length) return [];

  const qs = benjaminiHochberg(testable.map((item) => pValueFromRho(item.rho, item.n)));

  const passed = testable
    .map((item, index) => ({ ...item, q: qs[index] }))
    .filter((item) => Math.abs(item.rho) >= MIN_RHO && item.q < MAX_Q)
    .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

  const out: Insight[] = [];
  const usedFamilyPairs = new Set<string>();

  for (const top of passed) {
    if (out.length >= limit) break;
    // 상관은 방향이 없으므로 문장이 자연스러운 쪽을 입력으로 삼는다.
    const a = top.candidate.input;
    const b = top.candidate.output;
    const swap = FAMILY_ORDER[FEATURES[a].family] > FAMILY_ORDER[FEATURES[b].family];
    const inputKey = swap ? b : a;
    const outputKey = swap ? a : b;
    const inputMeta = FEATURES[inputKey];
    const outputMeta = FEATURES[outputKey];

    // 같은 영역 쌍은 한 번만. 사실상 같은 얘기를 두 줄 쓰지 않는다.
    const familyPair = [inputMeta.family, outputMeta.family].sort().join("-");
    if (usedFamilyPairs.has(familyPair)) continue;

    const distribution = buildDistribution(
      top.pairs.map((pair) => ({ input: swap ? pair.y : pair.x, output: swap ? pair.x : pair.y })),
      {
        bucketLabel: inputMeta.axis,
        valueLabel: outputMeta.axis,
        formatInput: inputMeta.format,
        bucketNames: inputMeta.buckets,
        formatValue: outputMeta.format,
      },
    );
    if (!distribution) continue;

    // rho 가 음수면 "입력이 작을 때 결과가 크다".
    const lead = `${top.rho < 0 ? inputMeta.low : inputMeta.high} 날, `;
    const tail = GAP_TAIL[outputKey];
    // 양 끝 구간의 차이가 부모가 기억할 유일한 숫자다.
    const first = distribution.buckets[0].value;
    const last = distribution.buckets[distribution.buckets.length - 1].value;
    const gapText = outputMeta.format(Math.abs(last - first));

    usedFamilyPairs.add(familyPair);
    out.push({
      input: inputKey,
      output: outputKey,
      rho: top.rho,
      n: top.n,
      q: top.q,
      headline: `${lead}${gapText} ${tail}`,
      lead,
      gapText,
      tail,
      distribution,
    });
  }

  return out;
}
