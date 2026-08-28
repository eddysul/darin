/**
 * 주간 해석의 순수 로직 — 프롬프트, 검증, 표 직렬화.
 *
 * API 호출과 분리해 둔다. react-native 를 끌고 들어오지 않으므로
 * 검증 규칙을 스크립트로 돌려볼 수 있다. 안전장치는 테스트할 수 있어야 한다.
 */
import type { WeeklyFeatureTable } from "./weeklyFeatureTable";
import type { Locale } from "../i18n";
import { aiOutputLanguageInstruction, isAiOutputLocaleSafe } from "./aiLocale";

/**
 * 프롬프트나 출력 형식이 바뀌면 올린다.
 * 캐시는 이 값이 다르면 무시한다. 안 그러면 같은 주 동안 옛 형식 문장이 계속 나온다.
 */
export const NARRATIVE_VERSION = 5;

export const SYSTEM_PROMPT = `You write one preview card for a childcare app's weekly report.

[Task]
- Select exactly one metric with the most meaningful week-over-week change.
- This is a preview, not the full report. Do not list or summarize every metric.
- Mention when the change appeared only when the supplied daily values support it.

[Safety]
- Use only numbers present in the supplied JSON. Never calculate, estimate, or invent a number.
- Do not give advice, recommendations, commands, predictions, diagnoses, or medical judgments.
- Do not claim causation or compare the child with other children.
- Do not describe the child as normal, abnormal, good, bad, sufficient, or insufficient.
- Do not use an em dash.

[Format]
- First line: a short headline without numbers.
- Blank line.
- Then one factual body sentence containing exactly one "previous value → current value" comparison.
- Return no labels, bullets, markdown, or additional commentary.`;

export function narrativeSystemPrompt(locale: Locale): string {
  return `${SYSTEM_PROMPT}

[Language]
${aiOutputLanguageInstruction(locale)}`;
}

export const BANNED_PHRASES = [
  // 명령·권유. 서술형 리포트에 "~세요"로 끝나는 문장은 나올 이유가 없다.
  "세요", "권장", "추천", "하는 게 좋",
  // 당위. 어간이 바뀌므로 어미로 잡는다 ("지켜야 해요", "늘려야 합니다")
  "야 해요", "야 합니다", "야 돼", "야겠",
  // 예측
  "앞으로", "다음 주에는", "예상", "일 것입니다", "할 수 있을 거",
  // 인과 단정
  "때문에", "덕분에", "탓에",
  // 아이에 대한 판단
  "정상", "비정상", "충분히", "잘 자", "잘 먹", "부족해",
  // 또래 비교
  "또래", "평균보다", "표준",
  // 이 앱은 화면 어디에도 엠대시를 쓰지 않는다.
  "\u2014",
  // 앱 전체가 해요체다. 습니다체가 섞이면 톤이 깨진다.
  "습니다", "됩니다", "입니다",
];

/** 표에 실제로 등장하는 수를 모은다. 문장에 이 밖의 수가 있으면 지어낸 것이다. */
function allowedNumbers(table: WeeklyFeatureTable): Set<number> {
  const set = new Set<number>();
  const add = (n: number | null | undefined) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return;
    set.add(Math.round(n));
    // 분 단위 값은 "N시간 M분"으로 읽히므로 그 조각도 허용한다.
    if (n >= 60) {
      set.add(Math.floor(n / 60));
      set.add(Math.round(n % 60));
    }
  };
  for (const metric of table.metrics) {
    add(metric.thisWeek.avg);
    add(metric.thisWeek.min);
    add(metric.thisWeek.max);
    add(metric.thisWeek.days);
    add(metric.lastWeek?.avg);
    add(metric.lastWeek?.min);
    add(metric.lastWeek?.max);
    if (metric.lastWeek) add(Math.abs(metric.thisWeek.avg - metric.lastWeek.avg));
    for (const value of metric.daily) add(value);
  }
  add(table.meta.recordedDays);
  add(table.meta.ageMonths);
  return set;
}

/** 문장 속 수가 전부 표에서 온 것인지, 금지 표현이 없는지 확인한다. */
export function validateNarrative(text: string, table: WeeklyFeatureTable, locale: Locale = "ko"): boolean {
  if (!text.trim()) return false;
  if (!isAiOutputLocaleSafe(text, locale)) return false;
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 2 || /\d/.test(lines[0])) return false;
  if ((text.match(/→/g) ?? []).length !== 1) return false;
  for (const word of BANNED_PHRASES) {
    if (text.includes(word)) return false;
  }
  const allowed = allowedNumbers(table);
  const numbers = text.match(/\d+(\.\d+)?/g) ?? [];
  return numbers.every((raw) => {
    const value = Math.round(Number.parseFloat(raw));
    // 시각 표기(6시 30분)와 반올림 오차를 감안해 ±1 까지 인정한다.
    return allowed.has(value) || allowed.has(value - 1) || allowed.has(value + 1);
  });
}

/** 표를 프롬프트에 넣기 좋은 형태로. 분 단위 시각은 사람이 읽는 형태를 함께 준다. */
export function describeTable(table: WeeklyFeatureTable): string {
  return JSON.stringify({
    period: { dateKeys: table.meta.dateKeys, recordedDays: table.meta.recordedDays, ageMonths: table.meta.ageMonths },
    metrics: table.metrics.map((metric) => ({
      key: metric.key,
      unit: metric.unit === "분" ? "minutes" : metric.unit === "회" ? "count" : metric.unit,
      current: metric.thisWeek,
      previous: metric.lastWeek,
      daily: metric.daily,
      changeRatio: metric.changeRatio,
    })),
  }, null, 2);
}
