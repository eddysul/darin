/**
 * 주간 해석의 순수 로직 — 프롬프트, 검증, 표 직렬화.
 *
 * API 호출과 분리해 둔다. react-native 를 끌고 들어오지 않으므로
 * 검증 규칙을 스크립트로 돌려볼 수 있다. 안전장치는 테스트할 수 있어야 한다.
 */
import type { WeeklyFeatureTable } from "./weeklyFeatureTable";

/**
 * 프롬프트나 출력 형식이 바뀌면 올린다.
 * 캐시는 이 값이 다르면 무시한다. 안 그러면 같은 주 동안 옛 형식 문장이 계속 나온다.
 */
export const NARRATIVE_VERSION = 3;

export const SYSTEM_PROMPT = `너는 육아 기록 앱의 주간 리포트 카드를 쓴다. 아래 규칙을 반드시 지켜라.

[네가 쓰는 자리]
이건 리포트 본문이 아니라 리포트를 열기 전에 보이는 카드다.
전체 숫자는 카드를 눌러야 나오는 상세 화면에 이미 다 있다.
요약하지 마라. 나열하지 마라. 지표 하나만 골라라.
고를 때는 이번 주에 가장 크게 달라진 것, 그리고 그 변화가 언제 나타났는지를 본다.

[관계를 다루는 규칙]
"함께 나타난 관계" 목록은 그 자체로 카드 아래에 따로 안내된다.
그러니 목록에 있는 관계를 네 문장에 옮겨 적지 마라. 미리 말해 버리면 열어 볼 이유가 없어진다.
관계는 어떤 지표를 고를지 판단하는 데만 참고해라.

지표 둘이 같은 주에 함께 변했다는 것은 둘이 관계있다는 근거가 아니다.
대변도 늘고 수유도 늘었다고 해서 "대변이 늘면서 수유도 늘었어요" 라고 쓰면 안 된다.

[반드시 지킬 것]
- 표에 없는 숫자를 쓰지 마라. 계산하거나 추정하지 마라.
- 조언·권유·명령을 하지 마라. "~해보세요", "~줄이세요", "~하는 게 좋아요" 금지.
- 예측하지 마라. "앞으로", "다음 주에는" 금지.
- 원인을 단정하지 마라. "때문에" 대신 "함께", "같은 기간에" 처럼 쓴다.
- 아이를 평가하지 마라. "잘", "충분히", "정상" 금지.
- 다른 아기와 비교하지 마라.
- 엠대시를 절대 쓰지 마라. 쉼표나 마침표로 문장을 나눠라.

[문체]
- 해요체로 쓴다. "습니다", "했다" 로 끝내지 마라.
- headline: 20자 내외 한 줄. 지표 하나가 어떻게 달라졌는지, 가능하면 언제부터인지를 담는다. 숫자를 넣지 마라.
- body: 한 문장. "지난주값 → 이번주값" 을 딱 한 번 쓴다. 화살표 사이에 다른 말을 끼우지 마라.
  둘째 문장을 붙이려면 숫자 없이, 그 변화가 언제부터 나타났는지만 말한다.

[예시]
밤잠이 목요일부터 부쩍 길어졌어요

하루 평균 4시간 51분 → 6시간 42분으로 늘었어요.

[출력 형식]
첫 줄에 headline, 빈 줄, 그다음 body. 다른 말은 붙이지 마라.`;

/** 조언·예측·판단으로 읽히는 표현. 하나라도 있으면 폐기한다. 발견 문장도 같은 규칙을 쓴다. */
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
export function validateNarrative(text: string, table: WeeklyFeatureTable): boolean {
  if (!text.trim()) return false;
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
  const lines: string[] = [
    `기간: ${table.meta.periodLabel} (최근 6일 중 ${table.meta.recordedDays}일 기록)`,
    table.meta.ageMonths !== null ? `아기 월령: ${table.meta.ageMonths}개월` : "",
    "",
    "지표 (이번주 평균 / 지난주 평균 / 요일별)",
  ].filter(Boolean);

  for (const metric of table.metrics) {
    const last = metric.lastWeek ? `${metric.lastWeek.avg}${metric.unit}` : "기록 없음";
    const daily = metric.daily.map((v) => (v === null ? "-" : v)).join(", ");
    lines.push(
      `- ${metric.label}: 이번주 ${metric.thisWeek.avg}${metric.unit} (최소 ${metric.thisWeek.min}, 최대 ${metric.thisWeek.max}) / 지난주 ${last} / 요일별 [${daily}]`,
    );
  }

  if (table.correlations.length) {
    lines.push("", "함께 나타난 관계 (원인이 아님)");
    for (const c of table.correlations) {
      lines.push(`- ${c.a} 날에 ${c.b} (${c.n}일 관측)`);
    }
  }
  return lines.join("\n");
}

