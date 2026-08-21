/**
 * 성장 백분위 계산.
 *
 * WHO 는 나이별로 LMS 세 계수를 준다. 이 셋이 있으면 어떤 측정값이든
 * z 점수로 바꿀 수 있고, z 를 정규분포에 넣으면 백분위가 나온다.
 * 반대로 z 를 값으로 되돌리면 차트에 그릴 곡선이 된다.
 *
 * 이 계산은 전부 기기에서 한다. 아이의 키·몸무게는 밖으로 나가지 않는다.
 */
import { WHO_DAYS, WHO_STANDARDS, type WhoMeasure, type WhoSex } from "../constants/whoGrowthStandards";

export type { WhoMeasure, WhoSex };

/** 차트에 그릴 곡선. 의사가 보여주는 성장도표와 같은 구성이다. */
export const CURVE_PERCENTILES = [3, 15, 50, 85, 97];

export const WHO_MAX_DAYS = WHO_DAYS[WHO_DAYS.length - 1];

type Lms = { l: number; m: number; s: number };

/** 나이 지점 사이는 선형 보간한다. 범위를 벗어나면 null 이다. */
export function lmsAt(measure: WhoMeasure, sex: WhoSex, ageDays: number): Lms | null {
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > WHO_MAX_DAYS) return null;
  const table = WHO_STANDARDS[measure][sex];

  let hi = WHO_DAYS.findIndex((day) => day >= ageDays);
  if (hi < 0) return null;
  if (hi === 0) return { l: table.l[0], m: table.m[0], s: table.s[0] };

  const lo = hi - 1;
  const span = WHO_DAYS[hi] - WHO_DAYS[lo];
  const w = span === 0 ? 0 : (ageDays - WHO_DAYS[lo]) / span;
  return {
    l: table.l[lo] * (1 - w) + table.l[hi] * w,
    m: table.m[lo] * (1 - w) + table.m[hi] * w,
    s: table.s[lo] * (1 - w) + table.s[hi] * w,
  };
}

/** 측정값 → z 점수. WHO 의 LMS 공식 그대로. */
export function zScoreFor(measure: WhoMeasure, sex: WhoSex, ageDays: number, value: number): number | null {
  const lms = lmsAt(measure, sex, ageDays);
  if (!lms || !(value > 0)) return null;
  const { l, m, s } = lms;
  return Math.abs(l) < 1e-9 ? Math.log(value / m) / s : ((value / m) ** l - 1) / (l * s);
}

/** z 점수 → 그 나이에서의 측정값. 곡선을 그릴 때 쓴다. */
export function valueAtZ(measure: WhoMeasure, sex: WhoSex, ageDays: number, z: number): number | null {
  const lms = lmsAt(measure, sex, ageDays);
  if (!lms) return null;
  const { l, m, s } = lms;
  return Math.abs(l) < 1e-9 ? m * Math.exp(s * z) : m * (1 + l * s * z) ** (1 / l);
}

/** 표준정규 누적분포. Abramowitz & Stegun 26.2.17, 오차 7.5e-8. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const tail = (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? 1 - tail : tail;
}

/** 백분위 → z 점수. 이분법이면 충분하고, 근사식보다 짧고 정확하다. */
export function zForPercentile(percentile: number): number {
  const target = percentile / 100;
  let lo = -5;
  let hi = 5;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 측정값이 또래 100명 중 몇 번째인지. 0~100. */
export function percentileFor(
  measure: WhoMeasure,
  sex: WhoSex,
  ageDays: number,
  value: number,
): number | null {
  const z = zScoreFor(measure, sex, ageDays, value);
  return z === null ? null : normalCdf(z) * 100;
}

/**
 * 백분위를 사람이 읽는 말로.
 * 등수처럼 읽히지 않도록 "또래 100명 중" 을 붙인다. 평가하지 않는다.
 */
export function describePercentile(percentile: number): string {
  const rounded = Math.round(percentile);
  if (rounded < 1) return "또래 100명 중 아래에서 1번째보다 작아요";
  if (rounded > 99) return "또래 100명 중 위에서 1번째보다 커요";
  return `또래 100명 중 아래에서 ${rounded}번째쯤이에요`;
}

/** 생년월일과 측정일로 그날의 나이(일). 측정일이 생일보다 앞서면 null. */
export function ageDaysBetween(birthDate: string, measuredAt: string): number | null {
  const birth = new Date(`${birthDate}T00:00:00`);
  const measured = new Date(`${measuredAt.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(measured.getTime())) return null;
  const days = Math.round((measured.getTime() - birth.getTime()) / 86_400_000);
  return days < 0 ? null : days;
}
